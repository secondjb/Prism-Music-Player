mod audio;
mod metadata;

use audio::GlobalAudioEngine;
use metadata::{scan_directory_for_tracks, TrackMetadata};
use std::env;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
fn scan_directory(dir_path: String) -> Vec<TrackMetadata> {
    scan_directory_for_tracks(&dir_path)
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
fn play_audio(audio_engine: State<'_, GlobalAudioEngine>, path: String, replay_gain_db: Option<f32>) -> Result<(), String> {
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
            scan_sample_folder,
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


