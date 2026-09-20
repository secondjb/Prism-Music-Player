use crate::metadata::load_library_from_disk;
use rayon::prelude::*;
use tauri::{AppHandle, Manager};

#[derive(Debug, serde::Deserialize)]
pub struct FilterParams {
    pub artist: Option<String>,
    pub genre: Option<String>,
    pub min_year: Option<u32>,
    pub max_year: Option<u32>,
    pub decades: Option<Vec<String>>,
    pub min_bitrate_kbps: Option<u32>,
    pub max_bitrate_kbps: Option<u32>,
    pub sample_rate: Option<u32>,
    pub sample_rates: Option<Vec<u32>>,
    pub key: Option<String>,
    pub min_bpm: Option<u32>,
    pub max_bpm: Option<u32>,
    pub query: Option<String>,
    pub lyrics_types: Option<Vec<String>>,
    pub lyrics_match_mode: Option<String>,
}

#[tauri::command]
pub async fn filter_tracks(app_handle: AppHandle, params: FilterParams) -> Result<Vec<String>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        let tracks = load_library_from_disk(&app_data_dir).unwrap_or_default();

        let artist_query = params.artist.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
        let genre_query = params.genre.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
        let key_query = params.key.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
        let text_query = params.query.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());

        let matching_ids: Vec<String> = tracks
            .into_par_iter()
            .filter(|t| {
                if let Some(ref aq) = artist_query {
                    if !t.artist.to_lowercase().contains(aq) {
                        return false;
                    }
                }

                if let Some(ref gq) = genre_query {
                    match &t.genre {
                        Some(g) if g.to_lowercase().contains(gq) => {}
                        _ => return false,
                    }
                }

                if let Some(ref dec_list) = params.decades {
                    if !dec_list.is_empty() {
                        match t.year {
                            Some(y) => {
                                let matches_decade = dec_list.iter().any(|d| match d.as_str() {
                                    "1970s" => (1970..=1979).contains(&y),
                                    "1980s" => (1980..=1989).contains(&y),
                                    "1990s" => (1990..=1999).contains(&y),
                                    "2000s" => (2000..=2009).contains(&y),
                                    "2010s" => (2010..=2019).contains(&y),
                                    "2020s" => (2020..=2029).contains(&y),
                                    _ => false,
                                });
                                if !matches_decade {
                                    return false;
                                }
                            }
                            None => return false,
                        }
                    }
                }

                if let Some(min_y) = params.min_year {
                    match t.year {
                        Some(y) if y >= min_y => {}
                        _ => return false,
                    }
                }

                if let Some(max_y) = params.max_year {
                    match t.year {
                        Some(y) if y <= max_y => {}
                        _ => return false,
                    }
                }

                if let Some(min_b) = params.min_bitrate_kbps {
                    match t.bit_rate_kbps {
                        Some(b) if b >= min_b => {}
                        _ => return false,
                    }
                }

                if let Some(max_b) = params.max_bitrate_kbps {
                    match t.bit_rate_kbps {
                        Some(b) if b <= max_b => {}
                        _ => return false,
                    }
                }

                if let Some(ref sr_list) = params.sample_rates {
                    if !sr_list.is_empty() && !sr_list.contains(&t.sample_rate) {
                        return false;
                    }
                }

                if let Some(sr) = params.sample_rate {
                    if t.sample_rate != sr {
                        return false;
                    }
                }

                if let Some(ref kq) = key_query {
                    match &t.key {
                        Some(k) if k.to_lowercase().contains(kq) => {}
                        _ => return false,
                    }
                }

                if let Some(min_bpm) = params.min_bpm {
                    match t.bpm {
                        Some(b) if b >= min_bpm => {}
                        _ => return false,
                    }
                }

                if let Some(max_bpm) = params.max_bpm {
                    match t.bpm {
                        Some(b) if b <= max_bpm => {}
                        _ => return false,
                    }
                }

                if let Some(ref tq) = text_query {
                    let in_title = t.title.to_lowercase().contains(tq);
                    let in_artist = t.artist.to_lowercase().contains(tq);
                    let in_album = t.album.to_lowercase().contains(tq);
                    let in_genre = t.genre.as_ref().map(|g| g.to_lowercase().contains(tq)).unwrap_or(false);
                    if !in_title && !in_artist && !in_album && !in_genre {
                        return false;
                    }
                }

                if let Some(ref types) = params.lyrics_types {
                    if !types.is_empty() {
                        let lyrics = t.unsynced_lyrics.as_deref().unwrap_or("");
                        let has_synced = lyrics.contains('[') && lyrics.lines().any(|l| {
                            let trimmed = l.trim_start();
                            trimmed.starts_with('[') && trimmed.chars().skip(1).take(2).all(|c| c.is_ascii_digit())
                        });
                        let has_word_sync = lyrics.contains('<') && lyrics.lines().any(|l| {
                            l.contains('<') && l.contains('>')
                        });
                        let has_translation = lyrics.contains(" // ") || lyrics.contains(" / ") || lyrics.contains(" | ");
                        let has_unsynced = !lyrics.trim().is_empty() && !has_synced;

                        let is_match = |typ: &str| -> bool {
                            match typ {
                                "translation" => has_translation,
                                "wordSynced" => has_word_sync,
                                "synced" => has_synced,
                                "unsynced" => has_unsynced,
                                _ => true,
                            }
                        };

                        let match_all = params.lyrics_match_mode.as_deref().unwrap_or("all") == "all";
                        let satisfies = if match_all {
                            types.iter().all(|typ| is_match(typ))
                        } else {
                            types.iter().any(|typ| is_match(typ))
                        };

                        if !satisfies {
                            return false;
                        }
                    }
                }

                true
            })
            .map(|t| t.id)
            .collect();

        Ok(matching_ids)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}
