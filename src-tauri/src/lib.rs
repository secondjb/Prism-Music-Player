mod audio;
mod metadata;
mod stats;

use audio::GlobalAudioEngine;
use metadata::{
    extract_track_art, extract_track_lyrics, load_library_from_disk, save_library_to_disk,
    scan_configured_directories, scan_directory_for_tracks, TrackMetadata,
};
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State, Emitter};
use souvlaki::{MediaControlEvent, MediaControls, MediaPlayback, PlatformConfig};
use std::sync::Mutex;

struct MediaControlState(Mutex<Option<MediaControls>>);

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    eprintln!("C++ __cxa_pure_virtual called");
}

#[tauri::command]
fn scan_directory(app_handle: AppHandle, dir_path: String) -> Result<Vec<TrackMetadata>, String> {
    let tracks = scan_directory_for_tracks(&dir_path);
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let _ = save_library_to_disk(&app_data_dir, &tracks);
    }
    Ok(tracks)
}

#[tauri::command]
fn scan_libraries(
    app_handle: AppHandle,
    included_dirs: Vec<String>,
    excluded_dirs: Vec<String>,
) -> Result<Vec<TrackMetadata>, String> {
    let tracks = scan_configured_directories(&included_dirs, &excluded_dirs);
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let _ = save_library_to_disk(&app_data_dir, &tracks);
    }
    Ok(tracks)
}

#[tauri::command]
fn scan_sample_folder() -> Vec<TrackMetadata> {
    let mut path = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("Sample Music Folder");

    if !path.exists() {
        path = PathBuf::from("./Sample Music Folder");
    }

    if path.exists() {
        scan_directory_for_tracks(&path.to_string_lossy())
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn save_library(app_handle: AppHandle, tracks: Vec<TrackMetadata>) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    save_library_to_disk(&app_data_dir, &tracks)
}

#[tauri::command]
fn load_library(app_handle: AppHandle) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    load_library_from_disk(&app_data_dir)
}

#[tauri::command]
fn get_track_art(path: String) -> Option<String> {
    extract_track_art(&path)
}

#[tauri::command]
fn get_track_lyrics(path: String) -> Option<String> {
    extract_track_lyrics(&path)
}

#[tauri::command]
fn embed_lyrics(path: String, lyrics: String) -> Result<(), String> {
    metadata::embed_track_lyrics(&path, &lyrics)
}

#[tauri::command]
fn play_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
    path: String,
    replay_gain_db: Option<f32>,
    start_position_secs: Option<f64>,
) -> Result<(), String> {
    let gain = replay_gain_db.unwrap_or(0.0);
    audio_engine.play(path, gain, start_position_secs)?;
    if let Ok(mut guard) = controls_state.0.lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        }
    }
    Ok(())
}

#[tauri::command]
fn pause_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
) {
    audio_engine.pause();
    if let Ok(mut guard) = controls_state.0.lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Paused { progress: None });
        }
    }
}

#[tauri::command]
fn resume_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
) {
    audio_engine.resume();
    if let Ok(mut guard) = controls_state.0.lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        }
    }
}

#[tauri::command]
fn update_media_controls_playback(
    controls_state: State<'_, MediaControlState>,
    is_playing: bool,
) {
    if let Ok(mut guard) = controls_state.0.lock() {
        if let Some(controls) = guard.as_mut() {
            let playback = if is_playing {
                MediaPlayback::Playing { progress: None }
            } else {
                MediaPlayback::Paused { progress: None }
            };
            let _ = controls.set_playback(playback);
        }
    }
}

#[tauri::command]
fn update_media_controls_metadata(
    controls_state: State<'_, MediaControlState>,
    title: String,
    artist: String,
    album: String,
    duration_secs: Option<f64>,
) {
    if let Ok(mut guard) = controls_state.0.lock() {
        if let Some(controls) = guard.as_mut() {
            let duration = duration_secs.map(std::time::Duration::from_secs_f64);
            let metadata = souvlaki::MediaMetadata {
                title: Some(&title),
                artist: Some(&artist),
                album: Some(&album),
                cover_url: None,
                duration,
            };
            let _ = controls.set_metadata(metadata);
        }
    }
}

