import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Timer, Music, X } from 'lucide-react';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const startSleepTimer = usePlayerStore((s) => s.startSleepTimer);
  const cancelSleepTimer = usePlayerStore((s) => s.cancelSleepTimer);
  const [tab, setTab] = useState<'time' | 'tracks'>('time');
  const [customTime, setCustomTime] = useState<number>(30);
  const [customTracks, setCustomTracks] = useState<number>(3);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-28 right-8 w-[380px] z-[60] p-0 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full glass-panel rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[var(--color-stop-1)] flex items-center justify-center">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sleep Timer</h2>
              <p className="text-xs text-zinc-400">Automatically stop playback</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner if active */}
        {sleepTimer.active && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-[var(--color-stop-1)] text-xs">
            <span className="font-medium">
              Active: {sleepTimer.mode === 'time'
                ? `Stops in ${Math.ceil(sleepTimer.remainingSeconds / 60)} min(s)`
                : `Stops after ${sleepTimer.remainingTracks} track(s)`}
            </span>
            <button
              onClick={cancelSleepTimer}
              className="px-2.5 py-1 rounded-lg text-white font-semibold transition-colors hover:brightness-110"
              style={{ backgroundColor: 'var(--color-stop-1)' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Modes tab */}
        <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setTab('time')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'time' ? 'text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={tab === 'time' ? { backgroundColor: 'var(--color-stop-1)' } : undefined}
          >
            <Timer className="w-4 h-4" />
            Time-based
          </button>
          <button
            onClick={() => setTab('tracks')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'tracks' ? 'text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={tab === 'tracks' ? { backgroundColor: 'var(--color-stop-1)' } : undefined}
          >
            <Music className="w-4 h-4" />
            Track-based
          </button>
        </div>

        {/* Content options */}
        {tab === 'time' ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400 font-medium">Select minutes:</p>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    startSleepTimer('time', mins);
                    onClose();
                  }}
                  className="py-2.5 rounded-xl glass-card text-sm font-semibold text-zinc-200 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  {mins}m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="300"
                value={customTime}
                onChange={(e) => setCustomTime(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-stop-1)]"
                placeholder="Custom mins"
              />
              <button
                onClick={() => {
                  startSleepTimer('time', customTime);
                  onClose();
                }}
                className="px-4 py-2 text-white hover:brightness-110 text-xs font-semibold rounded-xl shrink-0 transition-colors" style={{ backgroundColor: 'var(--color-stop-1)' }}
              >
                Set Custom
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400 font-medium">Select number of tracks:</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 5].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => {
                    startSleepTimer('tracks', cnt);
                    onClose();
                  }}
                  className="py-2.5 rounded-xl glass-card text-sm font-semibold text-zinc-200 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  {cnt} track{cnt > 1 ? 's' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="50"
                value={customTracks}
                onChange={(e) => setCustomTracks(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-stop-1)]"
                placeholder="Custom tracks"
              />
              <button
                onClick={() => {
                  startSleepTimer('tracks', customTracks);
                  onClose();
                }}
                className="px-4 py-2 text-white hover:brightness-110 text-xs font-semibold rounded-xl shrink-0 transition-colors" style={{ backgroundColor: 'var(--color-stop-1)' }}
              >
                Set Custom
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
