use base64::{engine::general_purpose::STANDARD, Engine as _};
use metaflac::Tag;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetadata {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub sample_rate: u32,
    pub bit_depth: u32,
    pub channels: u16,
    pub bit_rate_kbps: Option<u32>,
    pub replay_gain_db: Option<f32>,
    pub replay_gain_peak: Option<f32>,
    pub embedded_art_base64: Option<String>,
    pub unsynced_lyrics: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub date: Option<String>,
    pub key: Option<String>,
    pub bpm: Option<u32>,
}


fn parse_replay_gain_db(gain_str: &str) -> Option<f32> {
    let clean = gain_str.trim().replace("dB", "").replace("DB", "");
    clean.trim().parse::<f32>().ok()
}

fn parse_replay_gain_peak(peak_str: &str) -> Option<f32> {
    peak_str.trim().parse::<f32>().ok()
}

pub fn extract_track_art(path_str: &str) -> Option<String> {
    let path = Path::new(path_str);
    if let Ok(tag) = Tag::read_from_path(path) {
        for pic in tag.pictures() {
            let mime = if pic.mime_type.is_empty() {
                "image/jpeg".to_string()
            } else {
                pic.mime_type.clone()
            };
            let encoded = STANDARD.encode(&pic.data);
            return Some(format!("data:{};base64,{}", mime, encoded));
        }
    }

    // Fallback: Check folder for cover image
    if let Some(parent) = path.parent() {
        for name in &[
            "cover.jpg",
            "cover.png",
            "folder.jpg",
            "folder.png",
            "album.jpg",
            "album.png",
            "Cover.jpg",
            "Folder.jpg",
            "Album.jpg",
            "art.jpg",
            "art.png",
        ] {
            let img_path = parent.join(name);
            if img_path.exists() {
                if let Ok(bytes) = std::fs::read(&img_path) {
                    let mime = if name.to_lowercase().ends_with(".png") {
                        "image/png"
                    } else {
                        "image/jpeg"
                    };
                    let encoded = STANDARD.encode(&bytes);
                    return Some(format!("data:{};base64,{}", mime, encoded));
                }
            }
        }
    }
    None
}

/// On-demand lyrics extraction from a FLAC file.
/// Reads directly from disk, bypassing any cached library.json.
pub fn extract_track_lyrics(path_str: &str) -> Option<String> {
    let path = Path::new(path_str);

    // Primary: Read from Vorbis comments via metaflac
    if let Ok(tag) = Tag::read_from_path(path) {
        if let Some(c) = tag.vorbis_comments() {
            let mut best_lyrics = None;
            let mut best_score = 0;

            for (key, values) in &c.comments {
                let key_upper = key.to_uppercase();

                let score = if key_upper == "SYNCEDLYRICS" {
                    10
                } else if key_upper == "LYRICS" {
                    8
                } else if key_upper == "UNSYNCEDLYRICS" {
                    7
                } else if key_upper == "USLT" {
                    5
                } else if key_upper.contains("SYNCED") && !key_upper.contains("UNSYNCED") {
                    9
                } else if key_upper == "TEXT" {
                    1
                } else {
                    0
                };

                if score > best_score {
                    if !values.is_empty() {
                        let l = values.join("\n");
                        let cleaned = l.trim_matches('\0').trim();
                        if !cleaned.is_empty() {
                            best_score = score;
                            best_lyrics = Some(cleaned.to_string());
                        }
                    }
                }
            }
            if best_lyrics.is_some() {
                return best_lyrics;
            }
        }
    }

    // Fallback: Probe via Symphonia for ID3v2 / embedded metadata
    if let Ok(file) = std::fs::File::open(path) {
        let mss = symphonia::core::io::MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = symphonia::core::probe::Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }
        if let Ok(probed) = symphonia::default::get_probe().format(
            &hint,
            mss,
            &Default::default(),
            &Default::default(),
        ) {
            let mut reader = probed.format;
            if let Some(metadata) = reader.metadata().current() {
                let mut best_lyrics = None;
                let mut best_score = 0;

                for t in metadata.tags() {
                    let std_key_str = format!("{:?}", t.std_key).to_uppercase();
                    let key_name = t.key.to_uppercase();

                    let score = if key_name == "SYNCEDLYRICS" || std_key_str.contains("SYNCED") {
                        10
                    } else if key_name == "LYRICS" || std_key_str.contains("LYRICS") {
                        8
                    } else if key_name == "UNSYNCEDLYRICS" {
                        7
                    } else if key_name == "USLT" {
                        5
                    } else if key_name.contains("SYNCED") && !key_name.contains("UNSYNCED") {
                        9
                    } else {
                        0
                    };

                    if score > best_score {
                        let val = t.value.to_string();
                        let cleaned = val.trim_matches('\0').trim();
                        if !cleaned.is_empty() {
                            best_score = score;
                            best_lyrics = Some(cleaned.to_string());
                        }
                    }
                }
                if best_lyrics.is_some() {
                    return best_lyrics;
                }
            }
        }
    }

    None
}

