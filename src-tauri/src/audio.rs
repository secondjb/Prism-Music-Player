use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use parking_lot::Mutex;
use rubato::{InterpolationParameters, InterpolationType, Resampler, SincFixedIn, WindowFunction};
use std::collections::VecDeque;
use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use tauri::Emitter;

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
    pub seek_target_ms: Arc<AtomicU64>,
    pub current_position_ms: Arc<AtomicU64>,
    pub current_duration_ms: Arc<AtomicU64>,
    pub selected_device_name: Arc<Mutex<Option<String>>>,
    pub active_device_name: Arc<Mutex<String>>,
    pub active_sample_rate: Arc<Mutex<u32>>,
    pub active_channels: Arc<Mutex<u16>>,
    pub active_format: Arc<Mutex<String>>,
    pub device_caps_cache: Arc<Mutex<std::collections::HashMap<String, (u32, u32, Vec<u16>, Vec<String>)>>>,
    pub cached_devices: Arc<Mutex<Option<(std::time::Instant, Vec<AudioDeviceInfo>)>>>,
}

impl AudioPlayerState {
    pub fn new() -> Self {
        Self {
            is_playing: Arc::new(AtomicBool::new(false)),
            volume: Arc::new(Mutex::new(0.8)),
            replay_gain_db: Arc::new(Mutex::new(0.0)),
            seek_target_ms: Arc::new(AtomicU64::new(u64::MAX)),
            current_position_ms: Arc::new(AtomicU64::new(0)),
            current_duration_ms: Arc::new(AtomicU64::new(0)),
            selected_device_name: Arc::new(Mutex::new(None)),
            active_device_name: Arc::new(Mutex::new(String::new())),
            active_sample_rate: Arc::new(Mutex::new(0)),
            active_channels: Arc::new(Mutex::new(0)),
            active_format: Arc::new(Mutex::new(String::new())),
            device_caps_cache: Arc::new(Mutex::new(std::collections::HashMap::new())),
            cached_devices: Arc::new(Mutex::new(None)),
        }
    }
}

pub enum AudioCommand {
    Play {
        path: String,
        replay_gain_db: f32,
        start_position_secs: Option<f64>,
        crossfade_secs: Option<f32>,
        force_gapless: bool,
        init_paused: bool,
    },
    SetNextTrack {
        path: Option<String>,
        replay_gain_db: Option<f32>,
        force_gapless: bool,
    },
    Pause,
    Resume,
    Stop,
    Seek {
        position_secs: f64,
    },
    SetVolume {
        volume: f32,
    },
    SetReplayGain {
        gain_db: f32,
    },
    SetOutputDevice {
        device_name: Option<String>,
    },
}

pub struct TrackDecoder {
    pub path: String,
    pub track_id: u32,
    pub input_sample_rate: u32,
    pub input_channels: usize,
    pub target_sample_rate: u32,
    pub target_channels: usize,
    pub total_duration_secs: f64,
    pub replay_gain_db: f32,
    format: Box<dyn symphonia::core::formats::FormatReader>,
    decoder: Box<dyn symphonia::core::codecs::Decoder>,
    sample_buf: Option<symphonia::core::audio::SampleBuffer<f32>>,
    resampler: Option<SincFixedIn<f32>>,
    resampler_chunk_size: usize,
    resampler_in_buffer: Vec<Vec<f32>>,
    resampler_out_buffer: Vec<Vec<f32>>,
    ready_samples: VecDeque<f32>,
    delay_frames_remaining: usize,
    valid_frames_remaining: Option<u64>,
    frames_emitted: u64,
    pub eof: bool,
}

impl TrackDecoder {
    pub fn open(
        path_str: &str,
        replay_gain_db: f32,
        start_position_secs: Option<f64>,
        target_sample_rate: u32,
        target_channels: usize,
    ) -> Result<Self, String> {
        let p = Path::new(path_str);
        let metadata = std::fs::metadata(p).ok();
        let file_len = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let source_box: Box<dyn symphonia::core::io::MediaSource> =
            if file_len > 0 && file_len <= 150 * 1024 * 1024 {
                match std::fs::read(p) {
                    Ok(bytes) => Box::new(std::io::Cursor::new(bytes)),
                    Err(_) => {
                        let f = File::open(p).map_err(|e| format!("Failed to open file '{}': {}", path_str, e))?;
                        Box::new(f)
                    }
                }
            } else {
                let f = File::open(p).map_err(|e| format!("Failed to open file '{}': {}", path_str, e))?;
                Box::new(f)
            };

        let mss = MediaSourceStream::new(source_box, Default::default());
        let mut hint = Hint::new();
        if let Some(ext) = p.extension() {
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
        let input_sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
        let input_channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);
        let delay_frames = track.codec_params.delay.unwrap_or(0) as usize;
        let padding_frames = track.codec_params.padding.unwrap_or(0) as u64;
        let total_frames = track.codec_params.n_frames;

        let total_duration_secs = total_frames
            .map(|f| f as f64 / input_sample_rate as f64)
            .unwrap_or(0.0);

        let valid_frames_remaining = total_frames.map(|n| n.saturating_sub(delay_frames as u64 + padding_frames));

        let dec_opts: DecoderOptions = Default::default();
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &dec_opts)
            .map_err(|e| format!("Decoder creation error: {}", e))?;

