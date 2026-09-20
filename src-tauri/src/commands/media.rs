use souvlaki::{MediaControls, MediaPlayback};
use std::sync::Mutex;
use tauri::State;

pub struct MediaControlState(pub Mutex<Option<MediaControls>>);

#[tauri::command]
pub fn update_media_controls_playback(
    controls_state: State<'_, MediaControlState>,
    is_playing: bool,
) {
    #[cfg(target_os = "windows")]
    {
        crate::taskbar::update_taskbar_play_state(is_playing);
    }

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
pub fn set_taskbar_playback_state(is_playing: bool) {
    #[cfg(target_os = "windows")]
    {
        crate::taskbar::set_taskbar_playback_state(is_playing);
    }
}

#[tauri::command]
pub fn update_media_controls_metadata(
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
