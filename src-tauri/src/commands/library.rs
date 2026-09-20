use crate::metadata::{
    self, extract_track_art, extract_track_lyrics, load_library_from_disk, save_library_to_disk,
    scan_configured_directories, scan_directory_for_tracks, RefreshLibraryResult, TrackMetadata,
};
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn scan_directory(app_handle: AppHandle, dir_path: String) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle.path().app_data_dir().ok();
    tokio::task::spawn_blocking(move || {
        let tracks = scan_directory_for_tracks(&dir_path);
        if let Some(dir) = app_data_dir {
            let _ = save_library_to_disk(&dir, &tracks);
        }
        Ok(tracks)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn scan_libraries(
    app_handle: AppHandle,
    included_dirs: Vec<String>,
    excluded_dirs: Vec<String>,
) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle.path().app_data_dir().ok();
    tokio::task::spawn_blocking(move || {
        let tracks = scan_configured_directories(&included_dirs, &excluded_dirs);
        if let Some(dir) = app_data_dir {
            let _ = save_library_to_disk(&dir, &tracks);
        }
        Ok(tracks)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn refresh_libraries(
    app_handle: AppHandle,
    included_dirs: Vec<String>,
    excluded_dirs: Vec<String>,
) -> Result<RefreshLibraryResult, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        metadata::refresh_configured_directories(&app_data_dir, &included_dirs, &excluded_dirs)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn purge_missing_tracks(
    app_handle: AppHandle,
) -> Result<RefreshLibraryResult, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        metadata::purge_missing_from_library(&app_data_dir)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn scan_sample_folder() -> Vec<TrackMetadata> {
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn save_library(app_handle: AppHandle, tracks: Vec<TrackMetadata>) -> Result<(), String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        save_library_to_disk(&app_data_dir, &tracks)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn load_library(app_handle: AppHandle) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        load_library_from_disk(&app_data_dir)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_track_art(path: String) -> Option<String> {
    tokio::task::spawn_blocking(move || extract_track_art(&path))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
pub async fn get_track_lyrics(path: String) -> Option<String> {
    tokio::task::spawn_blocking(move || extract_track_lyrics(&path))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
pub async fn embed_lyrics(path: String, lyrics: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || metadata::embed_track_lyrics(&path, &lyrics))
        .await
        .map_err(|e| format!("Task execution failed: {}", e))?
}
