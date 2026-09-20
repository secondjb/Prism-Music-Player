use ebur128::{EbuR128, Mode};
use metaflac::Tag;
use parking_lot::Mutex;
use rayon::prelude::*;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use tauri::{AppHandle, Emitter};

static CANCEL_SIGNAL: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TrackLoudnessResult {
    pub path: String,
    pub replay_gain_db: Option<f32>,
    pub replay_gain_peak: Option<f32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReplayGainProgressPayload {
    pub current: usize,
    pub total: usize,
    pub path: String,
    pub replay_gain_db: Option<f32>,
    pub replay_gain_peak: Option<f32>,
    pub error: Option<String>,
    pub is_finished: bool,
}

/// Computes the integrated loudness (LUFS) and true sample peak for a single track.
/// Reference level is -18.0 LUFS (EBU R128 / ReplayGain 2.0 standard).
pub fn analyze_track_replaygain(path: &Path) -> Result<(f32, f32), String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts: FormatOptions = Default::default();
    let metadata_opts: MetadataOptions = Default::default();
    let decoder_opts: DecoderOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Failed to probe audio stream: {}", e))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No default audio track found".to_string())?;

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as u32;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2) as u32;
    let track_id = track.id;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| format!("Failed to initialize audio decoder: {}", e))?;

    let mut ebu = EbuR128::new(channels, sample_rate, Mode::I | Mode::SAMPLE_PEAK)
        .map_err(|e| format!("Failed to initialize EbuR128: {:?}", e))?;

    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        if let Ok(audio_buf) = decoder.decode(&packet) {
            let spec = *audio_buf.spec();
            let num_frames = audio_buf.frames();

            if num_frames == 0 {
                continue;
            }

            if sample_buf.is_none() {
                sample_buf = Some(SampleBuffer::<f32>::new(audio_buf.capacity() as u64, spec));
            }

            if let Some(buf) = sample_buf.as_mut() {
                buf.copy_interleaved_ref(audio_buf);
                let pcm = buf.samples();
                let _ = ebu.add_frames_f32(pcm);
            }
        }
    }

    let integrated_lufs = ebu
        .loudness_global()
        .map_err(|e| format!("Failed to compute integrated loudness: {:?}", e))?;

    // Target reference: -18.0 LUFS
    let gain_db = (-18.0 - integrated_lufs) as f32;

    let mut max_peak = 0.0f32;
    for ch in 0..channels {
        if let Ok(peak) = ebu.sample_peak(ch) {
            if (peak as f32) > max_peak {
                max_peak = peak as f32;
            }
        }
    }

    Ok((gain_db, max_peak))
}

/// Optionally writes calculated ReplayGain tags to the audio file on disk
pub fn write_replaygain_to_file(path_str: &str, gain_db: f32, peak: f32) -> Result<(), String> {
    let path = Path::new(path_str);

    // 1. Try FLAC Vorbis comments first
    if let Ok(mut tag) = Tag::read_from_path(path) {
        let comments = tag.vorbis_comments_mut();
        comments
            .comments
            .insert("REPLAYGAIN_TRACK_GAIN".to_string(), vec![format!("{:.2} dB", gain_db)]);
        comments
            .comments
            .insert("REPLAYGAIN_TRACK_PEAK".to_string(), vec![format!("{:.6}", peak)]);
        let _ = tag.save();
    }

    // 2. Fallback to lofty for MP3, M4A, OGG, WAV, etc.
    use lofty::file::TaggedFileExt;
    use lofty::tag::TagExt;
    if let Ok(mut tagged_file) = lofty::probe::Probe::open(path).and_then(|p| p.read()) {
        let tag = match tagged_file.primary_tag_mut() {
            Some(primary_tag) => primary_tag,
            None => {
                if let Some(first_tag) = tagged_file.first_tag_mut() {
                    first_tag
                } else {
                    let tag_type = tagged_file.primary_tag_type();
                    tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
                    tagged_file
                        .primary_tag_mut()
                        .ok_or_else(|| "Failed to create tag in audio file".to_string())?
                }
            }
        };

        tag.insert_text(
            lofty::tag::ItemKey::ReplayGainTrackGain,
            format!("{:.2} dB", gain_db),
        );
        tag.insert_text(
            lofty::tag::ItemKey::ReplayGainTrackPeak,
            format!("{:.6}", peak),
        );
        let _ = tag.save_to_path(path, lofty::config::WriteOptions::default());
    }

    Ok(())
}

/// Cancels an in-progress ReplayGain batch scan
pub fn cancel_replaygain_scan() {
    CANCEL_SIGNAL.store(true, Ordering::SeqCst);
}

/// Scans a batch of track paths concurrently across background threads with live event progress.
pub fn scan_replaygain_batch(
    app_handle: AppHandle,
    track_paths: Vec<String>,
    write_to_files: bool,
) -> Vec<TrackLoudnessResult> {
    CANCEL_SIGNAL.store(false, Ordering::SeqCst);

    let total = track_paths.len();
    if total == 0 {
        return Vec::new();
    }

    let completed_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let results = Arc::new(Mutex::new(Vec::with_capacity(total)));

    // Use num_cpus - 1 worker threads to avoid any UI or audio stutter
    let num_threads = (num_cpus::get().saturating_sub(1)).max(1);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .build()
        .unwrap_or_else(|_| rayon::ThreadPoolBuilder::new().build().unwrap());

    pool.install(|| {
        track_paths.into_par_iter().for_each(|path_str| {
            if CANCEL_SIGNAL.load(Ordering::SeqCst) {
                return;
            }

            let path = Path::new(&path_str);
            let analysis_res = analyze_track_replaygain(path);

            let (gain_db, peak, err) = match analysis_res {
                Ok((g, p)) => {
                    if write_to_files {
                        let _ = write_replaygain_to_file(&path_str, g, p);
                    }
                    (Some(g), Some(p), None)
                }
                Err(e) => (None, None, Some(e)),
            };

            let item = TrackLoudnessResult {
                path: path_str.clone(),
                replay_gain_db: gain_db,
                replay_gain_peak: peak,
                error: err.clone(),
            };

            {
                let mut guard = results.lock();
                guard.push(item);
            }

            let current = completed_count.fetch_add(1, Ordering::SeqCst) + 1;

            let _ = app_handle.emit(
                "replaygain-scan-progress",
                ReplayGainProgressPayload {
                    current,
                    total,
                    path: path_str,
                    replay_gain_db: gain_db,
                    replay_gain_peak: peak,
                    error: err,
                    is_finished: current == total,
                },
            );
        });
    });

    let final_results = results.lock().clone();
    // Sort final results in matching order or return
    final_results
}
