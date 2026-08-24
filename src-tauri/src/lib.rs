mod metadata;

use metadata::{scan_directory_for_tracks, TrackMetadata};
use std::env;
use std::path::PathBuf;

#[tauri::command]
fn scan_directory(dir_path: String) -> Vec<TrackMetadata> {
    scan_directory_for_tracks(&dir_path)
}

#[tauri::command]
fn scan_sample_folder() -> Vec<TrackMetadata> {
    // Look for Sample Music Folder relative to current working directory or executable
    let mut path = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("Sample Music Folder");
    
    if !path.exists() {
        // Fall back to relative path check
        path = PathBuf::from("./Sample Music Folder");
    }
    
    scan_directory_for_tracks(&path.to_string_lossy())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_directory, scan_sample_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

