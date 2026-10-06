import React from 'react';
import {
  ShieldAlert,
  Sparkles,
  RefreshCw,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  Download,
  AlertTriangle,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  CURRENT_APP_VERSION,
  GITHUB_RELEASES_URL,
  openExternalLink,
} from '../../utils/updateChecker';

interface SystemSettingsSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
}

export const SystemSettingsSection: React.FC<SystemSettingsSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
}) => {
  const wipeDataAndReset = usePlayerStore((s) => s.wipeDataAndReset);
  const autoCheckUpdates = usePlayerStore((s) => s.autoCheckUpdates);
  const toggleAutoCheckUpdates = usePlayerStore((s) => s.toggleAutoCheckUpdates);
  const latestUpdateResult = usePlayerStore((s) => s.latestUpdateResult);
  const isCheckingUpdate = usePlayerStore((s) => s.isCheckingUpdate);
  const checkAppUpdate = usePlayerStore((s) => s.checkAppUpdate);

  const [showWipeModal, setShowWipeModal] = React.useState(false);

  if (!shouldShow) return null;

  return (
    <>
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
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-bold text-white">System, Updates & Danger Zone</h3>
              <p className="text-xs text-zinc-400 truncate">
                Prism {CURRENT_APP_VERSION}, GitHub release updates, and application factory reset
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
              {CURRENT_APP_VERSION}
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
            {/* Version & Update Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                  }}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">Prism Music Player</h4>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                        color: 'var(--color-stop-1, #6366f1)',
                      }}
                    >
                      {CURRENT_APP_VERSION}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">High-fidelity desktop audio player</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => checkAppUpdate(true)}
                  disabled={isCheckingUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition-all hover:scale-105 border disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <span>{isCheckingUpdate ? 'Checking...' : 'Check for Updates'}</span>
                </button>

                <button
                  onClick={() => openExternalLink(GITHUB_RELEASES_URL)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 border cursor-pointer"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-2, #8b5cf6) 25%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-2, #8b5cf6) 40%, transparent)',
                    color: 'var(--color-stop-2, #8b5cf6)',
                  }}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Releases</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Release update banner if checked */}
            {latestUpdateResult && (
              <div>
                {latestUpdateResult.hasUpdate ? (
                  <div
                    className="p-3.5 rounded-xl border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      background:
                        'linear-gradient(to right, color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, #09090b), color-mix(in srgb, var(--color-stop-2, #8b5cf6) 25%, #09090b))',
                      borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        New Release Available: {latestUpdateResult.latestVersion}
                      </span>
                      <span className="text-[10px] text-zinc-400">A newer build is ready on GitHub.</span>
                    </div>

                    <button
                      onClick={() => openExternalLink(latestUpdateResult.releaseUrl)}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shadow-md hover:scale-105 transition-transform cursor-pointer"
                      style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {latestUpdateResult.latestVersion}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Prism is up to date ({CURRENT_APP_VERSION})</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto check updates toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Check Updates on Startup</span>
                <span className="text-[10px] text-zinc-400">Automatically check GitHub releases on launch</span>
              </div>
              <Checkbox
                checked={autoCheckUpdates}
                onChange={toggleAutoCheckUpdates}
                size="small"
                sx={{
                  color: 'var(--color-stop-1, #6366f1)',
                  '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                  p: 0.5,
                }}
              />
            </div>

            {/* Danger Zone: Reset App Data */}
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Reset App Data & Synced Folders</span>
                  <span className="text-[11px] text-zinc-400">
                    Removes library index and settings. Music files on disk are never touched.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowWipeModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all hover:scale-105 shadow-md shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Wipe Data</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wipe Confirmation Modal */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirm Reset App Data</h4>
                <p className="text-xs text-rose-300 font-medium">Are you sure you want to reset Prism?</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
              This will remove all synced folder paths, wipe cached library data, clear your queue and liked songs, and stop accessing your directories.
              <br /><br />
              <strong className="text-emerald-400">Note:</strong> None of your actual music files or folders on your device will be deleted or altered.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowWipeModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowWipeModal(false);
                  await wipeDataAndReset();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md shadow-rose-950/50 cursor-pointer"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
