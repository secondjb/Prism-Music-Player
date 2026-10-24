import React, { useState } from 'react';
import {
  Smartphone,
  ChevronDown,
  RefreshCw,
  QrCode,
  Radio,
  Database,
  Monitor,
  Check,
  Copy,
  Laptop,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  regenerateP2pToken,
  sendP2pStatsSync,
  setP2pActiveDevice,
} from '../../utils/p2pSync';

interface CompanionSyncSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
  onOpenPairingModal: () => void;
}

export const CompanionSyncSection: React.FC<CompanionSyncSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
  onOpenPairingModal,
}) => {
  const p2pSyncInfo = usePlayerStore((s) => s.p2pSyncInfo);
  const setP2pSyncInfo = usePlayerStore((s) => s.setP2pSyncInfo);
  const p2pConnectedClients = usePlayerStore((s) => s.p2pConnectedClients);
  const p2pActiveDeviceId = usePlayerStore((s) => s.p2pActiveDeviceId);
  const setP2pActiveDeviceId = usePlayerStore((s) => s.setP2pActiveDeviceId);

  const [isRotating, setIsRotating] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!shouldShow) return null;

  const handleRotateSecret = async () => {
    setIsRotating(true);
    try {
      const updated = await regenerateP2pToken();
      setP2pSyncInfo(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRotating(false);
    }
  };

  const handleSyncStats = async () => {
    setIsSyncingStats(true);
    setSyncFeedback(null);
    try {
      const count = await sendP2pStatsSync();
      setSyncFeedback(`Broadcasted ${count} listening events to companions.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (e: any) {
      setSyncFeedback(`Sync failed: ${e?.message || e}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncingStats(false);
    }
  };

  const handleSwapTarget = async () => {
    const next = p2pActiveDeviceId === 'desktop' ? 'local' : 'desktop';
    setP2pActiveDeviceId(next);
    try {
      await setP2pActiveDevice(next);
    } catch (e) {
      console.error(e);
    }
  };

  const rawString =
    p2pSyncInfo?.raw_pairing_string ||
    `${p2pSyncInfo?.host || '127.0.0.1'}:9876:${p2pSyncInfo?.token || ''}`;

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
            <Smartphone className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Android Companion & P2P Sync</h3>
              <Chip
                size="small"
                label={p2pConnectedClients > 0 ? `${p2pConnectedClients} Active` : 'Ready'}
                sx={{
                  height: 20,
                  fontSize: '10px',
                  fontWeight: 600,
                  bgcolor: p2pConnectedClients > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: p2pConnectedClients > 0 ? '#34d399' : '#a1a1aa',
                  border: '1px solid',
                  borderColor: p2pConnectedClients > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                }}
              />
            </div>
            <p className="text-xs text-zinc-400 truncate">
              Local Wi-Fi discovery, QR pairing, remote control, and listening history synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
              isCollapsed ? '' : 'rotate-180'
            }`}
          />
        </div>
      </div>

      {/* Accordion Body */}
      {!isCollapsed && (
        <div className="p-5 border-t border-white/5 space-y-5">
          {/* Status Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>LAN WebSocket Server</span>
              </div>
              <div className="text-xs font-semibold text-white font-mono">
                ws://{p2pSyncInfo?.host || '127.0.0.1'}:{p2pSyncInfo?.port || 9876}/prism-sync
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Connected Companions</span>
              </div>
              <div className="text-xs font-semibold text-white">
                {p2pConnectedClients} device{p2pConnectedClients === 1 ? '' : 's'} paired
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
              <div className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                {p2pActiveDeviceId === 'desktop' ? (
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Active Audio Output</span>
              </div>
              <div className="text-xs font-semibold text-white capitalize">
                {p2pActiveDeviceId === 'desktop' ? 'Windows Desktop' : 'Android Companion'}
              </div>
            </div>
          </div>

          {/* Quick Pairing & Connect Card */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white mb-0.5">Quick Pairing & Remote Control</div>
                <div className="text-[11px] text-zinc-400">
                  Scan QR with your phone, or connect two laptops manually with the pairing code.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="contained"
                size="small"
                onClick={onOpenPairingModal}
                startIcon={<QrCode className="w-3.5 h-3.5" />}
                sx={{
                  bgcolor: 'var(--color-stop-1, #6366f1)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  px: 2,
                  py: 0.75,
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 80%, black)',
                  },
                }}
              >
                Pair / Connect Laptop
              </Button>
            </div>
          </div>

          {/* Direct Code & Manual Entry (No Camera) */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Manual Pairing Code (For Devices Without Camera):</span>
              </div>
              <div className="font-mono text-emerald-400 truncate select-all">{rawString}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip title={copied ? 'Copied code!' : 'Copy Code (host:port:token)'} arrow>
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(rawString);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  sx={{ color: copied ? '#34d399' : '#a1a1aa' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Regenerate Pairing Token" arrow>
                <IconButton
                  size="small"
                  onClick={handleRotateSecret}
                  disabled={isRotating}
                  sx={{ color: '#a1a1aa' }}
                >
                  <RefreshCw size={14} className={isRotating ? 'animate-spin' : ''} />
                </IconButton>
              </Tooltip>
            </div>
          </div>

          {/* Hardened Security Assurance Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Hardened LAN Isolation:</strong> The 32-character authentication secret is never broadcast over mDNS. Only devices holding this exact pairing code can connect. Remote commands are strictly limited to playback controls.
            </span>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="small"
                onClick={handleSyncStats}
                disabled={isSyncingStats}
                startIcon={<Database className="w-3.5 h-3.5 text-cyan-400" />}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e4e4e7',
                  borderRadius: '10px',
                  py: 0.75,
                  fontSize: '11px',
                  textTransform: 'none',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                Sync Stats to Companion
              </Button>

              <Button
                variant="outlined"
                size="small"
                onClick={handleSwapTarget}
                startIcon={
                  p2pActiveDeviceId === 'desktop' ? (
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  )
                }
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e4e4e7',
                  borderRadius: '10px',
                  py: 0.75,
                  fontSize: '11px',
                  textTransform: 'none',
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                {p2pActiveDeviceId === 'desktop' ? 'Switch Audio to Companion' : 'Switch Audio to Desktop'}
              </Button>
            </div>

            {syncFeedback && (
              <span className="text-xs text-emerald-400 font-medium">{syncFeedback}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
