import React from 'react';
import {
  Volume2,
  Waves,
  ChevronDown,
} from 'lucide-react';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../../store/usePlayerStore';
import { M3Selector } from '../M3Selector';

const REPLAY_GAIN_OPTIONS = [
  { id: 'track', name: 'Track Gain (Recommended)', desc: 'Normalizes each track individually to standard loudness' },
  { id: 'album', name: 'Album Gain', desc: 'Preserves dynamic volume balance across album tracks' },
  { id: 'off', name: 'Disabled', desc: 'Play raw unadjusted source volume' },
] as const;

interface AudioSettingsSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
  onNotifyReplayGain: (msg: string) => void;
}

export const AudioSettingsSection: React.FC<AudioSettingsSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
  onNotifyReplayGain,
}) => {
  const tracks = usePlayerStore((s) => s.tracks);
  const isGaplessEnabled = usePlayerStore((s) => s.isGaplessEnabled);
  const toggleGaplessEnabled = usePlayerStore((s) => s.toggleGaplessEnabled);
  const crossfadeDuration = usePlayerStore((s) => s.crossfadeDuration);
  const setCrossfadeDuration = usePlayerStore((s) => s.setCrossfadeDuration);
  const replayGainMode = usePlayerStore((s) => s.replayGainMode);
  const setReplayGainMode = usePlayerStore((s) => s.setReplayGainMode);

  const totalTracks = tracks.length;
  const replayGainCount = React.useMemo(
    () => tracks.filter((t) => t.replay_gain_db !== undefined && t.replay_gain_db !== null).length,
    [tracks]
  );

  if (!shouldShow) return null;

  return (
    <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
      {/* Accordion Header */}
      <div
        onClick={onToggleCollapse}
        className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
          isCollapsed ? 'rounded-2xl' : 'rounded-t-2xl'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Volume2 className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white">Audio Engine & Playback</h3>
            <p className="text-xs text-zinc-400 truncate">
              True gapless preloading, equal-power crossfading, and ReplayGain loudness normalization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
            {isGaplessEnabled ? 'Gapless On' : 'Gapless Off'} • RG: {replayGainMode.toUpperCase()}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
              !isCollapsed ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Accordion Content */}
      {!isCollapsed && (
        <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-4 mt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {/* Gapless Playback Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-start gap-2.5 min-w-0">
                <Waves className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white">Gapless Playback</span>
                  <span className="text-[11px] text-zinc-400 leading-tight">
                    Preloads next audio stream in memory for seamless live transitions
                  </span>
                </div>
              </div>
              <Checkbox
                checked={isGaplessEnabled}
                onChange={toggleGaplessEnabled}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            {/* Equal-Power Crossfade Slider */}
            <div className="flex flex-col justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-2 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <span className="text-xs font-semibold text-white">Crossfade Duration</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/10 text-white font-semibold">
                  {crossfadeDuration === 0 ? 'Off (0s)' : `${crossfadeDuration}s`}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                Smoothly crossfades between consecutive tracks using an equal-power curve to prevent volume dips. Set to 0s for gapless transitions.
              </span>
              <div className="px-1 pt-1">
                <Slider
                  value={crossfadeDuration}
                  min={0}
                  max={12}
                  step={1}
                  marks={[
                    { value: 0, label: '0s' },
                    { value: 2, label: '2s' },
                    { value: 4, label: '4s' },
                    { value: 6, label: '6s' },
                    { value: 8, label: '8s' },
                    { value: 10, label: '10s' },
                    { value: 12, label: '12s' },
                  ]}
                  onChange={(_, val) => setCrossfadeDuration(val as number)}
                  valueLabelDisplay="auto"
                />
              </div>
            </div>

            {/* ReplayGain Mode Selector */}
            <div className="flex flex-col justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <Volume2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white">ReplayGain Loudness</span>
                  <span className="text-[11px] text-zinc-400 leading-tight">
                    Dynamic volume normalization using track/album tags
                  </span>
                </div>
              </div>
              <div className="w-full">
                <M3Selector
                  value={replayGainMode}
                  onChange={(val) => {
                    const newMode = val as any;
                    setReplayGainMode(newMode);
                    if (newMode !== 'off') {
                      const untagged = totalTracks - replayGainCount;
                      if (untagged > 0) {
                        onNotifyReplayGain(
                          `ReplayGain (${newMode} mode) enabled. ${untagged} track${
                            untagged === 1 ? '' : 's'
                          } lack loudness data — run the ReplayGain Scanner in Library Settings to normalize.`
                        );
                      }
                    }
                  }}
                  options={REPLAY_GAIN_OPTIONS}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