pub fn parse_flac_file(path: &Path) -> Option<TrackMetadata> {
    let tag = Tag::read_from_path(path).ok()?;
    let comments = tag.vorbis_comments();

    let path_str = path.to_string_lossy().to_string();
    let filename = path.file_stem()?.to_string_lossy().to_string();

    let title = comments
        .and_then(|c| c.title().map(|t| t.join(", ")))
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| filename.clone());

    let artist = comments
        .and_then(|c| c.artist().map(|a| a.join(", ")))
        .filter(|a| !a.is_empty())
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album = comments
        .and_then(|c| c.album().map(|a| a.join(", ")))
        .filter(|a| !a.is_empty())
        .unwrap_or_else(|| "Unknown Album".to_string());

    let mut replay_gain_db = None;
    let mut replay_gain_peak = None;
    let mut unsynced_lyrics = None;
    let mut genre = None;
    let mut year = None;
    let mut date = None;
    let mut key = None;
    let mut bpm = None;


    if let Some(c) = comments {
        if let Some(gains) = c.get("REPLAYGAIN_TRACK_GAIN") {
            if let Some(gain_str) = gains.first() {
                replay_gain_db = parse_replay_gain_db(gain_str);
            }
        }
        if let Some(peaks) = c.get("REPLAYGAIN_TRACK_PEAK") {
            if let Some(peak_str) = peaks.first() {
                replay_gain_peak = parse_replay_gain_peak(peak_str);
            }
        }

        if let Some(g_list) = c.get("GENRE") {
            if let Some(g) = g_list.first() {
                let cleaned = g.trim();
                if !cleaned.is_empty() {
                    genre = Some(cleaned.to_string());
                }
            }
        }

        if let Some(d_list) = c.get("DATE").or_else(|| c.get("YEAR")) {
            if let Some(d) = d_list.first() {
                let cleaned = d.trim();
                if !cleaned.is_empty() {
                    date = Some(cleaned.to_string());
                    if let Some(y_str) = cleaned.split('-').next().or_else(|| cleaned.split('/').next()) {
                        if let Ok(y_num) = y_str.parse::<u32>() {
                            year = Some(y_num);
                        }
                    }
                }
            }
        }

        // Case-insensitive vorbis tag search for Key and BPM
        for (k_name, values) in &c.comments {
            let key_upper = k_name.to_uppercase();
            if key.is_none() && (key_upper == "INITIALKEY" || key_upper == "KEY" || key_upper == "TKEY") {
                if let Some(k) = values.first() {
                    let cleaned = k.trim();
                    if !cleaned.is_empty() {
                        key = Some(cleaned.to_string());
                    }
                }
            }
            if bpm.is_none() && (key_upper == "BPM" || key_upper == "TBPM" || key_upper == "TEMPO") {
                if let Some(b) = values.first() {
                    let clean = b.to_uppercase().replace("BPM", "").trim().to_string();
                    if let Ok(val) = clean.parse::<f32>() {
                        bpm = Some(val as u32);
                    } else if let Ok(val) = clean.parse::<u32>() {
                        bpm = Some(val);
                    }
                }
            }
        }

        let mut best_lyrics = None;
        let mut best_score = 0;

        for (k_name, values) in &c.comments {
            let key_upper = k_name.to_uppercase();

            let score = if key_upper == "SYNCEDLYRICS" {
                10
            } else if key_upper == "LYRICS" {
                8
            } else if key_upper == "UNSYNCEDLYRICS" {
                7
            } else if key_upper == "USLT" {
                5
            } else if key_upper.contains("SYNCED") && !key_upper.contains("UNSYNCED") {
                9
            } else if key_upper == "TEXT" {
                1
            } else {
                0
            };

            if score > best_score {
                if !values.is_empty() {
                    let l = values.join("\n");
                    let cleaned = l.trim_matches('\0').trim();
                    if !cleaned.is_empty() {
                        best_score = score;
                        best_lyrics = Some(cleaned.to_string());
                    }
                }
            }
        }
        if best_lyrics.is_some() {
            unsynced_lyrics = best_lyrics;
        }
    }

    // Secondary fallback using lofty: Probe file for generic ID3 tags (genre, year, key, bpm)
    if let Ok(tagged_file) = lofty::probe::Probe::open(path).and_then(|p| p.read()) {
        use lofty::file::TaggedFileExt;
        use lofty::tag::Accessor;


        for t in tagged_file.tags() {
            if genre.is_none() {
                if let Some(g) = t.genre() {
                    genre = Some(g.to_string());
                }
            }
            if year.is_none() {
                if let Some(y) = t.year() {
                    year = Some(y);
                }
            }
            if key.is_none() {
                if let Some(k_item) = t.get_string(&lofty::tag::ItemKey::InitialKey) {
                    key = Some(k_item.to_string());
                }
            }
            if bpm.is_none() {
                if let Some(b_item) = t.get_string(&lofty::tag::ItemKey::Bpm) {
                    let clean = b_item.to_uppercase().replace("BPM", "").trim().to_string();
                    if let Ok(b_val) = clean.parse::<f32>() {
                        bpm = Some(b_val as u32);
                    }
                }
            }

            for item in t.items() {
                let k_str = format!("{:?}", item.key()).to_uppercase();
                if key.is_none() && (k_str.contains("INITIALKEY") || k_str.contains("KEY") || k_str.contains("TKEY")) {
                    if let lofty::tag::ItemValue::Text(val) = item.value() {
                        let cleaned = val.trim();
                        if !cleaned.is_empty() { key = Some(cleaned.to_string()); }
                    }
                }
                if bpm.is_none() && (k_str.contains("BPM") || k_str.contains("TEMPO") || k_str.contains("TBPM")) {
                    if let lofty::tag::ItemValue::Text(val) = item.value() {
                        let clean = val.to_uppercase().replace("BPM", "").trim().to_string();
                        if let Ok(b_val) = clean.parse::<f32>() {
                            bpm = Some(b_val as u32);
                        }
                    }
                }
            }
        }
    }

    // Secondary fallback: Probe via Symphonia for ID3v2 / embedded metadata
    if unsynced_lyrics.is_none() {
        if let Ok(file) = std::fs::File::open(path) {
            let mss =
                symphonia::core::io::MediaSourceStream::new(Box::new(file), Default::default());
            let mut hint = symphonia::core::probe::Hint::new();
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                hint.with_extension(ext);
            }
            if let Ok(probed) = symphonia::default::get_probe().format(
                &hint,
                mss,
                &Default::default(),
                &Default::default(),
            ) {
                let mut reader = probed.format;
                if let Some(metadata) = reader.metadata().current() {
                    let mut best_lyrics = None;
                    let mut best_score = 0;

                    for t in metadata.tags() {
                        let std_key_str = format!("{:?}", t.std_key).to_uppercase();
                        let key_name = t.key.to_uppercase();

                        let score = if key_name == "SYNCEDLYRICS" || std_key_str.contains("SYNCED")
                        {
                            10
                        } else if key_name == "LYRICS" || std_key_str.contains("LYRICS") {
                            8
                        } else if key_name == "UNSYNCEDLYRICS" {
                            7
                        } else if key_name == "USLT" {
                            5
                        } else if key_name.contains("SYNCED") && !key_name.contains("UNSYNCED") {
                            9
                        } else {
                            0
                        };

                        if score > best_score {
                            let val = t.value.to_string();
                            let cleaned = val.trim_matches('\0').trim();
                            if !cleaned.is_empty() {
                                best_score = score;
                                best_lyrics = Some(cleaned.to_string());
                            }
                        }
                    }
                    if best_lyrics.is_some() {
                        unsynced_lyrics = best_lyrics;
                    }
                }
            }
        }
    }

    let stream_info = tag.get_streaminfo()?;
    let sample_rate = stream_info.sample_rate;
    let bit_depth = stream_info.bits_per_sample as u32;
    let channels = stream_info.num_channels as u16;
    let duration_secs = if sample_rate > 0 {
        stream_info.total_samples as f64 / sample_rate as f64
    } else {
        0.0
    };

    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let bit_rate_kbps = if duration_secs > 0.0 && file_size > 0 {
        Some((file_size as f64 * 8.0 / duration_secs / 1000.0) as u32)
    } else {
        None
    };

    let id = format!("{:x}", md5_hash(&path_str));

    Some(TrackMetadata {
        id,
        path: path_str,
        title,
        artist,
        album,
        duration_secs,
        sample_rate,
        bit_depth,
        channels,
        bit_rate_kbps,
        replay_gain_db,
        replay_gain_peak,
        embedded_art_base64: None, // On-demand art fetching keeps library tiny and ultra-fast
        unsynced_lyrics,
        genre,
        year,
        date,
        key,
        bpm,
    })

}

