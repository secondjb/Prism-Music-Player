import React, { useEffect, useState, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { invoke } from '@tauri-apps/api/core';
import {
  Speaker,
  X,
  CheckCircle2,
  Activity,
  Music2,
  Sliders,
  RefreshCw,
  Volume2,
  Layers,
} from 'lucide-react';

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
  is_active: boolean;
  default_sample_rate: number;
  default_channels: number;
  default_format: string;
  min_sample_rate: number;
  max_sample_rate: number;
  supported_channels: number[];
  supported_formats: string[];
}

export interface AudioOutputDetails {
  devices: AudioDeviceInfo[];
  active_device_name: string;
  active_sample_rate: number;
  active_channels: number;
  active_format: string;
  is_playing: boolean;
}

interface AudioDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioDeviceModal: React.FC<AudioDeviceModalProps> = ({ isOpen, onClose }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [details, setDetails] = useState<AudioOutputDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!window.__TAURI_INTERNALS__) return;
    try {
      setIsLoading(true);
      const res = await invoke<AudioOutputDetails>('get_audio_output_details');
      setDetails(res);
    } catch (e) {
      console.warn('Failed to fetch audio output details:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
      const interval = setInterval(fetchDetails, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchDetails]);

  const handleSelectDevice = async (dev: AudioDeviceInfo) => {
    try {
      const targetName = dev.is_default ? null : dev.name;
      await invoke('set_audio_output_device', { deviceName: targetName });
      await fetchDetails();
    } catch (e) {
      console.warn('Failed to set audio output device:', e);
    }
  };

  if (!isOpen) return null;

  // Format file type from path
  const fileExt = currentTrack?.path
    ? currentTrack.path.split('.').pop()?.toUpperCase() || 'AUDIO'
    : 'FLAC';

  const trackRateKhz = currentTrack?.sample_rate ? (currentTrack.sample_rate / 1000).toFixed(1) : '44.1';
  const trackBitDepth = currentTrack?.bit_depth || 16;
  const trackBitrate = currentTrack?.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kbps` : null;

  const activeDeviceRateKhz = details?.active_sample_rate
    ? (details.active_sample_rate / 1000).toFixed(1)
    : '48.0';

  const isBitPerfect =
    currentTrack &&
    details &&
    details.active_sample_rate > 0 &&
    currentTrack.sample_rate === details.active_sample_rate;

  const isHiRes =
    (currentTrack?.sample_rate && currentTrack.sample_rate >= 88200) ||
    trackBitDepth >= 24;

  return (
    <>
      {/* Backdrop to close modal */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        className="fixed bottom-28 right-6 w-[440px] max-w-[calc(100vw-2rem)] z-50 p-0 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full glass-panel rounded-2xl border border-white/10 shadow-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  boxShadow: '0 0 15px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                }}
              >
                <Speaker className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Audio Output & Quality
                  {isHiRes && (
                    <span
                      className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider text-white shadow-xs"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
                      }}
                    >
                      Hi-Res
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-zinc-400">Hardware playback capabilities & stream info</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchDetails}
                disabled={isLoading}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Refresh Devices"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 1: What quality it IS playing (Active Playback Stream) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                Active Playback Quality
              </span>
              <span
                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border"
                style={{
                  color: isBitPerfect ? '#34d399' : 'var(--color-stop-1, #6366f1)',
                  borderColor: isBitPerfect ? 'rgba(52, 211, 153, 0.3)' : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                  backgroundColor: isBitPerfect ? 'rgba(52, 211, 153, 0.1)' : 'color-mix(in srgb, var(--color-stop-1, #6366f1) 10%, transparent)',
                }}
              >
                {isBitPerfect ? '● Bit-Perfect Direct' : '● WASAPI Hardware Output'}
              </span>
            </div>

            {currentTrack ? (
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 6%, rgba(24, 24, 27, 0.75))',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.1))',
                }}
              >
                {/* Track Details */}
                <div className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-white truncate block max-w-[240px]">
                      {currentTrack.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate block max-w-[240px]">
                      {currentTrack.artist}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                        color: 'var(--color-stop-1, #6366f1)',
                      }}
                    >
                      {fileExt}
                    </span>
                    {trackBitrate && (
                      <span className="text-[10px] font-mono text-zinc-400 mt-0.5">{trackBitrate}</span>
                    )}
                  </div>
                </div>

                {/* Stream Resolution Match Visualization */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  {/* Source Track Quality */}
                  <div className="flex flex-col gap-0.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase font-medium">Source Audio</span>
                    <span className="font-mono font-bold text-white text-[13px]">
                      {trackRateKhz} <span className="text-[11px] text-zinc-400">kHz</span>
                    </span>
                    <span className="text-[11px] text-zinc-300 font-mono">
                      {trackBitDepth}-bit • {currentTrack.channels === 1 ? 'Mono' : 'Stereo'}
                    </span>
                  </div>

                  {/* Output Hardware Stream */}
                  <div className="flex flex-col gap-0.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] text-zinc-400 uppercase font-medium">Output Stream</span>
                    <span
                      className="font-mono font-bold text-[13px]"
                      style={{ color: 'var(--color-stop-1, #6366f1)' }}
                    >
                      {activeDeviceRateKhz} <span className="text-[11px] text-zinc-400">kHz</span>
                    </span>
                    <span className="text-[11px] text-zinc-300 font-mono">
                      {details?.active_format || 'F32'} • {details?.active_channels === 1 ? 'Mono' : 'Stereo'}
                    </span>
                  </div>
                </div>

                {/* Resampling Note if not matching */}
                {!isBitPerfect && details && details.active_sample_rate > 0 && (
                  <div className="text-[10px] text-zinc-400 bg-white/5 p-2 rounded-lg flex items-center gap-1.5 border border-white/5">
                    <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>
                      Hardware resampled: {trackRateKhz} kHz is smoothly synchronized to {activeDeviceRateKhz} kHz native clock.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 text-center flex flex-col items-center gap-1 text-xs text-zinc-400">
                <Music2 className="w-6 h-6 text-zinc-600 mb-1" />
                <span className="text-zinc-300 font-medium">No Track Currently Playing</span>
                <span className="text-[11px]">
                  Output engine ready at {activeDeviceRateKhz} kHz • {details?.active_format || '32-bit Float'}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: What quality it CAN play (Output Devices & Hardware Capabilities) */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                Connected Output Devices & Capabilities
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {details?.devices.length || 0} device{details?.devices.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {details?.devices && details.devices.length > 0 ? (
                details.devices.map((dev) => {
                  const isActive = dev.is_active || dev.name === details.active_device_name;
                  const maxKhz = (dev.max_sample_rate / 1000).toFixed(1);
                  const minKhz = (dev.min_sample_rate / 1000).toFixed(1);
                  const defaultKhz = (dev.default_sample_rate / 1000).toFixed(1);
                  const deviceIsHiRes = dev.max_sample_rate >= 88200;

                  return (
                    <div
                      key={dev.name}
                      onClick={() => handleSelectDevice(dev)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${
                        isActive
                          ? 'shadow-md'
                          : 'bg-zinc-900/50 hover:bg-zinc-900/80 border-white/10 hover:border-white/20'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 12%, rgba(24, 24, 27, 0.8))',
                              borderColor: 'var(--color-stop-1, #6366f1)',
                              boxShadow: '0 4px 20px -4px color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                            }
                          : undefined
                      }
                    >
                      {/* Device Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Volume2
                            className="w-4 h-4 shrink-0"
                            style={{
                              color: isActive ? 'var(--color-stop-1, #6366f1)' : '#a1a1aa',
                            }}
                          />
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                            }`}
                            title={dev.name}
                          >
                            {dev.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {dev.is_default && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 border border-white/10">
                              System Default
                            </span>
                          )}
                          {isActive && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white flex items-center gap-1 shadow-xs"
                              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Device Capabilities Specs */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono bg-black/25 p-2 rounded-lg border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-sans">Supported Quality:</span>
                          <span className="text-zinc-200 font-semibold">
                            {minKhz === maxKhz ? `${defaultKhz} kHz` : `${minKhz} – ${maxKhz} kHz`}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-sans">Capabilities:</span>
                          <span className="text-zinc-200 font-semibold flex items-center gap-1">
                            {deviceIsHiRes ? (
                              <span style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                                Hi-Res Audio (Up to {maxKhz}k)
                              </span>
                            ) : (
                              'CD Lossless (48k)'
                            )}
                          </span>
                        </div>

                        <div className="col-span-2 flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/5">
                          <span>
                            Channels: {dev.default_channels === 1 ? 'Mono' : dev.default_channels === 2 ? 'Stereo (2ch)' : `${dev.default_channels}ch Surround`}
                          </span>
                          <span>
                            Formats: {dev.supported_formats.join(', ') || dev.default_format}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-zinc-400 p-4 rounded-xl border border-white/10 bg-zinc-900/50 text-center">
                  Loading audio devices...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
