use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use parking_lot::Mutex;
use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
    pub is_active: bool,
    pub default_sample_rate: u32,
    pub default_channels: u16,
    pub default_format: String,
    pub min_sample_rate: u32,
    pub max_sample_rate: u32,
    pub supported_channels: Vec<u16>,
    pub supported_formats: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioOutputDetails {
    pub devices: Vec<AudioDeviceInfo>,
    pub active_device_name: String,
    pub active_sample_rate: u32,
    pub active_channels: u16,
    pub active_format: String,
    pub is_playing: bool,
}

pub struct AudioPlayerState {
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<Mutex<f32>>,
    pub replay_gain_db: Arc<Mutex<f32>>,
    pub seek_secs: Arc<Mutex<Option<f64>>>,
    pub current_position_secs: Arc<Mutex<f64>>,
    pub current_duration_secs: Arc<Mutex<f64>>,
    pub stop_signal: Arc<AtomicBool>,
    pub selected_device_name: Arc<Mutex<Option<String>>>,
    pub active_device_name: Arc<Mutex<String>>,
    pub active_sample_rate: Arc<Mutex<u32>>,
    pub active_channels: Arc<Mutex<u16>>,
    pub active_format: Arc<Mutex<String>>,
    pub device_switch_requested: Arc<AtomicBool>,
    pub device_caps_cache: Arc<Mutex<std::collections::HashMap<String, (u32, u32, Vec<u16>, Vec<String>)>>>,
    pub cached_devices: Arc<Mutex<Option<(std::time::Instant, Vec<AudioDeviceInfo>)>>>,
}

impl AudioPlayerState {
    pub fn new() -> Self {
        Self {
            is_playing: Arc::new(AtomicBool::new(false)),
            volume: Arc::new(Mutex::new(0.8)),
            replay_gain_db: Arc::new(Mutex::new(0.0)),
            seek_secs: Arc::new(Mutex::new(None)),
            current_position_secs: Arc::new(Mutex::new(0.0)),
            current_duration_secs: Arc::new(Mutex::new(0.0)),
            stop_signal: Arc::new(AtomicBool::new(false)),
            selected_device_name: Arc::new(Mutex::new(None)),
            active_device_name: Arc::new(Mutex::new(String::new())),
            active_sample_rate: Arc::new(Mutex::new(0)),
            active_channels: Arc::new(Mutex::new(0)),
            active_format: Arc::new(Mutex::new(String::new())),
            device_switch_requested: Arc::new(AtomicBool::new(false)),
            device_caps_cache: Arc::new(Mutex::new(std::collections::HashMap::new())),
            cached_devices: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Clone)]
pub struct GlobalAudioEngine {
    pub state: Arc<Mutex<AudioPlayerState>>,
    pub thread_handle: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
}

unsafe impl Send for GlobalAudioEngine {}
unsafe impl Sync for GlobalAudioEngine {}

impl GlobalAudioEngine {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(AudioPlayerState::new())),
            thread_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn play(
        &self,
        file_path: String,
        replay_gain_db: f32,
        start_position_secs: Option<f64>,
    ) -> Result<(), String> {
        let state_guard = self.state.lock();

        // Signal existing thread to stop
        state_guard.stop_signal.store(true, Ordering::SeqCst);

        // Join existing thread to release WASAPI audio output device cleanly
        if let Some(handle) = self.thread_handle.lock().take() {
            let _ = handle.join();
        }

        let stop_signal = Arc::new(AtomicBool::new(false));
        let is_playing = Arc::new(AtomicBool::new(true));
        let volume = Arc::clone(&state_guard.volume);
        let replay_gain = Arc::new(Mutex::new(replay_gain_db));
        let initial_seek = start_position_secs.filter(|&s| s > 0.0);
        let seek_secs = Arc::new(Mutex::new(initial_seek));
        let current_position_secs = Arc::clone(&state_guard.current_position_secs);
        let current_duration_secs = Arc::clone(&state_guard.current_duration_secs);

        *state_guard.replay_gain_db.lock() = replay_gain_db;
        *current_position_secs.lock() = initial_seek.unwrap_or(0.0);
        state_guard.is_playing.store(true, Ordering::SeqCst);

        let selected_device_name = Arc::clone(&state_guard.selected_device_name);
        let active_device_name = Arc::clone(&state_guard.active_device_name);
        let active_sample_rate = Arc::clone(&state_guard.active_sample_rate);
        let active_channels = Arc::clone(&state_guard.active_channels);
        let active_format = Arc::clone(&state_guard.active_format);
        let device_switch_requested = Arc::clone(&state_guard.device_switch_requested);

        let path_clone = file_path.clone();
        let stop_signal_clone = Arc::clone(&stop_signal);
        let is_playing_clone = Arc::clone(&is_playing);
        let volume_clone = Arc::clone(&volume);
        let replay_gain_clone = Arc::clone(&replay_gain);
        let seek_secs_clone = Arc::clone(&seek_secs);
        let position_clone = Arc::clone(&current_position_secs);
        let duration_clone = Arc::clone(&current_duration_secs);

        drop(state_guard);
        {
            let mut state_write = self.state.lock();
            state_write.stop_signal = stop_signal;
            state_write.is_playing = is_playing;
            state_write.seek_secs = seek_secs;
            state_write.replay_gain_db = replay_gain;
        }

        let handle = thread::spawn(move || {
            if let Err(e) = run_audio_thread(
                &path_clone,
                stop_signal_clone,
                is_playing_clone,
                volume_clone,
                replay_gain_clone,
                seek_secs_clone,
                position_clone,
                duration_clone,
                selected_device_name,
                active_device_name,
                active_sample_rate,
                active_channels,
                active_format,
                device_switch_requested,
            ) {
                eprintln!("Audio thread error: {}", e);
            }
        });

        *self.thread_handle.lock() = Some(handle);

        Ok(())
    }