pub fn parse_audio_file(path: &Path) -> Option<TrackMetadata> {
    if let Some(t) = parse_flac_file(path) {
        return Some(t);
    }

    use lofty::file::AudioFile;
    use lofty::file::TaggedFileExt;
    use lofty::probe::Probe;
    use lofty::tag::Accessor;

    let path_str = path.to_string_lossy().to_string();
    let filename = path.file_stem()?.to_string_lossy().to_string();

    let tagged_file = Probe::open(path).ok()?.read().ok()?;

    let properties = tagged_file.properties();
    let duration_secs = properties.duration().as_secs_f64();
    let sample_rate = properties.sample_rate().unwrap_or(44100);
    let bit_depth = properties.bit_depth().unwrap_or(16) as u32;
    let channels = properties.channels().unwrap_or(2) as u16;
    let bit_rate_kbps = properties.audio_bitrate();

    let mut title = filename.clone();
    let mut artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut genre = None;
    let mut year = None;
    let mut date = None;
    let mut key = None;
    let mut bpm = None;
    let mut unsynced_lyrics = None;

    for tag in tagged_file.tags() {
        if let Some(t) = tag.title() {
            let cleaned = t.trim();
            if !cleaned.is_empty() { title = cleaned.to_string(); }
        }
        if let Some(a) = tag.artist() {
            let cleaned = a.trim();
            if !cleaned.is_empty() { artist = cleaned.to_string(); }
        }
        if let Some(al) = tag.album() {
            let cleaned = al.trim();
            if !cleaned.is_empty() { album = cleaned.to_string(); }
        }
        if genre.is_none() {
            if let Some(g) = tag.genre() {
                let cleaned = g.trim();
                if !cleaned.is_empty() { genre = Some(cleaned.to_string()); }
            }
        }
        if year.is_none() {
            if let Some(y) = tag.year() {
                year = Some(y);
            }
        }
        if key.is_none() {
            if let Some(k) = tag.get_string(&lofty::tag::ItemKey::InitialKey) {
                let cleaned = k.trim();
                if !cleaned.is_empty() { key = Some(cleaned.to_string()); }
            }
        }
        if bpm.is_none() {
            if let Some(b) = tag.get_string(&lofty::tag::ItemKey::Bpm) {
                let clean = b.to_uppercase().replace("BPM", "").trim().to_string();
                if let Ok(b_val) = clean.parse::<f32>() {
                    bpm = Some(b_val as u32);
                }
            }
        }

        for item in tag.items() {
            let k_str = format!("{:?}", item.key()).to_uppercase();
            if key.is_none() && (k_str.contains("INITIALKEY") || k_str.contains("KEY") || k_str.contains("TKEY")) {
                if let lofty::tag::ItemValue::Text(val) = item.value() {
                    let cleaned = val.trim();
                    if !cleaned.is_empty() { key = Some(cleaned.to_string()); }
                }
            }
            if bpm.is_none() && (k_str.contains("BPM") || k_str.contains("TEMPO") || k_str.contains("TBPM")) {
                if let lofty::tag::ItemValue::Text(val) = item.value() {
                    let clean = val.to_uppercase().replace("BPM", "").trim().to_string();
                    if let Ok(b_val) = clean.parse::<f32>() {
                        bpm = Some(b_val as u32);
                    }
                }
            }
        }
    }

    let id = format!("{:x}", md5_hash(&path_str));

    Some(TrackMetadata {
        id,
        path: path_str,
        title,
        artist,
        album,
        duration_secs,
        sample_rate,
        bit_depth,
        channels,
        bit_rate_kbps,
        replay_gain_db: None,
        replay_gain_peak: None,
        embedded_art_base64: None,
        unsynced_lyrics,
        genre,
        year,
        date,
        key,
        bpm,
    })
}