        if let Some(start_secs) = start_position_secs.filter(|&s| s > 0.0) {
            let _ = format.seek(
                symphonia::core::formats::SeekMode::Accurate,
                symphonia::core::formats::SeekTo::Time {
                    time: symphonia::core::units::Time::from(start_secs),
                    track_id: Some(track_id),
                },
            );
            decoder.reset();
        }

        let chunk_size = 1024;
        let (resampler, resampler_in_buffer, resampler_out_buffer) = if input_sample_rate != target_sample_rate {
            let resample_ratio = target_sample_rate as f64 / input_sample_rate as f64;
            let params = InterpolationParameters {
                sinc_len: 64,
                f_cutoff: 0.95,
                interpolation: InterpolationType::Linear,
                oversampling_factor: 128,
                window: WindowFunction::Blackman2,
            };
            let r = SincFixedIn::<f32>::new(
                resample_ratio,
                2.0,
                params,
                chunk_size,
                target_channels,
            ).map_err(|e| format!("Failed to create resampler: {:?}", e))?;
            let in_buf = vec![Vec::with_capacity(chunk_size * 2); target_channels];
            let out_buf = r.output_buffer_allocate();
            (Some(r), in_buf, out_buf)
        } else {
            (None, Vec::new(), Vec::new())
        };

