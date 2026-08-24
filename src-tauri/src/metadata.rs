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

        for key in &["LYRICS", "UNSYNCEDLYRICS", "UNSYNCED LYRICS", "LYRIC"] {
            if let Some(val) = c.get(key) {
                if let Some(l) = val.first() {
                    if !l.trim().is_empty() {
                        unsynced_lyrics = Some(l.clone());
                        break;
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

    let mut embedded_art_base64 = None;
    for pic in tag.pictures() {
        // Cap artwork payload size to max 250KB per track to prevent IPC freezing on 1000+ tracks
        if pic.data.len() <= 350_000 {
            let mime = if pic.mime_type.is_empty() {
                "image/jpeg".to_string()
            } else {
                pic.mime_type.clone()
            };
            let encoded = STANDARD.encode(&pic.data);
            embedded_art_base64 = Some(format!("data:{};base64,{}", mime, encoded));
        }
        break;
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
        replay_gain_db,
        replay_gain_peak,
        embedded_art_base64,
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

pub fn scan_directory_for_tracks(dir_path: &str) -> Vec<TrackMetadata> {
    let flac_paths: Vec<PathBuf> = WalkDir::new(dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.to_string_lossy().to_lowercase() == "flac")
                .unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect();

    // Parallel processing using Rayon multi-threading
    flac_paths
        .into_par_iter()
        .filter_map(|path| parse_flac_file(&path))
        .collect()
}
