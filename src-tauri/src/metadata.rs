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
            unsynced_lyrics = best_lyrics;
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

pub fn scan_configured_directories(
    included_dirs: &[String],
    excluded_dirs: &[String],
) -> Vec<TrackMetadata> {
    let mut all_flac_paths: Vec<PathBuf> = Vec::new();
    let excluded_paths: Vec<PathBuf> = excluded_dirs.iter().map(PathBuf::from).collect();

    for dir_path in included_dirs {
        let p = Path::new(dir_path);
        if !p.exists() {
            continue;
        }

        let paths: Vec<PathBuf> = WalkDir::new(dir_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .filter(|e| {
                let is_flac = e
                    .path()
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_lowercase() == "flac")
                    .unwrap_or(false);
                if !is_flac {
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

        all_flac_paths.extend(paths);
    }

    all_flac_paths.sort();
    all_flac_paths.dedup();

    all_flac_paths
        .into_par_iter()
        .filter_map(|path| parse_flac_file(&path))
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
