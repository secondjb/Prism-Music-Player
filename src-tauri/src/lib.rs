pub mod audio;
pub mod audio_analysis;
pub mod commands;
pub mod loudness;
pub mod metadata;
pub mod stats;
#[cfg(target_os = "windows")]
pub mod taskbar;

use audio::GlobalAudioEngine;
use commands::MediaControlState;
use souvlaki::{MediaControlEvent, MediaControls, MediaPlayback, PlatformConfig};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    eprintln!("C++ __cxa_pure_virtual called");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Limit Rayon's global thread pool to leave at least 1-2 CPU cores free
    // for the OS and the frontend WebView, preventing system UI stutter.
    let total_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let rayon_threads = if total_cores <= 2 {
        1
    } else if total_cores <= 4 {
        total_cores - 1
    } else {
        total_cores - 2
    };

    if let Err(e) = rayon::ThreadPoolBuilder::new()
        .num_threads(rayon_threads)
        .thread_name(|i| format!("prism-rayon-{}", i))
        .build_global()
    {
        eprintln!("[Rayon] Global thread pool initialization: {}", e);
    }

    let engine = GlobalAudioEngine::new();
    let engine_warm = engine.clone();

    tauri::Builder::default()
        .setup(move |app| {
            let app_handle = app.handle().clone();

            #[cfg(desktop)]
            {
                #[cfg(target_os = "windows")]
                let raw_hwnd = app
                    .get_webview_window("main")
                    .or_else(|| app.webview_windows().values().next().cloned())
                    .and_then(|w| w.hwnd().ok())
                    .map(|h| h.0 as isize);

                #[cfg(target_os = "windows")]
                if let Some(hwnd_val) = raw_hwnd {
                    let taskbar_app = app.handle().clone();
                    if let Err(e) = taskbar::init_taskbar(&taskbar_app, hwnd_val) {
                        eprintln!("[Taskbar] Failed to initialize thumbnail buttons: {}", e);
                    }
                }

                #[cfg(target_os = "windows")]
                let controls_opt = if let Some(h) = raw_hwnd {
                    let config = PlatformConfig {
                        dbus_name: "prism_music_player",
                        display_name: "Prism Music Player",
                        hwnd: Some(h as *mut std::ffi::c_void),
                    };
                    MediaControls::new(config).ok()
                } else {
                    None
                };

                #[cfg(not(target_os = "windows"))]
                let controls_opt = {
                    let config = PlatformConfig {
                        dbus_name: "prism_music_player",
                        display_name: "Prism Music Player",
                        hwnd: None,
                    };
                    MediaControls::new(config).ok()
                };

                if let Some(mut controls) = controls_opt {
                    if controls
                        .attach(move |event| {
                            let event_name = match event {
                                MediaControlEvent::Play => "play",
                                MediaControlEvent::Pause => "pause",
                                MediaControlEvent::Toggle => "toggle",
                                MediaControlEvent::Next => "next",
                                MediaControlEvent::Previous => "previous",
                                _ => return,
                            };
                            let _ = app_handle.emit("media-control", event_name);
                        })
                        .is_ok()
                    {
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

            #[cfg(debug_assertions)]
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.open_devtools();
                }
            }

            // Pre-warm audio devices cache asynchronously on startup so device modal opens instantly (<1ms)
            std::thread::spawn(move || {
                let _ = engine_warm.get_output_details(false);
            });

            Ok(())
        })
        .manage(engine)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::scan_libraries,
            commands::refresh_libraries,
            commands::purge_missing_tracks,
            commands::scan_sample_folder,
            commands::save_library,
            commands::load_library,
            commands::load_library_chunk,
            commands::get_track_art,
            commands::get_track_lyrics,
            commands::embed_lyrics,
            commands::play_audio,
            commands::pause_audio,
            commands::resume_audio,
            commands::update_media_controls_playback,
            commands::set_taskbar_playback_state,
            commands::update_media_controls_metadata,
            commands::seek_audio,
            commands::set_volume,
            commands::set_replay_gain,
            commands::get_playback_position,
            commands::get_audio_output_details,
            commands::set_audio_output_device,
            commands::filter_tracks,
            commands::analyze_library_audio,
            commands::clear_library_audio_analysis,
            commands::analyze_library_batch_turbo,
            commands::analyze_track_audio,
            commands::scan_replaygain_batch,
            commands::cancel_replaygain_scan,
            commands::calculate_single_track_gain,
            stats::log_listening_event,
            stats::fetch_listening_events,
            stats::delete_listening_history,
            log_frontend_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn log_frontend_message(level: String, message: String) {
    eprintln!("[Frontend:{}] {}", level, message);
}

