use std::path::Path;
use stratum_dsp::{analyze_audio, AnalysisConfig};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Result of audio waveform analysis
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioAnalysisResult {
    pub bpm: Option<u32>,
    pub key: Option<String>,
}

/// Analyze audio file waveform using stratum-dsp to estimate BPM and Key
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

    // Decode up to 35 seconds of mono PCM audio samples (skipping first 5 seconds for intros)
    let max_samples = (sample_rate as usize) * 35;
    let skip_samples = (sample_rate as usize) * 5;
    let mut samples: Vec<f32> = Vec::with_capacity(max_samples);
    let mut total_read = 0;

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
                total_read += 1;
                if total_read < skip_samples {
                    continue;
                }

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

        if samples.len() >= max_samples {
            break;
        }
    }

    if samples.len() < (sample_rate as usize) * 3 {
        return AudioAnalysisResult { bpm: None, key: None };
    }

    // Pass the decoded f32 sample vector into stratum_dsp::analyze_audio
    let config = AnalysisConfig::default();
    match analyze_audio(&samples, sample_rate, config) {
        Ok(result) => {
            let bpm = if result.bpm > 0.0 && result.bpm.is_finite() {
                Some(result.bpm.round() as u32)
            } else {
                None
            };

            let key = Some(result.key.name());

            AudioAnalysisResult { bpm, key }
        }
        Err(e) => {
            eprintln!("stratum-dsp analysis failed: {:?}", e);
            AudioAnalysisResult { bpm: None, key: None }
        }
    }
}
