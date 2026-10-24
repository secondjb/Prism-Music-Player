import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Database,
  Monitor,
  X,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  fetchP2pSyncInfo,
  regenerateP2pToken,
  sendP2pStatsSync,
  setP2pActiveDevice,
  setupAdbReverse,
} from '../utils/p2pSync';

interface CompanionPairingModalProps {
  open: boolean;
  onClose: () => void;
}

export const CompanionPairingModal: React.FC<CompanionPairingModalProps> = ({
  open,
  onClose,
}) => {
  const p2pSyncInfo = usePlayerStore((s) => s.p2pSyncInfo);
  const setP2pSyncInfo = usePlayerStore((s) => s.setP2pSyncInfo);
  const p2pConnectedClients = usePlayerStore((s) => s.p2pConnectedClients);
  const p2pActiveDeviceId = usePlayerStore((s) => s.p2pActiveDeviceId);
  const setP2pActiveDeviceId = usePlayerStore((s) => s.setP2pActiveDeviceId);
  const p2pPairedClients = usePlayerStore((s) => s.p2pPairedClients);
  const removeP2pPairedClient = usePlayerStore((s) => s.removeP2pPairedClient);

  const [connectionMode, setConnectionMode] = useState<'wifi' | 'usb'>('wifi');
  const [copiedType, setCopiedType] = useState<'uri' | 'string' | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [statsSyncMessage, setStatsSyncMessage] = useState<string | null>(null);
  const [isSettingUpAdb, setIsSettingUpAdb] = useState(false);
  const [adbMessage, setAdbMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchP2pSyncInfo()
        .then((info) => setP2pSyncInfo(info))
        .catch((err) => console.debug('Failed to get sync info:', err));
    }
  }, [open, setP2pSyncInfo]);

  const handleCopy = (text: string, type: 'uri' | 'string') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleRotateToken = async () => {
    setIsRotating(true);
    try {
      const updated = await regenerateP2pToken();
      setP2pSyncInfo(updated);
    } catch (e) {
      console.error('Failed to rotate pairing token:', e);
    } finally {
      setIsRotating(false);
    }
  };

  const handleSyncStats = async () => {
    setIsSyncingStats(true);
    setStatsSyncMessage(null);
    try {
      const count = await sendP2pStatsSync();
      setStatsSyncMessage(`Successfully broadcasted ${count} listening events to companion!`);
      setTimeout(() => setStatsSyncMessage(null), 4000);
    } catch (e: any) {
      setStatsSyncMessage(`Sync failed: ${e?.message || e}`);
      setTimeout(() => setStatsSyncMessage(null), 4000);
    } finally {
      setIsSyncingStats(false);
    }
  };

  const handleToggleActiveDevice = async () => {
    const nextTarget = p2pActiveDeviceId === 'desktop' ? 'local' : 'desktop';
    setP2pActiveDeviceId(nextTarget);
    try {
      await setP2pActiveDevice(nextTarget);
    } catch (e) {
      console.error('Failed to switch active device:', e);
    }
  };

  const handleSetupAdb = async () => {
    setIsSettingUpAdb(true);
    setAdbMessage(null);
    try {
      const res = await setupAdbReverse();
      setAdbMessage(res.message);
      if (res.success) {
        setConnectionMode('usb');
      }
    } catch (e: any) {
      setAdbMessage(`ADB error: ${e?.message || e}`);
    } finally {
      setIsSettingUpAdb(false);
    }
  };

  const effectiveHost = connectionMode === 'usb' ? '127.0.0.1' : p2pSyncInfo?.host || '127.0.0.1';
  const effectivePort = p2pSyncInfo?.port || 9876;
  const token = p2pSyncInfo?.token || '';
  const deviceName = encodeURIComponent(
    connectionMode === 'usb'
      ? `${p2pSyncInfo?.device_name || 'Prism Desktop'} (USB)`
      : p2pSyncInfo?.device_name || 'Prism Desktop'
  );

  const pairingUri = `prism://pair?host=${effectiveHost}&port=${effectivePort}&token=${token}&name=${deviceName}`;
  const rawString = `${effectiveHost}:${effectivePort}:${token}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#121217',
            color: '#ffffff',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          },
        },
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Prism Companion Pairing
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Connect your Android phone over LAN for remote control & stats sync
            </p>
          </div>
        </div>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          <X size={18} />
        </IconButton>
      </div>

      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <div className="flex flex-col items-center">
          {/* Status Badges */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>mDNS Beacon: <strong className="text-white font-mono">_prism-sync._tcp</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-400">
                Port: <strong className="text-white font-mono">{p2pSyncInfo?.port || 9876}</strong>
              </span>
              <Chip
                size="small"
                label={`${p2pConnectedClients} companion${p2pConnectedClients === 1 ? '' : 's'} connected`}
                sx={{
                  bgcolor: p2pConnectedClients > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: p2pConnectedClients > 0 ? '#34d399' : '#a1a1aa',
                  border: '1px solid',
                  borderColor: p2pConnectedClients > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              />
            </div>
          </div>

          {/* Connection Mode Switcher */}
          <div className="w-full flex items-center justify-center p-1 rounded-xl bg-white/[0.04] border border-white/5 mb-4">
            <button
              onClick={() => setConnectionMode('wifi')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                connectionMode === 'wifi'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Wi-Fi LAN (Auto Discovery)
            </button>
            <button
              onClick={() => setConnectionMode('usb')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                connectionMode === 'usb'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              USB Cable (Bypass Isolated Wi-Fi)
            </button>
          </div>

          {/* USB Bypass Explainer / ADB Button */}
          {connectionMode === 'usb' && (
            <div className="w-full p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4 text-xs">
              <div className="font-semibold text-emerald-300 mb-1 flex items-center justify-between">
                <span>Apartment / Dorm Wi-Fi Bypass (0ms Latency)</span>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSetupAdb}
                  disabled={isSettingUpAdb}
                  sx={{
                    bgcolor: '#10b981',
                    color: '#ffffff',
                    fontSize: '10px',
                    py: 0.25,
                    px: 1.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '8px',
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  {isSettingUpAdb ? 'Forwarding...' : '1-Click Reverse Proxy'}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed mb-1">
                Routes <code className="text-emerald-400 font-mono">localhost:{effectivePort}</code> directly over your USB charging cable. Completely bypasses router AP client isolation and firewall drops.
              </p>
              {adbMessage && (
                <div className="mt-1.5 text-[11px] font-mono text-emerald-400 bg-black/40 p-1.5 rounded">
                  {adbMessage}
                </div>
              )}
            </div>
          )}

          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-white/10 mb-4 transition-transform hover:scale-[1.01]">
            <QRCodeSVG
              value={pairingUri}
              size={210}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#09090b"
            />
          </div>

          <p className="text-xs text-zinc-400 text-center max-w-sm mb-4">
            Scan with the built-in QR scanner in the <strong className="text-white">Prism Android app</strong> to instantly establish paired LAN control.
          </p>

          {/* Fallback Connection Code */}
          <div className="w-full p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-zinc-400 mb-0.5">Direct Pairing Code</div>
              <div className="text-xs font-mono text-emerald-400 truncate select-all">{rawString}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Tooltip title={copiedType === 'string' ? 'Copied code!' : 'Copy Code'} arrow>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(rawString, 'string')}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: copiedType === 'string' ? '#34d399' : '#a1a1aa',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  }}
                >
                  {copiedType === 'string' ? <Check size={14} /> : <Copy size={14} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={copiedType === 'uri' ? 'Copied URI!' : 'Copy prism:// URI'} arrow>
                <IconButton
                  size="small"
                  onClick={() => handleCopy(pairingUri, 'uri')}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: copiedType === 'uri' ? '#34d399' : '#a1a1aa',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  }}
                >
                  {copiedType === 'uri' ? <Check size={14} /> : <ExternalLink size={14} />}
                </IconButton>
              </Tooltip>
            </div>
          </div>

          {/* Paired Companion Devices */}
          {p2pPairedClients.length > 0 && (
            <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="text-[12px] font-semibold text-zinc-300 mb-2 flex items-center justify-between">
                <span>Paired Companion Devices</span>
                <span className="text-[10px] text-zinc-500 font-normal">{p2pPairedClients.length} paired</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {p2pPairedClients.map((client) => (
                  <div
                    key={client.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-medium text-white">{client.name}</div>
                        <div className="text-[10px] text-zinc-400">Version {client.version}</div>
                      </div>
                    </div>
                    <Tooltip title="Unpair Device" arrow>
                      <IconButton
                        size="small"
                        onClick={() => removeP2pPairedClient(client.name)}
                        sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' } }}
                      >
                        <X size={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Button
              variant="outlined"
              size="small"
              onClick={handleRotateToken}
              disabled={isRotating}
              startIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#e4e4e7',
                borderRadius: '12px',
                py: 1,
                fontSize: '11px',
                textTransform: 'none',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              Rotate Secret
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleSyncStats}
              disabled={isSyncingStats}
              startIcon={<Database className="w-3.5 h-3.5 text-cyan-400" />}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.12)',
                color: '#e4e4e7',
                borderRadius: '12px',
                py: 1,
                fontSize: '11px',
                textTransform: 'none',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              Sync Stats Now
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleToggleActiveDevice}
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
                borderRadius: '12px',
                py: 1,
                fontSize: '11px',
                textTransform: 'none',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              {p2pActiveDeviceId === 'desktop' ? 'Handoff to Phone' : 'Return to Desktop'}
            </Button>
          </div>

          {statsSyncMessage && (
            <div className="mt-3 text-xs text-center font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-lg w-full">
              {statsSyncMessage}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