        Ok(Self {
            path: path_str.to_string(),
            track_id,
            input_sample_rate,
            input_channels,
            target_sample_rate,
            target_channels,
            total_duration_secs,
            replay_gain_db,
            format,
            decoder,
            sample_buf: None,
            resampler,
            resampler_chunk_size: chunk_size,
            resampler_in_buffer,
            resampler_out_buffer,
            ready_samples: VecDeque::with_capacity(8192),
            delay_frames_remaining: delay_frames,
            valid_frames_remaining,
            frames_emitted: 0,
            eof: false,
        })
    }

    pub fn reconfigure_target(&mut self, new_sample_rate: u32, new_channels: usize) -> Result<(), String> {
        self.target_sample_rate = new_sample_rate;
        self.target_channels = new_channels;
        self.ready_samples.clear();

        if self.input_sample_rate != new_sample_rate {
            let resample_ratio = new_sample_rate as f64 / self.input_sample_rate as f64;
            let params = InterpolationParameters {
                sinc_len: 64,
                f_cutoff: 0.95,
                interpolation: InterpolationType::Linear,
                oversampling_factor: 128,
                window: WindowFunction::Blackman2,
            };
            let r = SincFixedIn::<f32>::new(
                resample_ratio,
                2.0,
                params,
                self.resampler_chunk_size,
                new_channels,
            ).map_err(|e| format!("Failed to reconfigure resampler: {:?}", e))?;
            self.resampler_in_buffer = vec![Vec::with_capacity(self.resampler_chunk_size * 2); new_channels];
            self.resampler_out_buffer = r.output_buffer_allocate();
            self.resampler = Some(r);
        } else {
            self.resampler = None;
            self.resampler_in_buffer.clear();
            self.resampler_out_buffer.clear();
        }
        Ok(())
    }

    pub fn seek(&mut self, position_secs: f64) -> Result<(), String> {
        self.ready_samples.clear();
        for b in &mut self.resampler_in_buffer {
            b.clear();
        }
        self.delay_frames_remaining = 0;

        let clamped_secs = if self.total_duration_secs > 0.5 {
            position_secs.clamp(0.0, self.total_duration_secs - 0.3)
        } else {
            position_secs.max(0.0)
        };

        let seek_res = self.format.seek(
            symphonia::core::formats::SeekMode::Accurate,
            symphonia::core::formats::SeekTo::Time {
                time: symphonia::core::units::Time::from(clamped_secs),
                track_id: Some(self.track_id),
            },
        ).or_else(|_| {
            self.format.seek(
                symphonia::core::formats::SeekMode::Coarse,
                symphonia::core::formats::SeekTo::Time {
                    time: symphonia::core::units::Time::from(clamped_secs),
                    track_id: Some(self.track_id),
                },
            )
        });

        self.decoder.reset();

        match seek_res {
            Ok(_) => {
                self.frames_emitted = (clamped_secs * self.input_sample_rate as f64) as u64;
                self.eof = false;
            }
            Err(e) => {
                if self.total_duration_secs > 0.0 && clamped_secs >= (self.total_duration_secs - 2.0) {
                    self.eof = true;
                    self.frames_emitted = (self.total_duration_secs * self.input_sample_rate as f64) as u64;
                } else {
                    let _ = self.format.seek(
                        symphonia::core::formats::SeekMode::Coarse,
                        symphonia::core::formats::SeekTo::Time {
                            time: symphonia::core::units::Time::from(0.0),
                            track_id: Some(self.track_id),
                        },
                    );
                    self.decoder.reset();
                    self.frames_emitted = 0;
                    self.eof = false;
                }
                return Err(format!("Seek error: {}", e));
            }
        }
        Ok(())
    }

    pub fn current_position_secs(&self) -> f64 {
        if self.input_sample_rate > 0 {
            self.frames_emitted as f64 / self.input_sample_rate as f64
        } else {
            0.0
        }
    }

    fn feed_frames_static(
        resampler: &mut Option<SincFixedIn<f32>>,
        resampler_chunk_size: usize,
        resampler_in_buffer: &mut Vec<Vec<f32>>,
        resampler_out_buffer: &mut Vec<Vec<f32>>,
        ready_samples: &mut VecDeque<f32>,
        input_channels: usize,
        target_channels: usize,
        slice: &[f32],
        frames_to_take: usize,
    ) {
        if let Some(ref mut res) = resampler {
            let chunk_size = resampler_chunk_size;
            for f in 0..frames_to_take {
                for c in 0..target_channels {
                    let s = if input_channels == 1 {
                        slice[f]
                    } else if c < input_channels {
                        slice[f * input_channels + c]
                    } else {
                        slice[f * input_channels + (c % input_channels)]
                    };
                    resampler_in_buffer[c].push(s);
                }
            }

            while resampler_in_buffer[0].len() >= chunk_size {
                let mut chunk_views: Vec<Vec<f32>> = Vec::with_capacity(target_channels);
                for c in 0..target_channels {
                    let remaining = resampler_in_buffer[c].split_off(chunk_size);
                    let chunk = std::mem::replace(&mut resampler_in_buffer[c], remaining);
                    chunk_views.push(chunk);
                }

                if res.process_into_buffer(&chunk_views, resampler_out_buffer, None).is_ok() {
                    let out_len = resampler_out_buffer[0].len();
                    for f in 0..out_len {
                        for c in 0..target_channels {
                            ready_samples.push_back(resampler_out_buffer[c][f]);
                        }
                    }
                }
            }
        } else {
            // Direct Bit-Perfect / Sample-matched bypass
            for f in 0..frames_to_take {
                for c in 0..target_channels {
                    let s = if input_channels == 1 {
                        slice[f]
                    } else if c < input_channels {
                        slice[f * input_channels + c]
                    } else {
                        slice[f * input_channels + (c % input_channels)]
                    };
                    ready_samples.push_back(s);
                }
            }
        }
    }

    fn flush_resampler(&mut self) {
        if let Some(ref mut resampler) = self.resampler {
            let avail = self.resampler_in_buffer[0].len();
            if avail > 0 {
                let needed = self.resampler_chunk_size;
                let _pad = needed.saturating_sub(avail);
                for c in 0..self.target_channels {
                    self.resampler_in_buffer[c].resize(needed, 0.0);
                }
                if resampler.process_into_buffer(&self.resampler_in_buffer, &mut self.resampler_out_buffer, None).is_ok() {
                    let out_len = self.resampler_out_buffer[0].len();
                    let ratio = avail as f64 / needed as f64;
                    let valid_out = ((out_len as f64) * ratio).round() as usize;
                    for f in 0..valid_out.min(out_len) {
                        for c in 0..self.target_channels {
                            self.ready_samples.push_back(self.resampler_out_buffer[c][f]);
                        }
                    }
                }
                for c in 0..self.target_channels {
                    self.resampler_in_buffer[c].clear();
                }
            }
        }
    }

    pub fn fill_ready_samples(&mut self, target_count: usize) {
        while self.ready_samples.len() < target_count && !self.eof {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                Err(_) => {
                    self.flush_resampler();
                    self.eof = true;
                    break;
                }
            };

            if packet.track_id() != self.track_id {
                continue;
            }

            let decoded = match self.decoder.decode(&packet) {
                Ok(d) => d,
                Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
                Err(_) => {
                    self.flush_resampler();
                    self.eof = true;
                    break;
                }
            };

            if self.sample_buf.is_none() {
                let spec = *decoded.spec();
                let cap = decoded.capacity() as u64;
                self.sample_buf = Some(symphonia::core::audio::SampleBuffer::<f32>::new(cap, spec));
            }

            self.sample_buf.as_mut().unwrap().copy_interleaved_ref(decoded);
            let raw_samples = self.sample_buf.as_ref().unwrap().samples();
            let num_frames = raw_samples.len() / self.input_channels;

            // 1. Gapless delay trimming
            let (start_frame, frames_after_delay) = if self.delay_frames_remaining > 0 {
                if num_frames <= self.delay_frames_remaining {
                    self.delay_frames_remaining -= num_frames;
                    continue;
                } else {
                    let skipped = self.delay_frames_remaining;
                    self.delay_frames_remaining = 0;
                    (skipped, num_frames - skipped)
                }
            } else {
                (0, num_frames)
            };

            // 2. Gapless padding trimming & duration clamp
            let frames_to_take = if let Some(limit) = self.valid_frames_remaining {
                if self.frames_emitted + frames_after_delay as u64 >= limit {
                    self.eof = true;
                    (limit.saturating_sub(self.frames_emitted)) as usize
                } else {
                    frames_after_delay
                }
            } else if self.total_duration_secs > 0.0 {
                let max_frames = (self.total_duration_secs * self.input_sample_rate as f64) as u64;
                if self.frames_emitted + frames_after_delay as u64 >= max_frames {
                    self.eof = true;
                    (max_frames.saturating_sub(self.frames_emitted)) as usize
                } else {
                    frames_after_delay
                }
            } else {
                frames_after_delay
            };

            self.frames_emitted += frames_to_take as u64;

            if frames_to_take == 0 {
                if self.eof {
                    self.flush_resampler();
                    break;
                }
                continue;
            }

            let valid_start = start_frame * self.input_channels;
            let valid_end = valid_start + frames_to_take * self.input_channels;
            let slice = &self.sample_buf.as_ref().unwrap().samples()[valid_start..valid_end];
            Self::feed_frames_static(
                &mut self.resampler,
                self.resampler_chunk_size,
                &mut self.resampler_in_buffer,
                &mut self.resampler_out_buffer,
                &mut self.ready_samples,
                self.input_channels,
                self.target_channels,
                slice,
                frames_to_take,
            );
        }
    }

    pub fn pop_sample(&mut self) -> Option<f32> {
        if self.ready_samples.is_empty() {
            self.fill_ready_samples(1024 * self.target_channels);
        }
        self.ready_samples.pop_front()
    }
}

