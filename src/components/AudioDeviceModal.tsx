import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  EyeOff,
  Eye,
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

const STORAGE_KEY_HIDDEN_DEVICES = 'prism_hidden_audio_devices';

interface AudioDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioDeviceModal: React.FC<AudioDeviceModalProps> = ({ isOpen, onClose }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [details, setDetails] = useState<AudioOutputDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Load hidden devices from localStorage
  const [hiddenDeviceNames, setHiddenDeviceNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HIDDEN_DEVICES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside modal without blurring or blocking the bottom bar
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (modalRef.current && !modalRef.current.contains(target as Node)) {
        if (target && target.closest('[data-audio-speaker-btn]')) {
          return;
        }
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onClose]);

  // Persist hidden devices to localStorage
  const toggleHideDevice = (e: React.MouseEvent, devName: string) => {
    e.stopPropagation();
    setHiddenDeviceNames((prev) => {
      const next = prev.includes(devName)
        ? prev.filter((name) => name !== devName)
        : [...prev, devName];
      try {
        localStorage.setItem(STORAGE_KEY_HIDDEN_DEVICES, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save hidden devices to localStorage', err);
      }
      return next;
    });
  };

  const fetchDetails = useCallback(async (force = false) => {
    if (!window.__TAURI_INTERNALS__) return;
    try {
      if (force) setIsLoading(true);
      const res = await invoke<AudioOutputDetails>('get_audio_output_details', { forceRefresh: force });
      setDetails(res);
    } catch (e) {
      console.warn('Failed to fetch audio output details:', e);
    } finally {
      if (force) setIsLoading(false);
    }
  }, []);

  // Fetch details ONCE when modal is opened
  useEffect(() => {
    if (isOpen) {
      fetchDetails(false);
    }
  }, [isOpen, fetchDetails]);

  const handleSelectDevice = async (dev: AudioDeviceInfo) => {
    // If device is already active, do nothing! Never restart the stream redundantly.
    if (dev.is_active || dev.name === details?.active_device_name) {
      return;
    }

    // 1. Instant optimistic UI update
    setDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        active_device_name: dev.name,
        active_sample_rate: dev.default_sample_rate,
        active_channels: dev.default_channels,
        active_format: dev.default_format,
        devices: prev.devices.map((d) => ({
          ...d,
          is_active: d.name === dev.name,
        })),
      };
    });

    try {
      const targetName = dev.is_default ? null : dev.name;
      await invoke('set_audio_output_device', { deviceName: targetName });
      const updated = await invoke<AudioOutputDetails>('get_audio_output_details', { forceRefresh: false });
      setDetails(updated);
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

  const allDevices = details?.devices || [];
  const visibleDevices = allDevices.filter((d) => !hiddenDeviceNames.includes(d.name));
  const hiddenDevices = allDevices.filter((d) => hiddenDeviceNames.includes(d.name));
  const hiddenCount = hiddenDevices.length;

  return (
    <div
      ref={modalRef}
      className="fixed bottom-28 right-6 w-[450px] max-w-[calc(100vw-2rem)] z-50 p-0 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full glass-panel rounded-2xl border border-white/10 shadow-2xl p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
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
              onClick={() => fetchDetails(true)}
              disabled={isLoading}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Rescan audio devices"
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

        {/* Section 1: Active Playback Quality */}
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
                    Hardware resampled: {trackRateKhz} kHz synchronized to {activeDeviceRateKhz} kHz native clock.
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

        {/* Section 2: Output Devices & Hardware Capabilities */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              Output Devices & Capabilities
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {visibleDevices.length} visible
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {allDevices.length > 0 ? (
              <>
                {/* Render Visible Devices */}
                {visibleDevices.map((dev) => {
                  const isActive = dev.is_active || dev.name === details?.active_device_name;
                  const maxKhz = (dev.max_sample_rate / 1000).toFixed(1);
                  const minKhz = (dev.min_sample_rate / 1000).toFixed(1);
                  const defaultKhz = (dev.default_sample_rate / 1000).toFixed(1);
                  const deviceIsHiRes = dev.max_sample_rate >= 88200;

                  return (
                    <div
                      key={dev.name}
                      onClick={() => handleSelectDevice(dev)}
                      className={`p-3 rounded-xl border transition-all ${
                        isActive
                          ? 'shadow-md cursor-default'
                          : 'bg-zinc-900/50 hover:bg-zinc-900/80 border-white/10 hover:border-white/20 cursor-pointer'
                      } group relative`}
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
                        <div className="flex items-center gap-2 min-w-0 flex-1">
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
                          {isActive ? (
                            <span
                              className="text-[9px] font-bold px-2 py-0.5 rounded text-white flex items-center gap-1 shadow-xs"
                              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-medium px-2 py-0.5 rounded bg-white/5 group-hover:bg-white/10 group-hover:text-white transition-colors">
                              Click to use
                            </span>
                          )}

                          {/* Hide Device Button */}
                          <button
                            onClick={(e) => toggleHideDevice(e, dev.name)}
                            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 rounded transition-colors ml-0.5"
                            title="Hide this audio output"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
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
                                Hi-Res Audio ({maxKhz}k)
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
                })}

                {/* Render Hidden Devices (if expanded) */}
                {showHidden &&
                  hiddenDevices.map((dev) => {
                    const isActive = dev.is_active || dev.name === details?.active_device_name;
                    return (
                      <div
                        key={`hidden-${dev.name}`}
                        className="p-2.5 rounded-xl border border-dashed border-white/10 bg-zinc-950/40 text-xs flex items-center justify-between gap-2 opacity-75 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-zinc-400 text-xs truncate" title={dev.name}>
                            {dev.name}
                          </span>
                          {isActive && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                            >
                              Active
                            </span>
                          )}
                        </div>

                        <button
                          onClick={(e) => toggleHideDevice(e, dev.name)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-medium flex items-center gap-1 transition-colors shrink-0"
                          title="Unhide this audio output"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Unhide</span>
                        </button>
                      </div>
                    );
                  })}

                {/* Professional Toggle for Hidden Outputs */}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setShowHidden(!showHidden)}
                    className="w-full py-2 px-3 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {showHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                        <span>Hide {hiddenCount} Hidden Output{hiddenCount > 1 ? 's' : ''}</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{hiddenCount} Output Device{hiddenCount > 1 ? 's' : ''} Hidden • Click to Show</span>
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs text-zinc-400 p-4 rounded-xl border border-white/10 bg-zinc-900/50 text-center">
                Loading audio devices...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
