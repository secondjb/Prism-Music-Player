import React from 'react';
import {
  BarChart2,
  Sparkles,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../../store/usePlayerStore';
import { deleteListeningHistory } from '../../utils/stats';

interface StatsSettingsSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
}

export const StatsSettingsSection: React.FC<StatsSettingsSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
}) => {
  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  const toggleStatsCollection = usePlayerStore((s) => s.toggleStatsCollection);
  const showDemoStats = usePlayerStore((s) => s.showDemoStats);
  const toggleShowDemoStats = usePlayerStore((s) => s.toggleShowDemoStats);
  const anonymizeStats = usePlayerStore((s) => s.anonymizeStats);
  const toggleAnonymizeStats = usePlayerStore((s) => s.toggleAnonymizeStats);
  const generateDemoPlaylists = usePlayerStore((s) => s.generateDemoPlaylists);

  const [demoPlaylistsCreated, setDemoPlaylistsCreated] = React.useState(false);
  const [historyCleared, setHistoryCleared] = React.useState(false);

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
            <BarChart2 className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white">Listening Statistics & Analytics</h3>
            <p className="text-xs text-zinc-400 truncate">
              Play history tracking, privacy anonymization, demo sample playlists & resets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
            {isStatsCollectionEnabled ? 'Stats Enabled' : 'Stats Disabled'}
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
        <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-3 mt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {/* Enable Listening Stats */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Enable Listening Stats</span>
                  <span className="text-[10px] text-zinc-400">Log play counts to build personalized stats</span>
                </div>
              </div>
              <Checkbox
                checked={isStatsCollectionEnabled}
                onChange={() => toggleStatsCollection()}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            {/* Show Simulated Stats */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Show Simulated Demo Stats</span>
                  <span className="text-[10px] text-zinc-400">Populate demo analytics in dashboard</span>
                </div>
              </div>
              <Checkbox
                checked={showDemoStats}
                onChange={() => toggleShowDemoStats()}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            {/* Anonymize Stats */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Anonymize Stats Names</span>
                  <span className="text-[10px] text-zinc-400">Use placeholder names for screenshots</span>
                </div>
              </div>
              <Checkbox
                checked={anonymizeStats}
                onChange={() => toggleAnonymizeStats()}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            {/* Generate Demo Playlists */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-2, #8b5cf6)' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Curated Demo Playlists</span>
                  <span className="text-[10px] text-zinc-400">Auto-create sample curated playlists</span>
                </div>
              </div>
              <button
                onClick={() => {
                  generateDemoPlaylists();
                  setDemoPlaylistsCreated(true);
                  setTimeout(() => setDemoPlaylistsCreated(false), 3000);
                }}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-2, #8b5cf6) 25%, transparent)',
                  color: 'var(--color-stop-2, #8b5cf6)',
                }}
              >
                {demoPlaylistsCreated ? 'Created!' : 'Generate'}
              </button>
            </div>

            {/* Clear Listening History */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Clear Listening History</span>
                  <span className="text-[10px] text-zinc-400">Reset plays, top rankings & charts</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete all recorded listening history?')) {
                    await deleteListeningHistory();
                    setHistoryCleared(true);
                    setTimeout(() => setHistoryCleared(false), 3000);
                  }
                }}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 transition-colors cursor-pointer"
              >
                {historyCleared ? 'Cleared!' : 'Clear Stats'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
