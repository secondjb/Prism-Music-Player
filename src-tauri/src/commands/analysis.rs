use crate::audio_analysis;
use crate::metadata::{load_library_from_disk, save_library_to_disk, TrackMetadata};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, serde::Serialize)]
pub struct AudioAnalysisProgress {
    pub current: usize,
    pub total: usize,
    pub track_id: String,
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

#[tauri::command]
pub async fn analyze_track_audio(path: String) -> Result<audio_analysis::AudioAnalysisResult, String> {
    let path_buf = std::path::PathBuf::from(path);

    let result = tokio::task::spawn_blocking(move || {
        audio_analysis::analyze_audio_waveform(&path_buf)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn analyze_library_audio(app_handle: AppHandle, paths: Vec<String>) -> Result<(), String> {
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

    // Parallel processing across CPU cores using Rayon par_iter()
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
pub async fn clear_library_audio_analysis(app_handle: AppHandle) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        let mut tracks = load_library_from_disk(&app_data_dir).unwrap_or_default();
        for track in &mut tracks {
            track.bpm = None;
            track.key = None;
        }

        save_library_to_disk(&app_data_dir, &tracks)?;
        Ok(tracks)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[derive(Clone, serde::Serialize)]
pub struct TurboAnalysisProgressPayload {
    pub path: String,
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

#[tauri::command]
pub async fn analyze_library_batch_turbo(
    paths: Vec<String>,
    window: tauri::Window,
) -> Result<(), String> {
    use futures::StreamExt;

    if paths.is_empty() {
        return Ok(());
    }

    let total_cores = num_cpus::get();
    let concurrency = if total_cores <= 2 { 1 } else { total_cores - 1 };

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
