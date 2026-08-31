use std::path::Path;
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

// Krumhansl-Schmuckler Key Profiles for 12 Major and 12 Minor Keys
const MAJOR_PROFILE: [f32; 12] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE: [f32; 12] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 2.98, 2.69, 3.34, 3.17];

const NOTE_NAMES: [&str; 12] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/// Result of audio waveform analysis
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioAnalysisResult {
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

/// Analyze audio file waveform to estimate BPM and Key using STFT Chromagram and Spectral Flux
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
    let n_frames = track.codec_params.n_frames;

    let mut decoder = match symphonia::default::get_codecs().make(&track.codec_params, &decoder_opts) {
        Ok(d) => d,
        Err(_) => return AudioAnalysisResult { bpm: None, key: None },
    };

    // Extract 3 representative 15-second windows at 25%, 50%, and 75% of the song
    let window_secs = 15;
    let window_samples = sample_rate * window_secs;

    let mut windows: Vec<Vec<f32>> = Vec::new();

    // If seeking is supported and total frames known, seek to target positions
    if let Some(total_f) = n_frames {
        if total_f > (sample_rate as u64 * 30) {
            let marks = [0.25f64, 0.50f64, 0.75f64];
            for &pct in &marks {
                let target_ts = (total_f as f64 * pct) as u64;
                if format.seek(SeekMode::Coarse, SeekTo::TimeStamp { ts: target_ts, track_id }).is_ok() {
                    decoder.reset();
                    if let Some(chunk) = decode_pcm_window(&mut format, &mut decoder, track_id, window_samples) {
                        if chunk.len() >= sample_rate * 5 {
                            windows.push(chunk);
                        }
                    }
                }
            }
        }
    }

    // Fallback: Streaming decode if seeking didn't produce windows
    if windows.is_empty() {
        let stream_windows = decode_streaming_windows(&mut format, &mut decoder, track_id, sample_rate);
        for w in stream_windows {
            if w.len() >= sample_rate * 5 {
                windows.push(w);
            }
        }
    }

    if windows.is_empty() {
        return AudioAnalysisResult { bpm: None, key: None };
    }

    // Downsample each window to 11025 Hz for efficient STFT processing
    let target_rate = 11025;
    let step = (sample_rate / target_rate).max(1);

    let mut bpms: Vec<u32> = Vec::new();
    let mut key_candidates: Vec<(String, f32)> = Vec::new();

    for w in &windows {
        let downsampled: Vec<f32> = w.iter().step_by(step).copied().collect();
        if downsampled.len() < target_rate * 5 {
            continue;
        }

        if let Some(bpm) = estimate_bpm_spectral_flux(&downsampled, target_rate) {
            bpms.push(bpm);
        }

        if let Some((key, score)) = estimate_key_stft(&downsampled, target_rate) {
            key_candidates.push((key, score));
        }
    }

    // Median BPM across windows to avoid intro/outro anomalies
    let final_bpm = if !bpms.is_empty() {
        bpms.sort_unstable();
        Some(bpms[bpms.len() / 2])
    } else {
        None
    };

    // Highest confidence key across windows
    let final_key = key_candidates
        .into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(k, _)| k);

    AudioAnalysisResult {
        bpm: final_bpm,
        key: final_key,
    }
}

/// Decode a mono PCM window of given sample length
fn decode_pcm_window(
    format: &mut Box<dyn symphonia::core::formats::FormatReader>,
    decoder: &mut Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    max_samples: usize,
) -> Option<Vec<f32>> {
    let mut samples: Vec<f32> = Vec::with_capacity(max_samples);

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        if let Ok(audio_buf) = decoder.decode(&packet) {
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
                let mut sum = 0.0f32;
                for c in 0..num_channels {
                    let idx = frame * num_channels + c;
                    if idx < pcm.len() {
                        sum += pcm[idx];
                    }
                }
                samples.push(sum / (num_channels as f32));
                if samples.len() >= max_samples {
                    return Some(samples);
                }
            }
        }
    }

    if samples.is_empty() {
        None
    } else {
        Some(samples)
    }
}