pub struct CrossfadeState {
    pub total_frames: usize,
    pub current_frame: usize,
}

#[derive(Clone)]
pub struct GlobalAudioEngine {
    pub state: Arc<Mutex<AudioPlayerState>>,
    pub thread_handle: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
    pub current_position_ms: Arc<AtomicU64>,
    pub current_duration_ms: Arc<AtomicU64>,
    pub seek_target_ms: Arc<AtomicU64>,
    cmd_tx: crossbeam_channel::Sender<AudioCommand>,
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
}

unsafe impl Send for GlobalAudioEngine {}
unsafe impl Sync for GlobalAudioEngine {}

impl GlobalAudioEngine {
    pub fn new() -> Self {
        let player_state = AudioPlayerState::new();
        let current_position_ms = Arc::clone(&player_state.current_position_ms);
        let current_duration_ms = Arc::clone(&player_state.current_duration_ms);
        let seek_target_ms = Arc::clone(&player_state.seek_target_ms);
        let state_arc = Arc::new(Mutex::new(player_state));

        let (cmd_tx, cmd_rx) = crossbeam_channel::unbounded::<AudioCommand>();
        let app_handle_arc = Arc::new(Mutex::new(None));

        let state_worker = Arc::clone(&state_arc);
        let app_handle_worker = Arc::clone(&app_handle_arc);

        let thread_handle = thread::spawn(move || {
            run_audio_engine(cmd_rx, state_worker, app_handle_worker);
        });

        Self {
            state: state_arc,
            thread_handle: Arc::new(Mutex::new(Some(thread_handle))),
            current_position_ms,
            current_duration_ms,
            seek_target_ms,
            cmd_tx,
            app_handle: app_handle_arc,
        }
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.lock() = Some(handle);
    }

    pub fn play(
        &self,
        file_path: String,
        replay_gain_db: f32,
        start_position_secs: Option<f64>,
        crossfade_secs: Option<f32>,
        init_paused: bool,
    ) -> Result<(), String> {
        let _ = self.cmd_tx.send(AudioCommand::Play {
            path: file_path,
            replay_gain_db,
            start_position_secs,
            crossfade_secs,
            force_gapless: false,
            init_paused,
        });
        Ok(())
    }

    pub fn set_next_track(
        &self,
        path: Option<String>,
        replay_gain_db: Option<f32>,
        force_gapless: Option<bool>,
    ) {
        let _ = self.cmd_tx.send(AudioCommand::SetNextTrack {
            path,
            replay_gain_db,
            force_gapless: force_gapless.unwrap_or(false),
        });
    }

