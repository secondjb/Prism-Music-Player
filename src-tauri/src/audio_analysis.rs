use std::path::Path;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

// Krumhansl-Schmuckler Key Profiles for 12 Major and 12 Minor Keys
const MAJOR_PROFILE: [f32; 12] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE: [f32; 12] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 2.98, 2.69, 3.34, 3.17];

const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/// Result of audio waveform analysis
#[derive(Debug)]
pub struct AudioAnalysisResult {
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

/// Analyze audio file waveform to estimate BPM and Key
pub fn analyze_audio_waveform(path: &Path) -> AudioAnalysisResult {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return AudioAnalysisResult { bpm: None, key: None },
    };

    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts: FormatOptions = Default::default();
    let metadata_opts: MetadataOptions = Default::default();
    let decoder_opts: DecoderOptions = Default::default();

    let probed = match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
        Ok(p) => p,
        Err(_) => return AudioAnalysisResult { bpm: None, key: None },
    };

    let mut format = probed.format;

    let track = match format.default_track() {
        Some(t) => t,
        None => return AudioAnalysisResult { bpm: None, key: None },
    };

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as usize;
    let track_id = track.id;

    let mut decoder = match symphonia::default::get_codecs().make(&track.codec_params, &decoder_opts) {
        Ok(d) => d,
        Err(_) => return AudioAnalysisResult { bpm: None, key: None },
    };

    // Collect up to 40 seconds of mono PCM audio samples (skip first 2 seconds)
    let target_samples = sample_rate * 40;
    let skip_samples = sample_rate * 2;

    let mut samples: Vec<f32> = Vec::with_capacity(target_samples);
    let mut total_read = 0;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(audio_buf) => {
                let spec = *audio_buf.spec();
                let num_channels = spec.channels.count();
                let num_frames = audio_buf.frames();

                if num_frames == 0 {
                    continue;
                }

                let mut sample_buf = symphonia::core::audio::SampleBuffer::<f32>::new(
                    audio_buf.capacity() as u64,
                    spec,
                );
                sample_buf.copy_interleaved_ref(audio_buf);
                let pcm = sample_buf.samples();

                for frame in 0..num_frames {
                    total_read += 1;
                    if total_read < skip_samples {
                        continue;
                    }

                    // Convert channels to mono
                    let mut sum = 0.0f32;
                    for c in 0..num_channels {
                        let idx = frame * num_channels + c;
                        if idx < pcm.len() {
                            sum += pcm[idx];
                        }
                    }
                    samples.push(sum / (num_channels as f32));

                    if samples.len() >= target_samples {
                        break;
                    }
                }
            }
            Err(_) => break,
        }

        if samples.len() >= target_samples {
            break;
        }
    }

    if samples.len() < sample_rate * 3 {
        return AudioAnalysisResult { bpm: None, key: None };
    }

    // Downsample to 11025 Hz for fast processing
    let target_rate = 11025;
    let step = (sample_rate / target_rate).max(1);
    let downsampled: Vec<f32> = samples.iter().step_by(step).copied().collect();

    let bpm = estimate_bpm(&downsampled, target_rate);
    let key = estimate_key(&downsampled, target_rate);

    AudioAnalysisResult { bpm, key }
}

/// Estimate BPM from mono audio buffer using onset autocorrelation & log-normal tempo prior weighting
fn estimate_bpm(samples: &[f32], sample_rate: usize) -> Option<u32> {
    let frame_size = 256;
    let num_frames = samples.len() / frame_size;
    if num_frames < 100 {
        return None;
    }

    // Compute frame energies with onset envelope derivative
    let mut energies = Vec::with_capacity(num_frames);
    for f in 0..num_frames {
        let start = f * frame_size;
        let mut e = 0.0f32;
        for i in 0..frame_size {
            let s = samples[start + i];
            e += s * s;
        }
        energies.push(e.sqrt());
    }

    let mut onset = vec![0.0f32; num_frames];
    for f in 1..num_frames {
        let diff = energies[f] - energies[f - 1];
        if diff > 0.0 {
            onset[f] = diff;
        }
    }

    // Autocorrelation for tempo lags corresponding to 55 BPM to 195 BPM
    let frame_rate = sample_rate as f32 / frame_size as f32; // ~43.066 Hz

    let min_bpm = 55.0f32;
    let max_bpm = 195.0f32;

    let min_lag = (frame_rate * 60.0 / max_bpm).round() as usize;
    let max_lag = (frame_rate * 60.0 / min_bpm).round() as usize;

    if max_lag >= num_frames {
        return None;
    }

    let mut raw_corrs = vec![0.0f32; max_lag + 1];

    for lag in min_lag..=max_lag {
        let mut corr = 0.0f32;
        let mut count = 0;

        for i in 0..(num_frames - lag) {
            corr += onset[i] * onset[i + lag];
            count += 1;
        }

        if count > 0 {
            raw_corrs[lag] = corr / (count as f32);
        }
    }

    // Weighted correlation with a broad log-normal tempo prior centered around 125 BPM
    let mut best_lag = 0;
    let mut max_weighted_score = -1.0f32;

    for lag in min_lag..=max_lag {
        let raw = raw_corrs[lag];
        if raw <= 0.0 {
            continue;
        }

        let bpm_cand = frame_rate * 60.0 / lag as f32;
        let log_ratio = (bpm_cand / 125.0).ln();
        let prior_weight = (-0.5 * (log_ratio / 0.50).powi(2)).exp();

        let score = raw * (0.6 + 0.4 * prior_weight);
        if score > max_weighted_score {
            max_weighted_score = score;
            best_lag = lag;
        }
    }

    if best_lag == 0 {
        return None;
    }

    let final_bpm = (frame_rate * 60.0 / best_lag as f32).round() as u32;
    if (50..=220).contains(&final_bpm) {
        Some(final_bpm)
    } else {
        None
    }
}