/// Streaming decode fallback collecting up to three 15-second windows (at 10-25s, 40-55s, 70-85s)
fn decode_streaming_windows(
    format: &mut Box<dyn symphonia::core::formats::FormatReader>,
    decoder: &mut Box<dyn symphonia::core::codecs::Decoder>,
    track_id: u32,
    sample_rate: usize,
) -> Vec<Vec<f32>> {
    let mut windows = Vec::new();
    let win_len = sample_rate * 15;

    // Boundaries in total frames decoded
    let w1_start = sample_rate * 10;
    let w1_end = w1_start + win_len;
    let w2_start = sample_rate * 40;
    let w2_end = w2_start + win_len;
    let w3_start = sample_rate * 70;
    let w3_end = w3_start + win_len;

    let mut w1 = Vec::with_capacity(win_len);
    let mut w2 = Vec::with_capacity(win_len);
    let mut w3 = Vec::with_capacity(win_len);

    let mut current_frame = 0;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }

        if let Ok(audio_buf) = decoder.decode(&packet) {
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
                let f_idx = current_frame;
                current_frame += 1;

                if (f_idx >= w1_start && f_idx < w1_end)
                    || (f_idx >= w2_start && f_idx < w2_end)
                    || (f_idx >= w3_start && f_idx < w3_end)
                {
                    let mut sum = 0.0f32;
                    for c in 0..num_channels {
                        let idx = frame * num_channels + c;
                        if idx < pcm.len() {
                            sum += pcm[idx];
                        }
                    }
                    let mono = sum / (num_channels as f32);

                    if f_idx >= w1_start && f_idx < w1_end {
                        w1.push(mono);
                    } else if f_idx >= w2_start && f_idx < w2_end {
                        w2.push(mono);
                    } else if f_idx >= w3_start && f_idx < w3_end {
                        w3.push(mono);
                    }
                }

                if f_idx >= w3_end {
                    break;
                }
            }

            if current_frame >= w3_end {
                break;
            }
        }
    }

    if !w1.is_empty() { windows.push(w1); }
    if !w2.is_empty() { windows.push(w2); }
    if !w3.is_empty() { windows.push(w3); }
    windows
}

/// Estimate Musical Key using Short-Time Fourier Transform (STFT) via rustfft and log-frequency Chromagram
fn estimate_key_stft(samples: &[f32], sample_rate: usize) -> Option<(String, f32)> {
    let window_size = 2048;
    let hop_size = 512;

    if samples.len() < window_size {
        return None;
    }

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(window_size);

    // Precompute Hanning window
    let hanning: Vec<f32> = (0..window_size)
        .map(|n| 0.5 * (1.0 - (2.0 * std::f32::consts::PI * n as f32 / (window_size - 1) as f32).cos()))
        .collect();

    let mut chroma = [0.0f32; 12];
    let mut fft_buffer = vec![Complex { re: 0.0f32, im: 0.0f32 }; window_size];

    let bin_freq_step = sample_rate as f32 / window_size as f32; // ~5.38 Hz per bin

    // Map FFT bins to semitone pitch classes (approx. C2 at ~65 Hz to C7 at ~2093 Hz)
    let min_freq = 65.0f32;
    let max_freq = 2093.0f32;

    for chunk_start in (0..samples.len().saturating_sub(window_size)).step_by(hop_size) {
        let chunk = &samples[chunk_start..chunk_start + window_size];

        for i in 0..window_size {
            fft_buffer[i] = Complex {
                re: chunk[i] * hanning[i],
                im: 0.0,
            };
        }

        fft.process(&mut fft_buffer);

        for k in 1..(window_size / 2) {
            let freq = k as f32 * bin_freq_step;
            if freq >= min_freq && freq <= max_freq {
                let mag = (fft_buffer[k].re * fft_buffer[k].re + fft_buffer[k].im * fft_buffer[k].im).sqrt();
                // MIDI pitch number from frequency: 69 + 12 * log2(freq / 440.0)
                let midi_pitch = 12.0 * (freq / 440.0).log2() + 69.0;
                let pitch_class = (midi_pitch.round() as i32).rem_euclid(12) as usize;
                chroma[pitch_class] += mag;
            }
        }
    }

    // Normalize chromagram vector
    let sum: f32 = chroma.iter().sum();
    if sum < 1e-6 {
        return None;
    }
    for c in &mut chroma {
        *c /= sum;
    }

    // Correlate chromagram with 12 Major and 12 Minor keys using Krumhansl-Schmuckler profiles
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
            best_key = Some((format!("{} Major", NOTE_NAMES[shift]), major_score));
        }

        let minor_score = pearson_correlation(&rotated, &MINOR_PROFILE);
        if minor_score > best_score {
            best_score = minor_score;
            best_key = Some((format!("{} Minor", NOTE_NAMES[shift]), minor_score));
        }
    }

    best_key
}

