mod audio;
mod metadata;

use audio::GlobalAudioEngine;
use metadata::{
    extract_track_art, extract_track_lyrics, load_library_from_disk, save_library_to_disk, scan_configured_directories,
    scan_directory_for_tracks, TrackMetadata,
};
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

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

    scan_directory_for_tracks(&path.to_string_lossy())
}

#[tauri::command]
fn save_library(app_handle: AppHandle, tracks: Vec<TrackMetadata>) -> Result<(), String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    save_library_to_disk(&app_data_dir, &tracks)
}

#[tauri::command]
fn load_library(app_handle: AppHandle) -> Result<Vec<TrackMetadata>, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
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
fn play_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    path: String,
    replay_gain_db: Option<f32>,
) -> Result<(), String> {
    let gain = replay_gain_db.unwrap_or(0.0);
    audio_engine.play(path, gain)
}

#[tauri::command]
fn pause_audio(audio_engine: State<'_, GlobalAudioEngine>) {
    audio_engine.pause();
}

#[tauri::command]
fn resume_audio(audio_engine: State<'_, GlobalAudioEngine>) {
    audio_engine.resume();
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
fn get_playback_position(audio_engine: State<'_, GlobalAudioEngine>) -> f64 {
    audio_engine.get_position()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = GlobalAudioEngine::new();

    tauri::Builder::default()
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
            play_audio,
            pause_audio,
            resume_audio,
            seek_audio,
            set_volume,
            get_playback_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