/// Estimate Musical Key using Hanning-windowed Goertzel chromagram across 5 octaves (C2 to B6) & Krumhansl-Schmuckler profiles
fn estimate_key(samples: &[f32], sample_rate: usize) -> Option<String> {
    let mut chroma = [0.0f32; 12];

    // Evaluate DFT Goertzel energy for notes across 5 octaves (C2 to B6, ~65.4 Hz to 1975 Hz)
    let f0_c2 = 65.4063f32;
    let window_size = 4096;
    let step_size = 2048; // 50% overlap

    if samples.len() < window_size {
        return None;
    }

    // Precompute Hanning window function
    let hanning: Vec<f32> = (0..window_size)
        .map(|n| 0.5 * (1.0 - (2.0 * std::f32::consts::PI * n as f32 / (window_size - 1) as f32).cos()))
        .collect();

    let mut window_count = 0;

    for chunk_start in (0..samples.len().saturating_sub(window_size)).step_by(step_size) {
        let chunk = &samples[chunk_start..chunk_start + window_size];
        window_count += 1;

        for note in 0..12 {
            for octave in 0..5 {
                let freq = f0_c2 * (2.0f32).powf((note as f32 + octave as f32 * 12.0) / 12.0);
                let omega = 2.0 * std::f32::consts::PI * freq / sample_rate as f32;
                let cos_w = omega.cos();
                let coeff = 2.0 * cos_w;

                let mut s_prev = 0.0f32;
                let mut s_prev2 = 0.0f32;

                for (i, &s) in chunk.iter().enumerate() {
                    let windowed_sample = s * hanning[i];
                    let s_curr = windowed_sample + coeff * s_prev - s_prev2;
                    s_prev2 = s_prev;
                    s_prev = s_curr;
                }

                let power = (s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2).max(0.0).sqrt();
                chroma[note] += power;
            }
        }
    }

    if window_count == 0 {
        return None;
    }

    // Normalize chromagram vector
    let sum: f32 = chroma.iter().sum();
    if sum < 1e-6 {
        return None;
    }
    for c in &mut chroma {
        *c /= sum;
    }

    // Correlate chromagram with 12 Major and 12 Minor keys
    let mut best_score = -1e9f32;
    let mut best_key = None;

    for shift in 0..12 {
        let mut rotated = [0.0f32; 12];
        for i in 0..12 {
            rotated[i] = chroma[(i + shift) % 12];
        }

        let major_score = pearson_correlation(&rotated, &MAJOR_PROFILE);
        if major_score > best_score {
            best_score = major_score;
            best_key = Some(format!("{} Major", NOTE_NAMES[shift]));
        }

        let minor_score = pearson_correlation(&rotated, &MINOR_PROFILE);
        if minor_score > best_score {
            best_score = minor_score;
            best_key = Some(format!("{} Minor", NOTE_NAMES[shift]));
        }
    }

    best_key
}

fn pearson_correlation(x: &[f32; 12], y: &[f32; 12]) -> f32 {
    let mean_x: f32 = x.iter().sum::<f32>() / 12.0;
    let mean_y: f32 = y.iter().sum::<f32>() / 12.0;

    let mut num = 0.0f32;
    let mut den_x = 0.0f32;
    let mut den_y = 0.0f32;

    for i in 0..12 {
        let dx = x[i] - mean_x;
        let dy = y[i] - mean_y;
        num += dx * dy;
        den_x += dx * dx;
        den_y += dy * dy;
    }

    let den = (den_x * den_y).sqrt();
    if den < 1e-6 {
        0.0
    } else {
        num / den
    }
}