/// Estimate BPM using Spectral Flux onset detection across STFT frames with parabolic peak interpolation
fn estimate_bpm_spectral_flux(samples: &[f32], sample_rate: usize) -> Option<u32> {
    let window_size = 1024;
    let hop_size = 128; // High temporal resolution (~86.13 Hz frame rate at 11025 Hz)

    if samples.len() < window_size * 2 {
        return None;
    }

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(window_size);

    let hanning: Vec<f32> = (0..window_size)
        .map(|n| 0.5 * (1.0 - (2.0 * std::f32::consts::PI * n as f32 / (window_size - 1) as f32).cos()))
        .collect();

    let mut fft_buffer = vec![Complex { re: 0.0f32, im: 0.0f32 }; window_size];
    let mut prev_mag = vec![0.0f32; window_size / 2];
    let mut spectral_flux = Vec::new();

    for chunk_start in (0..samples.len().saturating_sub(window_size)).step_by(hop_size) {
        let chunk = &samples[chunk_start..chunk_start + window_size];

        for i in 0..window_size {
            fft_buffer[i] = Complex {
                re: chunk[i] * hanning[i],
                im: 0.0,
            };
        }

        fft.process(&mut fft_buffer);

        let mut flux = 0.0f32;
        // Ignore low sub-rumble bins (k < 2)
        for k in 2..(window_size / 2) {
            let mag = (fft_buffer[k].re * fft_buffer[k].re + fft_buffer[k].im * fft_buffer[k].im).sqrt();
            let diff = mag - prev_mag[k];
            if diff > 0.0 {
                flux += diff;
            }
            prev_mag[k] = mag;
        }

        spectral_flux.push(flux);
    }

    let num_frames = spectral_flux.len();
    if num_frames < 200 {
        return None;
    }

    // Adaptive local thresholding / subtraction to isolate sharp onsets
    let mut onset = vec![0.0f32; num_frames];
    let half_win = 8;
    for i in 0..num_frames {
        let start = i.saturating_sub(half_win);
        let end = (i + half_win).min(num_frames);
        let local_mean = spectral_flux[start..end].iter().sum::<f32>() / (end - start) as f32;
        let val = spectral_flux[i] - local_mean;
        if val > 0.0 {
            onset[i] = val;
        }
    }

    let frame_rate = sample_rate as f32 / hop_size as f32; // ~86.1328 Hz

    let min_bpm = 55.0f32;
    let max_bpm = 195.0f32;

    let min_lag = (frame_rate * 60.0 / max_bpm).round() as usize; // ~26 frames
    let max_lag = (frame_rate * 60.0 / min_bpm).round() as usize; // ~94 frames

    if max_lag >= num_frames {
        return None;
    }

    let mut corrs = vec![0.0f32; max_lag + 2];

    for lag in min_lag..=max_lag {
        let mut sum = 0.0f32;
        let mut count = 0;
        for i in 0..(num_frames - lag) {
            sum += onset[i] * onset[i + lag];
            count += 1;
        }
        if count > 0 {
            corrs[lag] = sum / count as f32;
        }
    }

    // Apply log-normal tempo prior centered around 125 BPM
    let mut best_lag = 0;
    let mut max_score = -1.0f32;

    for lag in min_lag..=max_lag {
        let raw = corrs[lag];
        if raw <= 0.0 {
            continue;
        }

        let bpm_cand = frame_rate * 60.0 / lag as f32;
        let log_ratio = (bpm_cand / 125.0).ln();
        let prior_weight = (-0.5 * (log_ratio / 0.45).powi(2)).exp();

        let score = raw * (0.60 + 0.40 * prior_weight);
        if score > max_score {
            max_score = score;
            best_lag = lag;
        }
    }

    if best_lag == 0 || best_lag <= min_lag || best_lag >= max_lag {
        return None;
    }

    // Parabolic interpolation for sub-frame precision
    let y1 = corrs[best_lag - 1];
    let y2 = corrs[best_lag];
    let y3 = corrs[best_lag + 1];
    let denom = 2.0 * (2.0 * y2 - y1 - y3);
    let delta = if denom.abs() > 1e-6 {
        (y1 - y3) / denom
    } else {
        0.0
    };

    let refined_lag = best_lag as f32 + delta.clamp(-0.5, 0.5);
    let final_bpm = (frame_rate * 60.0 / refined_lag).round() as u32;

    if (50..=220).contains(&final_bpm) {
        Some(final_bpm)
    } else {
        None
    }
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
