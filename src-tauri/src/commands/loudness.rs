use crate::loudness;
use tauri::AppHandle;

#[tauri::command]
pub async fn scan_replaygain_batch(
    app_handle: AppHandle,
    track_paths: Vec<String>,
    write_to_files: bool,
) -> Result<Vec<loudness::TrackLoudnessResult>, String> {
    tokio::task::spawn_blocking(move || {
        loudness::scan_replaygain_batch(app_handle, track_paths, write_to_files)
    })
    .await
    .map_err(|e| format!("Loudness scan failed: {}", e))
}

#[tauri::command]
pub fn cancel_replaygain_scan() {
    loudness::cancel_replaygain_scan();
}

#[tauri::command]
pub async fn calculate_single_track_gain(
    path: String,
    write_to_file: bool,
) -> Result<loudness::TrackLoudnessResult, String> {
    tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        match loudness::analyze_track_replaygain(p) {
            Ok((gain, peak)) => {
                if write_to_file {
                    let _ = loudness::write_replaygain_to_file(&path, gain, peak);
                }
                Ok(loudness::TrackLoudnessResult {
                    path: path.clone(),
                    replay_gain_db: Some(gain),
                    replay_gain_peak: Some(peak),
                    error: None,
                })
            }
            Err(e) => Ok(loudness::TrackLoudnessResult {
                path: path.clone(),
                replay_gain_db: None,
                replay_gain_peak: None,
                error: Some(e),
            }),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