    pub fn pause(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Resume);
    }

    pub fn stop(&self) {
        self.current_position_ms.store(0, Ordering::Relaxed);
        self.current_duration_ms.store(0, Ordering::Relaxed);
        self.seek_target_ms.store(0, Ordering::Release);
        let _ = self.cmd_tx.send(AudioCommand::Stop);
    }

    #[inline]
    pub fn seek(&self, position_secs: f64) {
        let pos_ms = (position_secs.max(0.0) * 1000.0) as u64;
        self.current_position_ms.store(pos_ms, Ordering::Relaxed);
        self.seek_target_ms.store(pos_ms, Ordering::Release);
        let _ = self.cmd_tx.send(AudioCommand::Seek { position_secs });
    }

    pub fn set_volume(&self, vol: f32) {
        let clamped = vol.clamp(0.0, 1.0);
        let state = self.state.lock();
        *state.volume.lock() = clamped;
        let _ = self.cmd_tx.send(AudioCommand::SetVolume { volume: clamped });
    }

    pub fn set_replay_gain(&self, gain_db: f32) {
        let state = self.state.lock();
        *state.replay_gain_db.lock() = gain_db;
        let _ = self.cmd_tx.send(AudioCommand::SetReplayGain { gain_db });
    }

    #[inline]
    pub fn get_position(&self) -> (f64, f64) {
        let pos = self.current_position_ms.load(Ordering::Relaxed) as f64 / 1000.0;
        let dur = self.current_duration_ms.load(Ordering::Relaxed) as f64 / 1000.0;
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
            && cached_guard.as_ref().unwrap().0.elapsed() < Duration::from_secs(2)
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
        *state.selected_device_name.lock() = device_name.clone();
        drop(state);

        let _ = self.cmd_tx.send(AudioCommand::SetOutputDevice { device_name });
    }
}