#[tauri::command]
fn seek_audio(audio_engine: State<'_, GlobalAudioEngine>, position_secs: f64) {
    audio_engine.seek(position_secs);
}

#[tauri::command]
fn set_volume(audio_engine: State<'_, GlobalAudioEngine>, volume: f32) {
    audio_engine.set_volume(volume);
}

#[tauri::command]
fn get_playback_position(audio_engine: State<'_, GlobalAudioEngine>) -> (f64, f64) {
    audio_engine.get_position()
}

#[tauri::command]
fn get_audio_output_details(
    audio_engine: State<'_, GlobalAudioEngine>,
) -> Result<audio::AudioOutputDetails, String> {
    audio_engine.get_output_details()
}

#[tauri::command]
fn set_audio_output_device(
    audio_engine: State<'_, GlobalAudioEngine>,
    device_name: Option<String>,
) {
    audio_engine.set_output_device(device_name);
}

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
}

#[tauri::command]
fn filter_tracks(app_handle: AppHandle, params: FilterParams) -> Result<Vec<String>, String> {
    use rayon::prelude::*;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

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

            true
        })
        .map(|t| t.id)
        .collect();

    Ok(matching_ids)
}


mod audio_analysis;

#[derive(Clone, serde::Serialize)]
struct AudioAnalysisProgress {
    current: usize,
    total: usize,
    track_id: String,
    bpm: Option<u32>,
    key: Option<String>,
}