fn md5_hash(input: &str) -> u128 {
    let mut hash: u128 = 0xcbf29ce484222325;
    for byte in input.bytes() {
        hash ^= byte as u128;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn normalize_android_path(dir_path: &str) -> String {
    let mut path = dir_path.to_string();

    path = path.replace("%3A", ":").replace("%3a", ":")
               .replace("%2F", "/").replace("%2f", "/")
               .replace("%20", " ");

    if path.contains("primary:") {
        if let Some(idx) = path.find("primary:") {
            let relative = &path[idx + "primary:".len()..];
            let clean_relative = relative.trim_start_matches('/');
            if clean_relative.is_empty() {
                return "/storage/emulated/0".to_string();
            } else {
                return format!("/storage/emulated/0/{}", clean_relative);
            }
        }
    }

    if path.contains("raw:") {
        if let Some(idx) = path.find("raw:") {
            let raw_path = &path[idx + "raw:".len()..];
            return raw_path.to_string();
        }
    }

    path
}

pub fn scan_configured_directories(
    included_dirs: &[String],
    excluded_dirs: &[String],
) -> Vec<TrackMetadata> {
    let mut all_audio_paths: Vec<PathBuf> = Vec::new();
    let excluded_paths: Vec<PathBuf> = excluded_dirs
        .iter()
        .map(|d| PathBuf::from(normalize_android_path(d)))
        .collect();

    for raw_dir in included_dirs {
        let normalized = normalize_android_path(raw_dir);
        let mut target_paths = vec![PathBuf::from(&normalized)];

        if !Path::new(&normalized).exists() && normalized.contains("Music") {
            let fallback = PathBuf::from("/storage/emulated/0/Music");
            if fallback.exists() {
                target_paths.push(fallback);
            }
        }

        for p_buf in target_paths {
            if !p_buf.exists() {
                continue;
            }

            let paths: Vec<PathBuf> = WalkDir::new(&p_buf)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_file())
                .filter(|e| {
                    let is_supported = e
                        .path()
                        .extension()
                        .map(|ext| {
                            let ext_str = ext.to_string_lossy().to_lowercase();
                            matches!(
                                ext_str.as_str(),
                                "flac" | "mp3" | "m4a" | "wav" | "ogg" | "aac" | "aiff" | "alac" | "wma"
                            )
                        })
                        .unwrap_or(false);
                    if !is_supported {
                        return false;
                    }

                    let file_path = e.path();
                    for exc in &excluded_paths {
                        if file_path.starts_with(exc) {
                            return false;
                        }
                    }

                    true
                })
                .map(|e| e.path().to_path_buf())
                .collect();

            all_audio_paths.extend(paths);
        }
    }

    all_audio_paths.sort();
    all_audio_paths.dedup();

    all_audio_paths
        .into_par_iter()
        .filter_map(|path| parse_audio_file(&path))
        .collect()
}

pub fn scan_directory_for_tracks(dir_path: &str) -> Vec<TrackMetadata> {
    scan_configured_directories(&[dir_path.to_string()], &[])
}

pub fn save_library_to_disk(app_data_path: &Path, tracks: &[TrackMetadata]) -> Result<(), String> {
    std::fs::create_dir_all(app_data_path).map_err(|e| e.to_string())?;
    let file_path = app_data_path.join("library.json");

    // Strip heavy artwork from library.json to ensure disk file is tiny (<1MB)
    let lightweight_tracks: Vec<TrackMetadata> = tracks
        .iter()
        .map(|t| {
            let mut clone = t.clone();
            clone.embedded_art_base64 = None;
            clone
        })
        .collect();

    let json = serde_json::to_string(&lightweight_tracks).map_err(|e| e.to_string())?;
    std::fs::write(file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_library_from_disk(app_data_path: &Path) -> Result<Vec<TrackMetadata>, String> {
    let file_path = app_data_path.join("library.json");
    if !file_path.exists() {
        return Ok(Vec::new());
    }
    let json = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let tracks: Vec<TrackMetadata> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(tracks)
}

pub fn embed_track_lyrics(path_str: &str, lyrics: &str) -> Result<(), String> {
    let path = Path::new(path_str);
    let mut tag = Tag::read_from_path(path).map_err(|e| e.to_string())?;
    {
        let comments = tag.vorbis_comments_mut();
        comments.comments.remove("SYNCEDLYRICS");
        comments.comments.remove("LYRICS");
        comments.comments.remove("UNSYNCEDLYRICS");
        comments.comments.insert("SYNCEDLYRICS".to_string(), vec![lyrics.to_string()]);
    }
    tag.save().map_err(|e| e.to_string())?;
    Ok(())
}