    pub fn pause(&self) {
        let state = self.state.lock();
        state.is_playing.store(false, Ordering::SeqCst);
    }

    pub fn resume(&self) {
        let state = self.state.lock();
        state.is_playing.store(true, Ordering::SeqCst);
    }

    pub fn seek(&self, position_secs: f64) {
        let state = self.state.lock();
        *state.seek_secs.lock() = Some(position_secs);
    }

    pub fn set_volume(&self, vol: f32) {
        let state = self.state.lock();
        *state.volume.lock() = vol.clamp(0.0, 1.0);
    }

    pub fn get_position(&self) -> (f64, f64) {
        let state = self.state.lock();
        let pos = *state.current_position_secs.lock();
        let dur = *state.current_duration_secs.lock();
        (pos, dur)
    }

    pub fn get_output_details(&self, force_refresh: bool) -> Result<AudioOutputDetails, String> {
        let host = cpal::default_host();
        let state = self.state.lock();
        let is_playing = state.is_playing.load(Ordering::SeqCst);
        let active_name = state.active_device_name.lock().clone();
        let active_rate = *state.active_sample_rate.lock();
        let active_ch = *state.active_channels.lock();
        let active_fmt = state.active_format.lock().clone();
        let selected_name = state.selected_device_name.lock().clone();
        let caps_cache_arc = Arc::clone(&state.device_caps_cache);
        let cached_devices_arc = Arc::clone(&state.cached_devices);
        drop(state);

        let default_dev = host.default_output_device();
        let default_name = default_dev.as_ref().and_then(|d| d.name().ok());

        let mut cached_guard = cached_devices_arc.lock();
        let device_infos: Vec<AudioDeviceInfo> = if !force_refresh
            && cached_guard.is_some()
            && cached_guard.as_ref().unwrap().0.elapsed() < Duration::from_secs(20)
        {
            let mut list = cached_guard.as_ref().unwrap().1.clone();
            for dev in list.iter_mut() {
                dev.is_default = default_name.as_ref().map(|dn| dn == &dev.name).unwrap_or(false);
                dev.is_active = if let Some(ref sel) = selected_name {
                    sel == &dev.name
                } else if !active_name.is_empty() {
                    active_name == dev.name
                } else {
                    dev.is_default
                };
            }
            list
        } else {
            let mut list = Vec::new();
            if let Ok(devices) = host.output_devices() {
                let mut caps_cache = caps_cache_arc.lock();

                for dev in devices {
                    if let Ok(name) = dev.name() {
                        let is_default = default_name.as_ref().map(|dn| dn == &name).unwrap_or(false);
                        let is_active = if let Some(ref sel) = selected_name {
                            sel == &name
                        } else if !active_name.is_empty() {
                            active_name == name
                        } else {
                            is_default
                        };

                        let mut default_sample_rate = 48000;
                        let mut default_channels = 2;
                        let mut default_format = "F32".to_string();

                        if let Ok(cfg) = dev.default_output_config() {
                            default_sample_rate = cfg.sample_rate().0;
                            default_channels = cfg.channels();
                            default_format = format!("{:?}", cfg.sample_format());
                        }

                        // Check cache first to avoid slow synchronous COM queries on Windows
                        let (min_sample_rate, max_sample_rate, supported_channels, supported_formats) =
                            if let Some(cached) = caps_cache.get(&name) {
                                cached.clone()
                            } else {
                                let mut min_r = default_sample_rate;
                                let mut max_r = default_sample_rate;
                                let mut supported_channels_set = std::collections::BTreeSet::new();
                                let mut supported_formats_set = std::collections::BTreeSet::new();

                                if let Ok(configs) = dev.supported_output_configs() {
                                    for c in configs {
                                        let c_min = c.min_sample_rate().0;
                                        let c_max = c.max_sample_rate().0;
                                        if min_r == 0 || c_min < min_r {
                                            min_r = c_min;
                                        }
                                        if c_max > max_r {
                                            max_r = c_max;
                                        }
                                        supported_channels_set.insert(c.channels());
                                        supported_formats_set.insert(format!("{:?}", c.sample_format()));
                                    }
                                }

                                if supported_formats_set.is_empty() {
                                    supported_formats_set.insert(default_format.clone());
                                }
                                if supported_channels_set.is_empty() {
                                    supported_channels_set.insert(default_channels);
                                }

                                let entry = (
                                    min_r,
                                    max_r,
                                    supported_channels_set.into_iter().collect(),
                                    supported_formats_set.into_iter().collect(),
                                );
                                caps_cache.insert(name.clone(), entry.clone());
                                entry
                            };

                        list.push(AudioDeviceInfo {
                            name,
                            is_default,
                            is_active,
                            default_sample_rate,
                            default_channels,
                            default_format,
                            min_sample_rate,
                            max_sample_rate,
                            supported_channels,
                            supported_formats,
                        });
                    }
                }
            }
            *cached_guard = Some((std::time::Instant::now(), list.clone()));
            list
        };
        drop(cached_guard);

        let (final_active_name, final_rate, final_ch, final_fmt) = if let Some(ref sel) = selected_name {
            if let Some(d) = device_infos.iter().find(|d| &d.name == sel) {
                let rate = if active_rate > 0 {
                    active_rate
                } else if d.max_sample_rate > d.default_sample_rate {
                    d.max_sample_rate
                } else {
                    d.default_sample_rate
                };
                let ch = if active_ch > 0 { active_ch } else { d.default_channels };
                let fmt = if !active_fmt.is_empty() { active_fmt.clone() } else { d.default_format.clone() };
                (d.name.clone(), rate, ch, fmt)
            } else {
                (sel.clone(), active_rate, active_ch, active_fmt)
            }
        } else if !active_name.is_empty() {
            (active_name, active_rate, active_ch, active_fmt)
        } else if let Some(ref d) = default_dev {
            let name = d.name().unwrap_or_else(|_| "Default Device".to_string());
            if let Ok(cfg) = d.default_output_config() {
                let rate = if active_rate > 0 { active_rate } else { cfg.sample_rate().0 };
                (name, rate, cfg.channels(), format!("{:?}", cfg.sample_format()))
            } else {
                (name, 48000, 2, "F32".to_string())
            }
        } else {
            ("No Device Found".to_string(), 0, 0, "".to_string())
        };

        Ok(AudioOutputDetails {
            devices: device_infos,
            active_device_name: final_active_name,
            active_sample_rate: final_rate,
            active_channels: final_ch,
            active_format: final_fmt,
            is_playing,
        })
    }

