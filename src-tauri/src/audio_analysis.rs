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

    // Collect up to 25 seconds of mono PCM audio samples (skip first 5 seconds if possible)
    let target_samples = sample_rate * 25;
    let skip_samples = sample_rate * 5;

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

    if samples.len() < sample_rate * 5 {
        return AudioAnalysisResult { bpm: None, key: None };
    }

    // Downsample to 11025 Hz for ultra-fast processing
    let target_rate = 11025;
    let step = (sample_rate / target_rate).max(1);
    let downsampled: Vec<f32> = samples.iter().step_by(step).copied().collect();

    let bpm = estimate_bpm(&downsampled, target_rate);
    let key = estimate_key(&downsampled, target_rate);

    AudioAnalysisResult { bpm, key }
}

/// Estimate BPM from mono audio buffer using envelope autocorrelation
fn estimate_bpm(samples: &[f32], sample_rate: usize) -> Option<u32> {
    let frame_size = 256;
    let num_frames = samples.len() / frame_size;
    if num_frames < 100 {
        return None;
    }

    // Compute frame energies
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

    // Onset energy derivative (positive changes only)
    let mut onset = vec![0.0f32; num_frames];
    for f in 1..num_frames {
        let diff = energies[f] - energies[f - 1];
        if diff > 0.0 {
            onset[f] = diff;
        }
    }

    // Autocorrelation for tempo lags corresponding to 60 BPM to 180 BPM
    let frame_rate = sample_rate as f32 / frame_size as f32; // ~43.06 Hz

    let min_bpm = 60.0f32;
    let max_bpm = 180.0f32;

    let min_lag = (frame_rate * 60.0 / max_bpm).round() as usize;
    let max_lag = (frame_rate * 60.0 / min_bpm).round() as usize;

    let mut best_lag = 0;
    let mut max_corr = -1.0f32;

    for lag in min_lag..=max_lag {
        let mut corr = 0.0f32;
        let mut count = 0;

        for i in 0..(num_frames - lag) {
            corr += onset[i] * onset[i + lag];
            count += 1;
        }

        if count > 0 {
            corr /= count as f32;
            if corr > max_corr {
                max_corr = corr;
                best_lag = lag;
            }
        }
    }

    if best_lag > 0 {
        let bpm_val = (frame_rate * 60.0 / best_lag as f32).round() as u32;
        if (50..=220).contains(&bpm_val) {
            return Some(bpm_val);
        }
    }

    None
}

/// Estimate Musical Key using Pitch Class Profile (Chromagram) and Krumhansl-Schmuckler profiles
fn estimate_key(samples: &[f32], sample_rate: usize) -> Option<String> {
    let mut chroma = [0.0f32; 12];

    // Evaluate DFT Goertzel energy for notes across 4 octaves (C3 to B6, ~130 Hz to 1975 Hz)
    let f0_c3 = 130.81f32;

    for note in 0..12 {
        let mut note_energy = 0.0f32;
        for octave in 0..4 {
            let freq = f0_c3 * (2.0f32).powf((note as f32 + octave as f32 * 12.0) / 12.0);
            let omega = 2.0 * std::f32::consts::PI * freq / sample_rate as f32;
            let cos_w = omega.cos();
            let coeff = 2.0 * cos_w;

            let mut s_prev = 0.0f32;
            let mut s_prev2 = 0.0f32;

            for &s in samples.iter().take(4096) {
                let s_curr = s + coeff * s_prev - s_prev2;
                s_prev2 = s_prev;
                s_prev = s_curr;
            }

            let power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;
            note_energy += power.max(0.0).sqrt();
        }
        chroma[note] = note_energy;
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