#[tauri::command]
async fn analyze_track_audio(path: String) -> Result<audio_analysis::AudioAnalysisResult, String> {
    let path_buf = std::path::PathBuf::from(path);

    let result = tokio::task::spawn_blocking(move || {
        audio_analysis::analyze_audio_waveform(&path_buf)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
async fn analyze_library_audio(app_handle: AppHandle, paths: Vec<String>) -> Result<(), String> {
    use rayon::prelude::*;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let mut tracks = load_library_from_disk(&app_data_dir).unwrap_or_default();

    let tasks: Vec<(usize, String, String)> = paths
        .into_iter()
        .filter_map(|path| {
            tracks.iter().position(|t| t.path == path).and_then(|idx| {
                let t = &tracks[idx];
                // Only process tracks missing BPM or Key
                if t.bpm.is_none() || t.key.is_none() {
                    Some((idx, path, t.id.clone()))
                } else {
                    None
                }
            })
        })
        .collect();

    let total = tasks.len();
    if total == 0 {
        let _ = app_handle.emit("audio_analysis_completed", tracks);
        return Ok(());
    }

    let processed_count = std::sync::atomic::AtomicUsize::new(0);
    let handle = app_handle.clone();

    // Parallel processing across all CPU cores using Rayon par_iter()
    let results: Vec<(usize, String, Option<u32>, Option<String>)> = tokio::task::spawn_blocking(move || {
        tasks
            .into_par_iter()
            .map(|(idx, path, track_id)| {
                let path_buf = std::path::PathBuf::from(&path);
                let analysis = if path_buf.exists() {
                    audio_analysis::analyze_audio_waveform(&path_buf)
                } else {
                    audio_analysis::AudioAnalysisResult { bpm: None, key: None }
                };

                let c = processed_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                let _ = handle.emit(
                    "audio_analysis_progress",
                    AudioAnalysisProgress {
                        current: c,
                        total,
                        track_id: track_id.clone(),
                        bpm: analysis.bpm,
                        key: analysis.key.clone(),
                    },
                );

                (idx, track_id, analysis.bpm, analysis.key)
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?;

    for (idx, _track_id, bpm, key) in results {
        if let Some(track) = tracks.get_mut(idx) {
            if let Some(b) = bpm { track.bpm = Some(b); }
            if let Some(k) = key { track.key = Some(k); }
        }
    }

    let _ = save_library_to_disk(&app_data_dir, &tracks);
    let _ = app_handle.emit("audio_analysis_completed", tracks);

    Ok(())
}

#[tauri::command]
fn clear_library_audio_analysis(app_handle: AppHandle) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let mut tracks = load_library_from_disk(&app_data_dir).unwrap_or_default();
    for track in &mut tracks {
        track.bpm = None;
        track.key = None;
    }

    save_library_to_disk(&app_data_dir, &tracks)?;
    Ok(tracks)
}

#[derive(Clone, serde::Serialize)]
pub struct TurboAnalysisProgressPayload {
    pub path: String,
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

#[tauri::command]
async fn analyze_library_batch_turbo(
    paths: Vec<String>,
    window: tauri::Window,
) -> Result<(), String> {
    use futures::StreamExt;

    if paths.is_empty() {
        return Ok(());
    }

    let concurrency = num_cpus::get();

    futures::stream::iter(paths.into_iter().map(|path_str| {
        tokio::task::spawn_blocking(move || {
            let path_buf = std::path::PathBuf::from(&path_str);
            let result = if path_buf.exists() {
                audio_analysis::analyze_audio_waveform(&path_buf)
            } else {
                audio_analysis::AudioAnalysisResult { bpm: None, key: None }
            };
            (path_str, result)
        })
    }))
    .buffer_unordered(concurrency)
    .for_each(|join_res| {
        let window = window.clone();
        async move {
            let (path, result) = match join_res {
                Ok(res) => res,
                Err(_) => (String::new(), audio_analysis::AudioAnalysisResult { bpm: None, key: None }),
            };

            if !path.is_empty() {
                let _ = window.emit(
                    "analysis-progress",
                    TurboAnalysisProgressPayload {
                        path,
                        bpm: result.bpm,
                        key: result.key,
                    },
                );
            }
        }
    })
    .await;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = GlobalAudioEngine::new();

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            #[cfg(desktop)]
            {
                #[cfg(target_os = "windows")]
                let hwnd = app.get_webview_window("main").and_then(|w| w.hwnd().ok()).map(|h| h.0 as *mut std::ffi::c_void);
                #[cfg(not(target_os = "windows"))]
                let hwnd = None;

                let config = PlatformConfig {
                    dbus_name: "prism_music_player",
                    display_name: "Prism Music Player",
                    hwnd,
                };

                if let Ok(mut controls) = MediaControls::new(config) {
                    if controls.attach(move |event| {
                        let event_name = match event {
                            MediaControlEvent::Play => "play",
                            MediaControlEvent::Pause => "pause",
                            MediaControlEvent::Toggle => "toggle",
                            MediaControlEvent::Next => "next",
                            MediaControlEvent::Previous => "previous",
                            _ => return,
                        };
                        let _ = app_handle.emit("media-control", event_name);
                    }).is_ok() {
                        let _ = controls.set_playback(MediaPlayback::Stopped);
                        app.manage(MediaControlState(Mutex::new(Some(controls))));
                    } else {
                        app.manage(MediaControlState(Mutex::new(None)));
                    }
                } else {
                    app.manage(MediaControlState(Mutex::new(None)));
                }
            }

            #[cfg(not(desktop))]
            {
                app.manage(MediaControlState(Mutex::new(None)));
            }

            stats::init_db(&app.handle());
            Ok(())
        })
        .manage(engine)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            scan_libraries,
            scan_sample_folder,
            save_library,
            load_library,
            get_track_art,
            get_track_lyrics,
            embed_lyrics,
            play_audio,
            pause_audio,
            resume_audio,
            update_media_controls_playback,
            update_media_controls_metadata,
            seek_audio,
            set_volume,
            get_playback_position,
            get_audio_output_details,
            set_audio_output_device,
            filter_tracks,
            analyze_library_audio,
            clear_library_audio_analysis,
            analyze_library_batch_turbo,
            analyze_track_audio,
            stats::log_listening_event,
            stats::fetch_listening_events,
            stats::delete_listening_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
