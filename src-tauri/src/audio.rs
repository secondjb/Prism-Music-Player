use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::StreamConfig;
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

pub struct AudioPlayerState {
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<Mutex<f32>>,
    pub replay_gain_db: Arc<Mutex<f32>>,
    pub seek_secs: Arc<Mutex<Option<f64>>>,
    pub current_position_secs: Arc<Mutex<f64>>,
    pub current_duration_secs: Arc<Mutex<f64>>,
    pub stop_signal: Arc<AtomicBool>,
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
        }
    }
}

pub struct GlobalAudioEngine {
    pub state: Arc<Mutex<AudioPlayerState>>,
}

unsafe impl Send for GlobalAudioEngine {}
unsafe impl Sync for GlobalAudioEngine {}

impl GlobalAudioEngine {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(AudioPlayerState::new())),
        }
    }

    pub fn play(&self, file_path: String, replay_gain_db: f32) -> Result<(), String> {
        let state_guard = self.state.lock();

        // Signal existing thread to stop
        state_guard.stop_signal.store(true, Ordering::SeqCst);
        thread::sleep(Duration::from_millis(50));

        let stop_signal = Arc::new(AtomicBool::new(false));
        let is_playing = Arc::new(AtomicBool::new(true));
        let volume = Arc::clone(&state_guard.volume);
        let replay_gain = Arc::new(Mutex::new(replay_gain_db));
        let seek_secs = Arc::new(Mutex::new(None));
        let current_position_secs = Arc::clone(&state_guard.current_position_secs);
        let current_duration_secs = Arc::clone(&state_guard.current_duration_secs);

        *state_guard.replay_gain_db.lock() = replay_gain_db;
        state_guard.is_playing.store(true, Ordering::SeqCst);

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

        thread::spawn(move || {
            if let Err(e) = run_audio_thread(
                &path_clone,
                stop_signal_clone,
                is_playing_clone,
                volume_clone,
                replay_gain_clone,
                seek_secs_clone,
                position_clone,
                duration_clone,
            ) {
                eprintln!("Audio thread error: {}", e);
            }
        });

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

    pub fn get_position(&self) -> f64 {
        let state = self.state.lock();
        let pos = *state.current_position_secs.lock();
        pos
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
) -> Result<(), String> {
    let file = File::open(Path::new(path_str)).map_err(|e| format!("Failed to open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path_str).extension() {
        hint.with_extension(&ext.to_string_lossy());
    }

    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|e| format!("Unsupported format: {}", e))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No default audio track".to_string())?;

    let track_id = track.id;
    let time_base = track.codec_params.time_base;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    if let Some(n_frames) = track.codec_params.n_frames {
        let duration = n_frames as f64 / sample_rate as f64;
        *current_duration_secs.lock() = duration;
    }

    let dec_opts: DecoderOptions = Default::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &dec_opts)
        .map_err(|e| format!("Decoder creation error: {}", e))?;

    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "No output audio device found".to_string())?;

    let config = StreamConfig {
        channels: channels as u16,
        sample_rate: cpal::SampleRate(sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    let (tx, rx) = crossbeam_channel::bounded::<f32>(sample_rate as usize * channels * 2);

    let stream = device
        .build_output_stream(
            &config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                for sample in data.iter_mut() {
                    *sample = rx.try_recv().unwrap_or(0.0);
                }
            },
            move |err| eprintln!("CPAL Stream error: {}", err),
            None,
        )
        .map_err(|e| format!("Failed to build output stream: {}", e))?;

    stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;

    let mut sample_buf = None;

    loop {
        if stop_signal.load(Ordering::SeqCst) {
            break;
        }

        if let Some(target_secs) = seek_secs.lock().take() {
            if let Some(tb) = time_base {
                let ts = (target_secs / tb.calc_time(1).seconds as f64) as u64;
                let _ = format.seek(
                    symphonia::core::formats::SeekMode::Accurate,
                    symphonia::core::formats::SeekTo::TimeStamp { ts, track_id },
                );
                *current_position_secs.lock() = target_secs;
            }
        }

        if !is_playing.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(20));
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
            let pos_secs = tb.calc_time(current_frame_ts).seconds as f64
                + tb.calc_time(current_frame_ts).frac;
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
                    sample_buf = Some(symphonia::core::audio::SampleBuffer::<f32>::new(
                        cap, spec,
                    ));
                }

                if let Some(ref mut buf) = sample_buf {
                    buf.copy_interleaved_ref(decoded);
                    for &sample in buf.samples() {
                        let gain_adjusted = sample * linear_gain;
                        let _ = tx.send(gain_adjusted);
                    }
                }
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }

    Ok(())
}