    pub fn set_output_device(&self, device_name: Option<String>) {
        let state = self.state.lock();
        let current_sel = state.selected_device_name.lock().clone();
        if current_sel == device_name {
            return;
        }
        *state.selected_device_name.lock() = device_name.clone();
        if let Some(ref name) = device_name {
            *state.active_device_name.lock() = name.clone();
        } else {
            let host = cpal::default_host();
            if let Some(def) = host.default_output_device() {
                if let Ok(name) = def.name() {
                    *state.active_device_name.lock() = name;
                }
            }
        }

        // Synchronize in-memory cached devices active flags immediately
        let mut cached_guard = state.cached_devices.lock();
        if let Some((_, ref mut list)) = *cached_guard {
            let target = device_name.as_deref();
            for dev in list.iter_mut() {
                dev.is_active = if let Some(t) = target {
                    dev.name == t
                } else {
                    dev.is_default
                };
            }
        }
        drop(cached_guard);

        state.device_switch_requested.store(true, Ordering::SeqCst);
    }
}

fn run_audio_thread(
    path_str: &str,
    stop_signal: Arc<AtomicBool>,
    is_playing: Arc<AtomicBool>,
    volume: Arc<Mutex<f32>>,
    replay_gain_db: Arc<Mutex<f32>>,
    seek_secs: Arc<Mutex<Option<f64>>>,
    current_position_secs: Arc<Mutex<f64>>,
    current_duration_secs: Arc<Mutex<f64>>,
    selected_device_name: Arc<Mutex<Option<String>>>,
    active_device_name_out: Arc<Mutex<String>>,
    active_sample_rate_out: Arc<Mutex<u32>>,
    active_channels_out: Arc<Mutex<u16>>,
    active_format_out: Arc<Mutex<String>>,
    device_switch_requested: Arc<AtomicBool>,
) -> Result<(), String> {
    let file = File::open(Path::new(path_str))
        .map_err(|e| format!("Failed to open file '{}': {}", path_str, e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path_str).extension() {
        hint.with_extension(&ext.to_string_lossy());
    }

    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|e| format!("Unsupported format for '{}': {}", path_str, e))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No default audio track".to_string())?;

    let track_id = track.id;
    let time_base = track.codec_params.time_base;
    let input_sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let input_channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    if let Some(n_frames) = track.codec_params.n_frames {
        let duration = n_frames as f64 / input_sample_rate as f64;
        *current_duration_secs.lock() = duration;
    }

    let dec_opts: DecoderOptions = Default::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &dec_opts)
        .map_err(|e| format!("Decoder creation error: {}", e))?;

    // Helper to create stream and channel
    let create_stream_fn = || -> Result<(cpal::Stream, crossbeam_channel::Sender<f32>, Arc<AtomicBool>, String, u32, usize), String> {
        let host = cpal::default_host();
        let device = match selected_device_name.lock().as_ref() {
            Some(sel_name) => {
                let mut matched = None;
                if let Ok(devices) = host.output_devices() {
                    for d in devices {
                        if let Ok(name) = d.name() {
                            if &name == sel_name {
                                matched = Some(d);
                                break;
                            }
                        }
                    }
                }
                matched.or_else(|| host.default_output_device())
            }
            None => host.default_output_device(),
        }.ok_or_else(|| "No output audio device found".to_string())?;

        let dev_name = device.name().unwrap_or_else(|_| "Default Device".to_string());

        let default_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;

        // Check if device natively supports the track's sample rate (e.g. 192000, 96000, 44100) for bit-perfect output
        let mut candidate_configs = Vec::new();
        if let Ok(configs) = device.supported_output_configs() {
            for c in configs {
                if c.min_sample_rate().0 <= input_sample_rate && input_sample_rate <= c.max_sample_rate().0 {
                    let cfg = c.with_sample_rate(cpal::SampleRate(input_sample_rate));
                    candidate_configs.push(cfg);
                }
            }
        }

        // Helper to attempt building stream with a given config
        let build_stream_with = |cfg: &cpal::SupportedStreamConfig| -> Result<(cpal::Stream, crossbeam_channel::Sender<f32>, Arc<AtomicBool>, u32, usize, String), String> {
            let target_sample_rate = cfg.sample_rate().0;
            let target_channels = cfg.channels() as usize;
            let stream_config: StreamConfig = cfg.clone().into();
            let sample_format = cfg.sample_format();
            let format_str = format!("{:?}", sample_format);

            let ring_buffer_capacity = (target_sample_rate as usize * target_channels / 10).max(8192);
            let (tx, rx) = crossbeam_channel::bounded::<f32>(ring_buffer_capacity);

            let device_changed = Arc::new(AtomicBool::new(false));
            let dc_clone = Arc::clone(&device_changed);

            let err_fn = move |err| {
                eprintln!("CPAL Stream error: {}", err);
                dc_clone.store(true, Ordering::SeqCst);
            };

            let stream = match sample_format {
                SampleFormat::F32 => device.build_output_stream(
                    &stream_config,
                    move |data: &mut [f32], _| {
                        for sample in data.iter_mut() {
                            *sample = rx.try_recv().unwrap_or(0.0);
                        }
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::I16 => device.build_output_stream(
                    &stream_config,
                    move |data: &mut [i16], _| {
                        for sample in data.iter_mut() {
                            let f_sample = rx.try_recv().unwrap_or(0.0);
                            *sample = (f_sample * i16::MAX as f32) as i16;
                        }
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::U16 => device.build_output_stream(
                    &stream_config,
                    move |data: &mut [u16], _| {
                        for sample in data.iter_mut() {
                            let f_sample = rx.try_recv().unwrap_or(0.0);
                            *sample = ((f_sample + 1.0) * 0.5 * u16::MAX as f32) as u16;
                        }
                    },
                    err_fn,
                    None,
                ),
                _ => return Err("Unsupported sample format".into()),
            }.map_err(|e| format!("Failed to build output stream: {}", e))?;

            stream.play().map_err(|e| format!("Failed to play audio stream: {}", e))?;
            Ok((stream, tx, device_changed, target_sample_rate, target_channels, format_str))
        };

        // Try candidate matching input_sample_rate first for Bit-Perfect Direct playback
        let mut stream_result = None;
        for cfg in &candidate_configs {
            if let Ok(res) = build_stream_with(cfg) {
                println!(
                    "Configured Bit-Perfect Direct stream at {} kHz on device '{}'",
                    cfg.sample_rate().0 as f32 / 1000.0,
                    dev_name
                );
                stream_result = Some(res);
                break;
            }
        }

        // Fall back to default config if matching failed
        let (stream, tx, device_changed, target_sample_rate, target_channels, active_fmt_str) = match stream_result {
            Some(res) => res,
            None => build_stream_with(&default_config)?,
        };

        *active_device_name_out.lock() = dev_name.clone();
        *active_sample_rate_out.lock() = target_sample_rate;
        *active_channels_out.lock() = target_channels as u16;
        *active_format_out.lock() = active_fmt_str;

        stream.play().map_err(|e| format!("Failed to play audio stream: {}", e))?;

        Ok((stream, tx, device_changed, dev_name, target_sample_rate, target_channels))
    };

    let (init_stream, mut tx, mut device_changed, mut active_device_name, mut target_sample_rate, mut target_channels) = create_stream_fn()?;
    let mut stream_opt = Some(init_stream);

    let mut sample_buf = None;
    let mut last_device_check = std::time::Instant::now();

    loop {
        // Periodically (every 200ms) check if OS default device changed when in default mode
        let manual_switch = device_switch_requested.swap(false, Ordering::SeqCst);
        let mut need_device_switch = device_changed.load(Ordering::SeqCst) || manual_switch;
        if !need_device_switch && selected_device_name.lock().is_none() && last_device_check.elapsed() >= Duration::from_millis(200) {
            last_device_check = std::time::Instant::now();
            if let Some(def_dev) = cpal::default_host().default_output_device() {
                if let Ok(name) = def_dev.name() {
                    if name != active_device_name {
                        println!(
                            "Default OS audio device changed from '{}' to '{}'",
                            active_device_name, name
                        );
                        need_device_switch = true;
                    }
                }
            }
        }

        if need_device_switch {
            println!("Audio device change detected! Migrating WASAPI stream...");
            // Drain any intermediate spam clicks so we migrate directly to the latest chosen device!
            loop {
                device_switch_requested.store(false, Ordering::SeqCst);
                let current_target = selected_device_name.lock().clone();

                stream_opt = None;
                thread::sleep(Duration::from_millis(20));

                match create_stream_fn() {
                    Ok((new_stream, new_tx, new_dc, new_name, new_rate, new_ch)) => {
                        stream_opt = Some(new_stream);
                        tx = new_tx;
                        device_changed = new_dc;
                        active_device_name = new_name;
                        target_sample_rate = new_rate;
                        target_channels = new_ch;

                        let latest_target = selected_device_name.lock().clone();
                        if latest_target != current_target {
                            // User clicked another device while this one was initializing; loop immediately!
                            continue;
                        }
                        println!(
                            "Successfully migrated audio stream to device: {}",
                            active_device_name
                        );
                        break;
                    }
                    Err(e) => {
                        eprintln!("Failed to recreate stream after device change: {}", e);
                        break;
                    }
                }
            }
        }

        if stop_signal.load(Ordering::SeqCst) {
            break;
        }

        if let Some(target_secs) = seek_secs.lock().take() {
            let _ = format.seek(
                symphonia::core::formats::SeekMode::Accurate,
                symphonia::core::formats::SeekTo::Time {
                    time: symphonia::core::units::Time::from(target_secs),
                    track_id: Some(track_id),
                },
            );
            *current_position_secs.lock() = target_secs;
        }

        if !is_playing.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(15));
            continue;
        }

        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(_) => break, // EOF or error
        };

        if packet.track_id() != track_id {
            continue;
        }

        let current_frame_ts = packet.ts();
        if let Some(tb) = time_base {
            let pos_secs =
                tb.calc_time(current_frame_ts).seconds as f64 + tb.calc_time(current_frame_ts).frac;
            *current_position_secs.lock() = pos_secs;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let gain_db = *replay_gain_db.lock();
                let vol = *volume.lock();
                let linear_gain = 10.0f32.powf(gain_db / 20.0) * vol;

                if sample_buf.is_none() {
                    let spec = *decoded.spec();
                    let cap = decoded.capacity() as u64;
                    sample_buf = Some(symphonia::core::audio::SampleBuffer::<f32>::new(cap, spec));
                }

                if let Some(ref mut buf) = sample_buf {
                    buf.copy_interleaved_ref(decoded);
                    let raw_samples = buf.samples();

                    // Non-blocking sample pusher closure with instant WASAPI stall detection
                    let mut push_sample = |sample: f32| -> bool {
                        let stall_start = std::time::Instant::now();
                        loop {
                            if stop_signal.load(Ordering::SeqCst) {
                                return false;
                            }
                            match tx.try_send(sample) {
                                Ok(_) => return true,
                                Err(crossbeam_channel::TrySendError::Full(_)) => {
                                    if stall_start.elapsed() > Duration::from_millis(100) {
                                        device_changed.store(true, Ordering::SeqCst);
                                        return false;
                                    }
                                    thread::sleep(Duration::from_millis(1));
                                }
                                Err(crossbeam_channel::TrySendError::Disconnected(_)) => {
                                    device_changed.store(true, Ordering::SeqCst);
                                    return false;
                                }
                            }
                        }
                    };

                    if input_sample_rate == target_sample_rate && input_channels == target_channels
                    {
                        for &sample in raw_samples {
                            let gain_adjusted = (sample * linear_gain).clamp(-1.0, 1.0);
                            if !push_sample(gain_adjusted) {
                                break;
                            }
                        }
                    } else {
                        // Linear sample rate & channel adaptation
                        let num_frames = raw_samples.len() / input_channels;
                        let resample_ratio = target_sample_rate as f64 / input_sample_rate as f64;
                        let target_frames = (num_frames as f64 * resample_ratio) as usize;

                        for f in 0..target_frames {
                            let src_frame_f = f as f64 / resample_ratio;
                            let src_frame_idx = src_frame_f.floor() as usize;
                            let frac = (src_frame_f - src_frame_idx as f64) as f32;

                            for c in 0..target_channels {
                                let input_c = c % input_channels;
                                let sample_curr = if src_frame_idx < num_frames {
                                    raw_samples[src_frame_idx * input_channels + input_c]
                                } else {
                                    0.0
                                };
                                let sample_next = if src_frame_idx + 1 < num_frames {
                                    raw_samples[(src_frame_idx + 1) * input_channels + input_c]
                                } else {
                                    sample_curr
                                };

                                let interp = sample_curr + frac * (sample_next - sample_curr);
                                let gain_adjusted = (interp * linear_gain).clamp(-1.0, 1.0);
                                if !push_sample(gain_adjusted) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }

    Ok(())
}
