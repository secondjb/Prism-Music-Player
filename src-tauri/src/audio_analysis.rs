use rubato::{InterpolationParameters, InterpolationType, Resampler, SincFixedIn, WindowFunction};
use std::path::Path;
use stratum_dsp::{analyze_audio, AnalysisConfig};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioAnalysisResult {
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

/// Analyze audio file waveform to estimate BPM and Key efficiently
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

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as u32;
    let track_id = track.id;

    let mut decoder = match symphonia::default::get_codecs().make(&track.codec_params, &decoder_opts) {
        Ok(d) => d,
        Err(_) => return AudioAnalysisResult { bpm: None, key: None },
    };

    // TURBO MODE OPTIMIZATIONS:
    // Skip first 45 seconds (focusing on chorus/drop), collect 15 seconds of full-resolution mono audio
    let max_samples = (sample_rate as usize) * 15;
    let skip_samples = (sample_rate as usize) * 45;
    let mut samples: Vec<f32> = Vec::with_capacity(max_samples);
    let mut total_read = 0;

    // Allocate the sample buffer OUTSIDE the loop to avoid continuous heap allocations
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

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

            // Lazily instantiate and reuse buffer capacity
            if sample_buf.is_none() {
                sample_buf = Some(SampleBuffer::<f32>::new(audio_buf.capacity() as u64, spec));
            }

            if let Some(buf) = sample_buf.as_mut() {
                buf.copy_interleaved_ref(audio_buf);
                let pcm = buf.samples();

                for frame in 0..num_frames {
                    total_read += 1;
                    if total_read < skip_samples {
                        continue;
                    }

                    // Downmix interleaved channels to mono
                    let mut sum = 0.0f32;
                    for c in 0..num_channels {
                        let idx = frame * num_channels + c;
                        if idx < pcm.len() {
                            sum += pcm[idx];
                        }
                    }
                    samples.push(sum / (num_channels as f32));

                    if samples.len() >= max_samples {
                        break;
                    }
                }
            }
        }

        if samples.len() >= max_samples {
            break;
        }
    }

    if samples.len() < (sample_rate as usize) * 3 {
        return AudioAnalysisResult { bpm: None, key: None };
    }

    // High-resolution Audio Anti-Aliased Resampling via Rubato (downsample >48kHz to 44.1kHz)
    let (final_samples, final_sample_rate) = if sample_rate > 48000 {
        let target_sr = 44100u32;
        let resample_ratio = target_sr as f64 / sample_rate as f64;
        
        let params = InterpolationParameters {
            sinc_len: 128,
            f_cutoff: 0.95,
            interpolation: InterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        // Pass the total sample length as the chunk size to process in one pass
        let mut resampler = match SincFixedIn::<f32>::new(
            resample_ratio,
            2.0,
            params,
            samples.len(),
            1,
        ) {
            Ok(r) => r,
            Err(_) => return AudioAnalysisResult { bpm: None, key: None },
        };

        // Rubato expects a vector of channels; we have 1 mono channel
        let input_waves = vec![samples];
        
        let out_vec = match resampler.process(&input_waves, None) {
            Ok(mut resampled) => resampled.pop().unwrap_or_default(),
            Err(_) => return AudioAnalysisResult { bpm: None, key: None },
        };

        (out_vec, target_sr)
    } else {
        (samples, sample_rate)
    };

    let config = AnalysisConfig::default();
    match analyze_audio(&final_samples, final_sample_rate, config) {
        Ok(result) => {
            let bpm = if result.bpm > 0.0 && result.bpm.is_finite() {
                let mut bpm_val = result.bpm;
                if bpm_val < 80.0 {
                    bpm_val *= 2.0;
                } else if bpm_val > 190.0 {
                    bpm_val /= 2.0;
                }
                Some(bpm_val.round() as u32)
            } else {
                None
            };

            AudioAnalysisResult {
                bpm,
                key: Some(result.key.name()),
            }
        }
        Err(e) => {
            eprintln!("stratum-dsp analysis failed: {:?}", e);
            AudioAnalysisResult { bpm: None, key: None }
        }
    }
}