fn create_cpal_stream(
    device_name_opt: Option<&str>,
    flush_counter: Arc<AtomicU64>,
    device_changed: Arc<AtomicBool>,
) -> Result<(cpal::Stream, rtrb::Producer<f32>, String, u32, usize, String), String> {
    let host = cpal::default_host();
    let device = match device_name_opt {
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

    let target_sample_rate = default_config.sample_rate().0;
    let target_channels = default_config.channels() as usize;
    let stream_config: StreamConfig = default_config.clone().into();
    let sample_format = default_config.sample_format();
    let format_str = format!("{:?}", sample_format);

    // Buffer capacity: ~500ms headroom
    let ring_buffer_capacity = (target_sample_rate as usize * target_channels / 2).max(16384);
    let (producer, mut consumer) = rtrb::RingBuffer::<f32>::new(ring_buffer_capacity);

    let dc = Arc::clone(&device_changed);
    let err_fn = move |err| {
        eprintln!("CPAL Stream error: {}", err);
        dc.store(true, Ordering::SeqCst);
    };

    let fc = Arc::clone(&flush_counter);
    let mut last_flush = fc.load(Ordering::Relaxed);

    let stream = match sample_format {
        SampleFormat::F32 => device.build_output_stream(
            &stream_config,
            move |data: &mut [f32], _| {
                let cur_flush = fc.load(Ordering::Relaxed);
                if cur_flush != last_flush {
                    last_flush = cur_flush;
                    while consumer.pop().is_ok() {}
                }
                for sample in data.iter_mut() {
                    *sample = consumer.pop().unwrap_or(0.0);
                }
            },
            err_fn,
            None,
        ),
        SampleFormat::I16 => device.build_output_stream(
            &stream_config,
            move |data: &mut [i16], _| {
                let cur_flush = fc.load(Ordering::Relaxed);
                if cur_flush != last_flush {
                    last_flush = cur_flush;
                    while consumer.pop().is_ok() {}
                }
                for sample in data.iter_mut() {
                    let f_sample = consumer.pop().unwrap_or(0.0);
                    *sample = (f_sample * i16::MAX as f32) as i16;
                }
            },
            err_fn,
            None,
        ),
        SampleFormat::U16 => device.build_output_stream(
            &stream_config,
            move |data: &mut [u16], _| {
                let cur_flush = fc.load(Ordering::Relaxed);
                if cur_flush != last_flush {
                    last_flush = cur_flush;
                    while consumer.pop().is_ok() {}
                }
                for sample in data.iter_mut() {
                    let f_sample = consumer.pop().unwrap_or(0.0);
                    *sample = ((f_sample + 1.0) * 0.5 * u16::MAX as f32) as u16;
                }
            },
            err_fn,
            None,
        ),
        _ => return Err("Unsupported sample format".into()),
    }.map_err(|e| format!("Failed to build output stream: {}", e))?;

    stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;
    Ok((stream, producer, dev_name, target_sample_rate, target_channels, format_str))
}

fn run_audio_engine(
    cmd_rx: crossbeam_channel::Receiver<AudioCommand>,
    state: Arc<Mutex<AudioPlayerState>>,
    app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
) {
    let flush_counter = Arc::new(AtomicU64::new(0));
    let device_changed = Arc::new(AtomicBool::new(false));

    let (current_stream_init, mut producer, mut active_dev_name, mut target_sample_rate, mut target_channels, _) =
        match create_cpal_stream(None, Arc::clone(&flush_counter), Arc::clone(&device_changed)) {
            Ok(res) => (Some(res.0), Some(res.1), res.2, res.3, res.4, res.5),
            Err(e) => {
                eprintln!("Initial CPAL initialization failed: {}", e);
                (None, None, String::new(), 48000, 2, String::new())
            }
        };
    let mut _current_stream = current_stream_init;

    {
        let s = state.lock();
        *s.active_device_name.lock() = active_dev_name.clone();
        *s.active_sample_rate.lock() = target_sample_rate;
        *s.active_channels.lock() = target_channels as u16;
    }

    let mut current_track: Option<TrackDecoder> = None;
    let mut incoming_track: Option<TrackDecoder> = None;
    let mut crossfade_state: Option<CrossfadeState> = None;
    let mut pending_next: Option<(String, f32, bool)> = None;
    let mut configured_crossfade_secs: f32 = 0.0;
    let mut is_playing = false;
    let mut master_volume = 0.8f32;
    let mut last_device_check = std::time::Instant::now();
    let mut last_stall_check = std::time::Instant::now();

    loop {
        // Drain commands (using timeout when idle so device changes are noticed while paused)
        let first_cmd = if !is_playing || current_track.is_none() || producer.is_none() {
            match cmd_rx.recv_timeout(Duration::from_millis(150)) {
                Ok(cmd) => Some(cmd),
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => None,
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
            }
        } else {
            cmd_rx.try_recv().ok()
        };

        if let Some(cmd) = first_cmd {
            let mut current_cmd = Some(cmd);
            while let Some(c) = current_cmd {
                match c {
                    AudioCommand::Play {
                        path,
                        replay_gain_db,
                        start_position_secs,
                        crossfade_secs,
                        force_gapless: _,
                        init_paused,
                    } => {
                        let fade_s = crossfade_secs.unwrap_or(0.0);
                        configured_crossfade_secs = fade_s;

                        // Instant switch: manual skip or play must NEVER crossfade.
                        flush_counter.fetch_add(1, Ordering::SeqCst);
                        incoming_track = None;
                        crossfade_state = None;
                        pending_next = None;
                        match TrackDecoder::open(&path, replay_gain_db, start_position_secs, target_sample_rate, target_channels) {
                            Ok(t) => {
                                let dur_ms = (t.total_duration_secs * 1000.0) as u64;
                                let s = state.lock();
                                s.current_duration_ms.store(dur_ms, Ordering::Relaxed);
                                let start_pos_ms = if t.input_sample_rate > 0 {
                                    (t.frames_emitted as f64 / t.input_sample_rate as f64 * 1000.0) as u64
                                } else {
                                    start_position_secs.map(|sec| (sec * 1000.0) as u64).unwrap_or(0)
                                };
                                s.current_position_ms.store(start_pos_ms, Ordering::Relaxed);
                                drop(s);
                                current_track = Some(t);
                                if !init_paused {
                                    is_playing = true;
                                    state.lock().is_playing.store(true, Ordering::SeqCst);
                                } else {
                                    is_playing = false;
                                    state.lock().is_playing.store(false, Ordering::SeqCst);
                                }
                            }
                            Err(e) => eprintln!("Failed to open track: {}", e),
                        }
                    }
                    AudioCommand::SetNextTrack { path, replay_gain_db, force_gapless } => {
                        if let Some(p) = path {
                            pending_next = Some((p, replay_gain_db.unwrap_or(0.0), force_gapless));
                        } else {
                            pending_next = None;
                            incoming_track = None;
                        }
                    }
                    AudioCommand::Pause => {
                        flush_counter.fetch_add(1, Ordering::SeqCst);
                        is_playing = false;
                        state.lock().is_playing.store(false, Ordering::SeqCst);
                    }
                    AudioCommand::Resume => {
                        is_playing = true;
                        state.lock().is_playing.store(true, Ordering::SeqCst);
                    }
                    AudioCommand::Stop => {
                        flush_counter.fetch_add(1, Ordering::SeqCst);
                        is_playing = false;
                        current_track = None;
                        incoming_track = None;
                        crossfade_state = None;
                        pending_next = None;
                        let s = state.lock();
                        s.is_playing.store(false, Ordering::SeqCst);
                        s.current_position_ms.store(0, Ordering::Relaxed);
                        s.current_duration_ms.store(0, Ordering::Relaxed);
                    }
                    AudioCommand::Seek { position_secs } => {
                        flush_counter.fetch_add(1, Ordering::SeqCst);
                        incoming_track = None;
                        crossfade_state = None;
                        if let Some(ref mut cur) = current_track {
                            let _ = cur.seek(position_secs);
                            let pos_ms = (cur.current_position_secs() * 1000.0) as u64;
                            state.lock().current_position_ms.store(pos_ms, Ordering::Relaxed);
                        }
                    }
                    AudioCommand::SetVolume { volume } => {
                        master_volume = volume;
                    }
                    AudioCommand::SetReplayGain { gain_db } => {
                        if let Some(ref mut cur) = current_track {
                            cur.replay_gain_db = gain_db;
                        }
                    }
                    AudioCommand::SetOutputDevice { device_name } => {
                        _current_stream = None;
                        producer = None;
                        flush_counter.fetch_add(1, Ordering::SeqCst);

                        match create_cpal_stream(device_name.as_deref(), Arc::clone(&flush_counter), Arc::clone(&device_changed)) {
                            Ok(res) => {
                                _current_stream = Some(res.0);
                                producer = Some(res.1);
                                active_dev_name = res.2;
                                target_sample_rate = res.3;
                                target_channels = res.4;

                                let s = state.lock();
                                *s.active_device_name.lock() = active_dev_name.clone();
                                *s.active_sample_rate.lock() = target_sample_rate;
                                *s.active_channels.lock() = target_channels as u16;

                                if let Some(ref mut cur) = current_track {
                                    let _ = cur.reconfigure_target(target_sample_rate, target_channels);
                                }
                                if let Some(ref mut inc) = incoming_track {
                                    let _ = inc.reconfigure_target(target_sample_rate, target_channels);
                                }
                            }
                            Err(e) => eprintln!("Failed to switch output device: {}", e),
                        }
                    }
                }
                current_cmd = cmd_rx.try_recv().ok();
            }
        }

        // Automatic device migration detection (CPAL error, OS default swap, or hardware disconnect)
        let dev_err = device_changed.swap(false, Ordering::SeqCst);
        let is_system_default = state.lock().selected_device_name.lock().is_none();
        let mut need_auto_switch = dev_err;

        if !need_auto_switch && is_system_default && last_device_check.elapsed() >= Duration::from_millis(150) {
            last_device_check = std::time::Instant::now();
            if let Some(def_dev) = cpal::default_host().default_output_device() {
                if let Ok(name) = def_dev.name() {
                    if !active_dev_name.is_empty() && name != active_dev_name {
                        need_auto_switch = true;
                    }
                }
            }
        }

        if need_auto_switch {
            let sel_name = state.lock().selected_device_name.lock().clone();
            _current_stream = None;
            producer = None;
            flush_counter.fetch_add(1, Ordering::SeqCst);

            match create_cpal_stream(sel_name.as_deref(), Arc::clone(&flush_counter), Arc::clone(&device_changed)) {
                Ok(res) => {
                    _current_stream = Some(res.0);
                    producer = Some(res.1);
                    active_dev_name = res.2;
                    target_sample_rate = res.3;
                    target_channels = res.4;

                    let s = state.lock();
                    *s.active_device_name.lock() = active_dev_name.clone();
                    *s.active_sample_rate.lock() = target_sample_rate;
                    *s.active_channels.lock() = target_channels as u16;

                    if let Some(ref mut cur) = current_track {
                        let _ = cur.reconfigure_target(target_sample_rate, target_channels);
                    }
                    if let Some(ref mut inc) = incoming_track {
                        let _ = inc.reconfigure_target(target_sample_rate, target_channels);
                    }
                    println!("Successfully migrated audio stream to device: {}", active_dev_name);
                }
                Err(e) => {
                    eprintln!("Failed to migrate audio stream to new device: {}", e);
                    device_changed.store(true, Ordering::SeqCst);
                }
            }
        }

        // Idle when paused or stopped
        if !is_playing || current_track.is_none() || producer.is_none() {
            continue;
        }

        let cur = current_track.as_mut().unwrap();
        let cur_pos = cur.current_position_secs();
        let remaining_secs = cur.total_duration_secs - cur_pos;

        // Lazy On-Demand Preload: only within 12s of track ending
        if incoming_track.is_none() && pending_next.is_some() && (remaining_secs <= 12.0 || cur.eof) {
            let (next_path, next_gain, _) = pending_next.as_ref().unwrap().clone();
            if let Ok(inc) = TrackDecoder::open(&next_path, next_gain, None, target_sample_rate, target_channels) {
                incoming_track = Some(inc);
            }
        }

        // Auto trigger crossfade if configured and nearing end (natural end transition only, never if next is gapless)
        let is_gapless = pending_next.as_ref().map(|(_, _, g)| *g).unwrap_or(false);
        if crossfade_state.is_none() && incoming_track.is_some() && configured_crossfade_secs > 0.0 && !is_gapless {
            if remaining_secs <= (configured_crossfade_secs as f64) {
                let total_f = (configured_crossfade_secs * target_sample_rate as f32) as usize;
                crossfade_state = Some(CrossfadeState {
                    total_frames: total_f.max(1),
                    current_frame: 0,
                });
                if let Some(ref inc) = incoming_track {
                    let dur_ms = (inc.total_duration_secs * 1000.0) as u64;
                    state.lock().current_duration_ms.store(dur_ms, Ordering::Relaxed);
                }
                if let Some(app) = app_handle.lock().as_ref() {
                    let _ = app.emit("track-transitioned", ());
                }
            }
        }

        let prod = producer.as_mut().unwrap();
        let slots = prod.slots();
        if slots < target_channels * 64 {
            if last_stall_check.elapsed() > Duration::from_millis(1500) {
                // Buffer full for >1.5s while playing -> audio stream stalled/dead
                device_changed.store(true, Ordering::SeqCst);
                last_stall_check = std::time::Instant::now();
            }
            // SPSC ring buffer has plenty of headroom; yield gracefully
            thread::sleep(Duration::from_millis(15));
            continue;
        } else {
            last_stall_check = std::time::Instant::now();
        }

        let frames_to_generate = (slots / target_channels).min(512);
        let mut track_ended = false;

        for _ in 0..frames_to_generate {
            if let Some(ref mut xfade) = crossfade_state {
                let t = xfade.current_frame as f32 / xfade.total_frames as f32;
                let theta = t * (std::f32::consts::PI / 2.0);
                let g_a = theta.cos();
                let g_b = theta.sin();

                let cur_gain = 10.0f32.powf(current_track.as_ref().unwrap().replay_gain_db / 20.0);
                let inc_gain = 10.0f32.powf(incoming_track.as_ref().unwrap().replay_gain_db / 20.0);

                for _ in 0..target_channels {
                    let s_a = current_track.as_mut().unwrap().pop_sample().unwrap_or(0.0) * cur_gain * g_a;
                    let s_b = incoming_track.as_mut().unwrap().pop_sample().unwrap_or(0.0) * inc_gain * g_b;
                    let mixed = ((s_a + s_b) * master_volume).clamp(-1.0, 1.0);
                    let _ = prod.push(mixed);
                }

                xfade.current_frame += 1;
                if xfade.current_frame >= xfade.total_frames {
                    // Crossfade complete: transition to incoming track
                    crossfade_state = None;
                    current_track = incoming_track.take();
                    let new_dur_ms = (current_track.as_ref().unwrap().total_duration_secs * 1000.0) as u64;
                    state.lock().current_duration_ms.store(new_dur_ms, Ordering::Relaxed);
                    break;
                }
            } else {
                let cur_trk = current_track.as_mut().unwrap();
                let gain = 10.0f32.powf(cur_trk.replay_gain_db / 20.0);

                let mut eof_in_frame = false;
                for _ in 0..target_channels {
                    match cur_trk.pop_sample() {
                        Some(s) => {
                            let out = (s * gain * master_volume).clamp(-1.0, 1.0);
                            let _ = prod.push(out);
                        }
                        None => {
                            eof_in_frame = true;
                            break;
                        }
                    }
                }

                if eof_in_frame {
                    if incoming_track.is_some() {
                        // True Gapless Transition on the immediate frame!
                        current_track = incoming_track.take();
                        let new_dur_ms = (current_track.as_ref().unwrap().total_duration_secs * 1000.0) as u64;
                        state.lock().current_duration_ms.store(new_dur_ms, Ordering::Relaxed);
                        if let Some(app) = app_handle.lock().as_ref() {
                            let _ = app.emit("track-transitioned", ());
                        }
                    } else {
                        track_ended = true;
                        break;
                    }
                }
            }
        }

        if crossfade_state.is_some() {
            if let Some(ref inc) = incoming_track {
                let pos_ms = (inc.current_position_secs() * 1000.0) as u64;
                state.lock().current_position_ms.store(pos_ms, Ordering::Relaxed);
            }
        } else if let Some(ref cur_active) = current_track {
            let pos_ms = (cur_active.current_position_secs() * 1000.0) as u64;
            state.lock().current_position_ms.store(pos_ms, Ordering::Relaxed);
        }

        if track_ended {
            current_track = None;
            is_playing = false;
            state.lock().is_playing.store(false, Ordering::SeqCst);
            if let Some(app) = app_handle.lock().as_ref() {
                let _ = app.emit("track-finished", ());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equal_power_crossfade_curve() {
        for step in 0..=1000 {
            let t = step as f32 / 1000.0;
            let theta = t * (std::f32::consts::PI / 2.0);
            let g_a = theta.cos();
            let g_b = theta.sin();
            let sum_of_squares = g_a * g_a + g_b * g_b;
            assert!(
                (sum_of_squares - 1.0).abs() < 1e-6,
                "Equal-power condition failed at t = {}: sum = {}",
                t,
                sum_of_squares
            );
        }
    }

    #[test]
    fn test_rubato_multi_rate_resampling() {
        let test_rates = [
            (44100, 48000),
            (48000, 44100),
            (88200, 48000),
            (96000, 44100),
            (96000, 48000),
            (176400, 48000),
            (192000, 48000),
            (192000, 44100),
        ];

        let chunk_size = 1024;
        let channels = 2;

        for (in_rate, out_rate) in test_rates {
            let ratio = out_rate as f64 / in_rate as f64;
            let params = InterpolationParameters {
                sinc_len: 64,
                f_cutoff: 0.95,
                interpolation: InterpolationType::Linear,
                oversampling_factor: 128,
                window: WindowFunction::Blackman2,
            };

            let mut resampler = SincFixedIn::<f32>::new(
                ratio,
                2.0,
                params,
                chunk_size,
                channels,
            ).unwrap();

            let dummy_input: Vec<Vec<f32>> = vec![vec![0.5f32; chunk_size]; channels];
            let mut dummy_output = resampler.output_buffer_allocate();

            let res = resampler.process_into_buffer(&dummy_input, &mut dummy_output, None);
            assert!(res.is_ok(), "Failed resampling from {} to {}", in_rate, out_rate);
            assert!(!dummy_output[0].is_empty(), "Output empty for {} to {}", in_rate, out_rate);
        }
    }
}
