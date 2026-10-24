import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Star,
  Copy,
  Check,
  RefreshCw,
  Database,
  Monitor,
  X,
  ExternalLink,
  Radio,
  Volume2,
  ShieldCheck,
  Laptop,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  KeyRound,
  ClipboardPaste,
} from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  fetchP2pSyncInfo,
  regenerateP2pToken,
  sendP2pStatsSync,
  setP2pActiveDevice,
  setupAdbReverse,
  broadcastP2pFrame,
  broadcastRoutingSync,
} from '../utils/p2pSync';
import {
  remoteP2pClient,
  RemoteConnectionStatus,
} from '../utils/remoteP2pClient';

interface CompanionPairingModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'share' | 'connect';
}

export const CompanionPairingModal: React.FC<CompanionPairingModalProps> = ({
  open,
  onClose,
  initialTab = 'share',
}) => {
  const p2pSyncInfo = usePlayerStore((s) => s.p2pSyncInfo);
  const setP2pSyncInfo = usePlayerStore((s) => s.setP2pSyncInfo);
  const p2pConnectedClients = usePlayerStore((s) => s.p2pConnectedClients);
  const setP2pActiveDeviceId = usePlayerStore((s) => s.setP2pActiveDeviceId);
  const p2pPairedClients = usePlayerStore((s) => s.p2pPairedClients);
  const removeP2pPairedClient = usePlayerStore((s) => s.removeP2pPairedClient);
  const isDesktopAudioEnabled = usePlayerStore((s) => s.isDesktopAudioEnabled);
  const setIsDesktopAudioEnabled = usePlayerStore((s) => s.setIsDesktopAudioEnabled);
  const isCompanionAudioEnabled = usePlayerStore((s) => s.isCompanionAudioEnabled);
  const setIsCompanionAudioEnabled = usePlayerStore((s) => s.setIsCompanionAudioEnabled);
  const starredDeviceId = usePlayerStore((s) => s.starredDeviceId);
  const setStarredDeviceId = usePlayerStore((s) => s.setStarredDeviceId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const [activeTab, setActiveTab] = useState<'share' | 'connect'>(initialTab);
  const [connectionMode, setConnectionMode] = useState<'wifi' | 'usb'>('wifi');
  const [copiedType, setCopiedType] = useState<'uri' | 'string' | 'token' | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [statsSyncMessage, setStatsSyncMessage] = useState<string | null>(null);
  const [isSettingUpAdb, setIsSettingUpAdb] = useState(false);
  const [adbMessage, setAdbMessage] = useState<string | null>(null);

  // Client connection state (for connecting to another laptop)
  const [remoteInput, setRemoteInput] = useState('');
  const [remoteStatus, setRemoteStatus] = useState<RemoteConnectionStatus>(
    remoteP2pClient.getStatus()
  );

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      fetchP2pSyncInfo()
        .then((info) => setP2pSyncInfo(info))
        .catch((err) => console.debug('Failed to get sync info:', err));
    }
  }, [open, initialTab, setP2pSyncInfo]);

  useEffect(() => {
    const unsub = remoteP2pClient.subscribe((s) => setRemoteStatus(s));
    return unsub;
  }, []);

  const handleCopy = (text: string, type: 'uri' | 'string' | 'token') => {
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

  const handleToggleDesktop = (enabled: boolean) => {
    setIsDesktopAudioEnabled(enabled);
    broadcastRoutingSync(enabled, isCompanionAudioEnabled, starredDeviceId);
    if (!enabled && isPlaying) {
      togglePlay();
    } else if (enabled && !isPlaying) {
      togglePlay();
    }
  };

  const handleToggleCompanion = async (enabled: boolean) => {
    setIsCompanionAudioEnabled(enabled);
    broadcastRoutingSync(isDesktopAudioEnabled, enabled, starredDeviceId);
    const target = enabled ? (isDesktopAudioEnabled ? 'both' : 'local') : 'desktop';
    setP2pActiveDeviceId(target);
    try {
      await setP2pActiveDevice(target);
      await broadcastP2pFrame({
        type: 'command',
        action: enabled ? 'PLAY' : 'PAUSE',
      });
    } catch (e) {
      console.error('Failed to update companion audio status:', e);
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

  const handleConnectRemote = () => {
    if (!remoteInput.trim()) return;
    remoteP2pClient.connect(remoteInput.trim());
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRemoteInput(text.trim());
    } catch (e) {
      console.warn('Clipboard read failed:', e);
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

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#141419',
            color: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          },
        },
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Prism LAN Sync & Remote
              <span className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0 self-center">
                <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/80" />
                <span className="relative rounded-full w-2 h-2 bg-emerald-500 shrink-0" />
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Low-latency LAN sync between Android companion or multiple Windows laptops
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

      {/* Mode Selector Tabs */}
      <div className="px-6 pt-3 pb-1 border-b border-white/5 bg-white/[0.01] flex items-center gap-2">
        <button
          onClick={() => setActiveTab('share')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'share'
              ? 'bg-white/10 text-white shadow-sm border border-white/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <QrCodeIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Share This Player (Host / QR)</span>
        </button>

        <button
          onClick={() => setActiveTab('connect')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'connect'
              ? 'bg-white/10 text-white shadow-sm border border-white/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Laptop className="w-3.5 h-3.5 text-emerald-400" />
          <span>Connect to Remote Laptop (Client)</span>
          {remoteStatus.isConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      <DialogContent
        className="custom-scrollbar"
        sx={{
          p: { xs: 3, sm: 4 },
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-stop-1, #6366f1) rgba(255, 255, 255, 0.05)',
        }}
      >
        {activeTab === 'share' ? (
          <div className="flex flex-col items-center">
            {/* Status Badges */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-4 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>
                  Host: <strong className="text-white font-mono">{effectiveHost}:{effectivePort}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Chip
                  size="small"
                  label={`${p2pConnectedClients} companion${p2pConnectedClients === 1 ? '' : 's'} paired`}
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
                Wi-Fi LAN
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
                  Routes <code className="text-emerald-400 font-mono">localhost:{effectivePort}</code> directly over your USB charging cable. Completely bypasses router AP client isolation.
                </p>
                {adbMessage && (
                  <div className="mt-1.5 text-[11px] font-mono text-emerald-400 bg-black/40 p-1.5 rounded">
                    {adbMessage}
                  </div>
                )}
              </div>
            )}

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-white/10 mb-3 transition-transform hover:scale-[1.01]">
              <QRCodeSVG
                value={pairingUri}
                size={180}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#09090b"
              />
            </div>

            <p className="text-xs text-zinc-400 text-center max-w-sm mb-4">
              Scan with the built-in QR scanner on <strong className="text-white">Prism Android</strong> to pair instantly.
            </p>

            {/* Manual Direct Pairing Code Box (For devices without camera or connecting two laptops) */}
            <div className="w-full p-4 rounded-xl bg-black/50 border border-white/10 mb-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Manual Pairing Code (No Camera Needed)</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">Send to laptop or companion</span>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed">
                If connecting another laptop or a phone without a camera, copy this code and paste it on the other device:
              </p>

              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-xs">
                <span className="text-emerald-400 truncate select-all">{rawString}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip title={copiedType === 'string' ? 'Copied code!' : 'Copy Code (host:port:token)'} arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(rawString, 'string')}
                      sx={{
                        color: copiedType === 'string' ? '#34d399' : '#a1a1aa',
                        '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
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
                        color: copiedType === 'uri' ? '#34d399' : '#a1a1aa',
                        '&:hover': { color: '#ffffff', bgcolor: 'rgba(255,255,255,0.1)' },
                      }}
                    >
                      {copiedType === 'uri' ? <Check size={14} /> : <ExternalLink size={14} />}
                    </IconButton>
                  </Tooltip>
                </div>
              </div>

              {/* Security Guarantee Box */}
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong className="text-indigo-200">Hardened Security Guard:</strong> The 32-character secret token is never broadcast over mDNS. Only devices holding this code can connect, and actions are strictly sandboxed to playback control.
                </div>
              </div>
            </div>

            {/* Simultaneous Audio Output Routing Checkboxes */}
            <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3.5 mb-4">
              <div className="text-xs font-semibold text-zinc-300 mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  Simultaneous Audio Output Routing
                </span>
                <span className="text-[10px] text-zinc-400">Multi-device sync</span>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-black/25 border border-white/5 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-medium text-white">This Computer (Speakers / DAC)</div>
                      <div className="text-[10px] text-zinc-400">Direct bit-perfect WASAPI output</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStarredDeviceId('desktop');
                        broadcastRoutingSync(isDesktopAudioEnabled, isCompanionAudioEnabled, 'desktop');
                      }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title={starredDeviceId === 'desktop' ? 'Starred queue authority' : 'Set as queue authority'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          starredDeviceId === 'desktop' ? 'text-amber-400 fill-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      />
                    </button>
                    <input
                      type="checkbox"
                      checked={isDesktopAudioEnabled}
                      onChange={(e) => handleToggleDesktop(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-500 accent-indigo-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-black/25 border border-white/5 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-medium text-white">Companion Phone (Mobile Output)</div>
                      <div className="text-[10px] text-zinc-400">
                        {p2pConnectedClients > 0
                          ? `${p2pConnectedClients} device(s) synchronized`
                          : 'Plays synchronized audio on paired Android device'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStarredDeviceId('companion');
                        broadcastRoutingSync(isDesktopAudioEnabled, isCompanionAudioEnabled, 'companion');
                      }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title={starredDeviceId === 'companion' ? 'Starred queue authority' : 'Set as queue authority'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          starredDeviceId === 'companion' ? 'text-amber-400 fill-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      />
                    </button>
                    <input
                      type="checkbox"
                      checked={isCompanionAudioEnabled}
                      onChange={(e) => handleToggleCompanion(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Paired Companion Devices Container */}
            {p2pPairedClients.length > 0 && (
              <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3.5 mb-4 shadow-sm">
                <div className="text-[12px] font-semibold text-zinc-300 mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                    Paired Companion Devices
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">{p2pPairedClients.length} paired</span>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1.5">
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
            <div className="w-full grid grid-cols-2 gap-3">
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
                Rotate Secret Key
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
            </div>

            {statsSyncMessage && (
              <div className="mt-3 text-xs text-center font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-lg w-full">
                {statsSyncMessage}
              </div>
            )}
          </div>
        ) : (
          /* Connect to Remote Laptop (Client Mode) */
          <div className="flex flex-col space-y-4">
            {!remoteStatus.isConnected ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    <span>Connect to Another Prism Instance</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Paste the pairing string (<code className="text-emerald-400 font-mono">host:port:token</code>) or <code className="text-indigo-400 font-mono">prism://pair?...</code> copied from your other laptop to control its playback over LAN.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="e.g. 192.168.1.50:9876:abcdef123..."
                        value={remoteInput}
                        onChange={(e) => setRemoteInput(e.target.value)}
                        className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        onClick={handlePasteClipboard}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                      </button>
                    </div>

                    <Button
                      variant="contained"
                      onClick={handleConnectRemote}
                      disabled={remoteStatus.isConnecting || !remoteInput.trim()}
                      sx={{
                        bgcolor: 'var(--color-stop-1, #6366f1)',
                        color: '#ffffff',
                        borderRadius: '12px',
                        px: 3,
                        py: 1.25,
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 80%, black)',
                        },
                      }}
                    >
                      {remoteStatus.isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  </div>

                  {remoteStatus.error && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                      {remoteStatus.error}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400 space-y-1">
                  <div className="font-semibold text-zinc-300">How to get the code:</div>
                  <ol className="list-decimal list-inside space-y-0.5 text-zinc-400">
                    <li>Open Prism on the host laptop.</li>
                    <li>Click the Companion / Sync icon or open Companion Settings.</li>
                    <li>Under "Manual Pairing Code", click the Copy button.</li>
                    <li>Paste that code here and click Connect.</li>
                  </ol>
                </div>
              </div>
            ) : (
              /* Connected Remote Player State & Controller */
              <div className="space-y-4">
                {/* Connection Status Card */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <div className="text-xs font-bold text-emerald-300">
                        Connected to {remoteStatus.serverDeviceName || 'Remote Prism'}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {remoteStatus.connectedHost}:{remoteStatus.connectedPort}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => remoteP2pClient.disconnect()}
                    sx={{
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      borderRadius: '8px',
                      fontSize: '10px',
                      textTransform: 'none',
                      py: 0.25,
                      px: 1.5,
                      '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' },
                    }}
                  >
                    Disconnect
                  </Button>
                </div>

                {/* Remote Now Playing Card */}
                {remoteStatus.remotePlaybackState?.currentTrack ? (
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center text-zinc-500">
                        {remoteStatus.remotePlaybackState.currentTrack.artworkUri ? (
                          <img
                            src={remoteStatus.remotePlaybackState.currentTrack.artworkUri}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Volume2 className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {remoteStatus.remotePlaybackState.currentTrack.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {remoteStatus.remotePlaybackState.currentTrack.artist}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {remoteStatus.remotePlaybackState.currentTrack.album}
                        </div>
                      </div>
                      <Chip
                        size="small"
                        label={remoteStatus.remotePlaybackState.currentTrack.format || 'AUDIO'}
                        sx={{
                          height: 20,
                          fontSize: '9px',
                          fontWeight: 700,
                          bgcolor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <Slider
                        size="small"
                        min={0}
                        max={remoteStatus.remotePlaybackState.durationMs || 100}
                        value={remoteStatus.remotePlaybackState.positionMs || 0}
                        onChange={(_, val) => {
                          remoteP2pClient.sendCommand('SEEK', {
                            seekPositionMs: val as number,
                          });
                        }}
                        sx={{
                          color: 'var(--color-stop-1, #6366f1)',
                          p: 0.5,
                          '& .MuiSlider-thumb': { width: 10, height: 10 },
                        }}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>{formatTime(remoteStatus.remotePlaybackState.positionMs || 0)}</span>
                        <span>{formatTime(remoteStatus.remotePlaybackState.durationMs || 0)}</span>
                      </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <IconButton
                        size="small"
                        onClick={() => remoteP2pClient.sendCommand('TOGGLE_SHUFFLE')}
                        sx={{
                          color: remoteStatus.remotePlaybackState.isShuffled ? '#818cf8' : '#a1a1aa',
                        }}
                      >
                        <Shuffle size={16} />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => remoteP2pClient.sendCommand('SKIP_PREVIOUS')}
                        sx={{ color: '#ffffff' }}
                      >
                        <SkipBack size={18} />
                      </IconButton>

                      <IconButton
                        onClick={() => remoteP2pClient.sendCommand('TOGGLE_PLAY_PAUSE')}
                        sx={{
                          bgcolor: 'var(--color-stop-1, #6366f1)',
                          color: '#ffffff',
                          p: 1.25,
                          '&:hover': {
                            bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 80%, black)',
                          },
                        }}
                      >
                        {remoteStatus.remotePlaybackState.isPlaying ? (
                          <Pause size={18} />
                        ) : (
                          <Play size={18} className="translate-x-0.5" />
                        )}
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => remoteP2pClient.sendCommand('SKIP_NEXT')}
                        sx={{ color: '#ffffff' }}
                      >
                        <SkipForward size={18} />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => {
                          const current = remoteStatus.remotePlaybackState?.repeatMode;
                          const next = current === 'OFF' ? 'ALL' : current === 'ALL' ? 'ONE' : 'OFF';
                          remoteP2pClient.sendCommand('SET_REPEAT', { repeatMode: next });
                        }}
                        sx={{
                          color:
                            remoteStatus.remotePlaybackState.repeatMode !== 'OFF'
                              ? '#818cf8'
                              : '#a1a1aa',
                        }}
                      >
                        {remoteStatus.remotePlaybackState.repeatMode === 'ONE' ? (
                          <Repeat1 size={16} />
                        ) : (
                          <Repeat size={16} />
                        )}
                      </IconButton>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                      <Volume2 size={16} className="text-zinc-400" />
                      <Slider
                        size="small"
                        min={0}
                        max={1}
                        step={0.01}
                        value={remoteStatus.remotePlaybackState.volume ?? 0.8}
                        onChange={(_, val) => {
                          remoteP2pClient.sendCommand('SET_VOLUME', {
                            volume: val as number,
                          });
                        }}
                        sx={{
                          color: '#ffffff',
                          '& .MuiSlider-thumb': { width: 10, height: 10 },
                        }}
                      />
                      <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
                        {Math.round((remoteStatus.remotePlaybackState.volume ?? 0.8) * 100)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-black/30 border border-white/10 text-center text-xs text-zinc-400">
                    Host is connected, waiting for playback state...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function QrCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
