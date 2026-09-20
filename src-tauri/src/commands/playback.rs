use crate::audio::{self, GlobalAudioEngine};
use crate::commands::media::MediaControlState;
use souvlaki::MediaPlayback;
use tauri::State;

#[tauri::command]
pub fn play_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
    path: String,
    replay_gain_db: Option<f32>,
    start_position_secs: Option<f64>,
    crossfade_secs: Option<f32>,
) -> Result<(), String> {
    let gain = replay_gain_db.unwrap_or(0.0);
    audio_engine.play(path, gain, start_position_secs, crossfade_secs)?;
    if let Ok(mut guard) = controls_state.0.try_lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn pause_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
) {
    audio_engine.pause();
    if let Ok(mut guard) = controls_state.0.try_lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Paused { progress: None });
        }
    }
}

#[tauri::command]
pub fn resume_audio(
    audio_engine: State<'_, GlobalAudioEngine>,
    controls_state: State<'_, MediaControlState>,
) {
    audio_engine.resume();
    if let Ok(mut guard) = controls_state.0.try_lock() {
        if let Some(controls) = guard.as_mut() {
            let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        }
    }
}

#[tauri::command]
pub fn seek_audio(audio_engine: State<'_, GlobalAudioEngine>, position_secs: f64) {
    audio_engine.seek(position_secs);
}

#[tauri::command]
pub fn set_volume(audio_engine: State<'_, GlobalAudioEngine>, volume: f32) {
    audio_engine.set_volume(volume);
}

#[tauri::command]
pub fn set_replay_gain(audio_engine: State<'_, GlobalAudioEngine>, gain_db: f32) {
    audio_engine.set_replay_gain(gain_db);
}

#[tauri::command]
pub fn get_playback_position(audio_engine: State<'_, GlobalAudioEngine>) -> (f64, f64) {
    let pos = audio_engine.current_position_ms.load(std::sync::atomic::Ordering::Relaxed) as f64 / 1000.0;
    let dur = audio_engine.current_duration_ms.load(std::sync::atomic::Ordering::Relaxed) as f64 / 1000.0;
    (pos, dur)
}

#[tauri::command]
pub async fn get_audio_output_details(
    audio_engine: State<'_, GlobalAudioEngine>,
    force_refresh: Option<bool>,
) -> Result<audio::AudioOutputDetails, String> {
    let engine = audio_engine.inner().clone();
    let force = force_refresh.unwrap_or(false);
    tokio::task::spawn_blocking(move || engine.get_output_details(force))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn set_audio_output_device(
    audio_engine: State<'_, GlobalAudioEngine>,
    device_name: Option<String>,
) {
    audio_engine.set_output_device(device_name);
}
