import React from 'react';
import {
  Folder,
  FolderPlus,
  FolderMinus,
  FolderGit2,
  Trash2,
  CheckCircle2,
  Activity,
  RotateCcw,
  Volume2,
  ChevronDown,
  Search,
} from 'lucide-react';
import Checkbox from '@mui/material/Checkbox';
import LinearProgress from '@mui/material/LinearProgress';
import { usePlayerStore } from '../../store/usePlayerStore';
import { open } from '@tauri-apps/plugin-dialog';

interface LibrarySettingsSectionProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  shouldShow: boolean;
}

export const LibrarySettingsSection: React.FC<LibrarySettingsSectionProps> = ({
  isCollapsed,
  onToggleCollapse,
  shouldShow,
}) => {
  const tracks = usePlayerStore((s) => s.tracks);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const excludedDirectories = usePlayerStore((s) => s.excludedDirectories);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const removeIncludedDirectory = usePlayerStore((s) => s.removeIncludedDirectory);
  const addExcludedDirectory = usePlayerStore((s) => s.addExcludedDirectory);
  const removeExcludedDirectory = usePlayerStore((s) => s.removeExcludedDirectory);
  const rescanConfiguredLibraries = usePlayerStore((s) => s.rescanConfiguredLibraries);
  const purgeMissingTracks = usePlayerStore((s) => s.purgeMissingTracks);
  const isRefreshingLibrary = usePlayerStore((s) => s.isRefreshingLibrary);
  const lastRefreshResult = usePlayerStore((s) => s.lastRefreshResult);
  const analyzeAndIndexAudio = usePlayerStore((s) => s.analyzeAndIndexAudio);
  const audioAnalysisProgress = usePlayerStore((s) => s.audioAnalysisProgress);

  const isScanningReplayGain = usePlayerStore((s) => s.isScanningReplayGain);
  const replayGainScanProgress = usePlayerStore((s) => s.replayGainScanProgress);
  const startReplayGainScan = usePlayerStore((s) => s.startReplayGainScan);
  const cancelReplayGainScan = usePlayerStore((s) => s.cancelReplayGainScan);

  const [scanUntaggedOnly, setScanUntaggedOnly] = React.useState(true);
  const [includeZeroDb, setIncludeZeroDb] = React.useState(true);
  const [writeRgTagsToFiles, setWriteRgTagsToFiles] = React.useState(false);
  const [isScanningLocal, setIsScanningLocal] = React.useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = React.useState(false);
  const [customPathInput, setCustomPathInput] = React.useState('');

  const totalTracks = tracks.length;
  const genreCount = React.useMemo(() => tracks.filter((t) => t.genre && t.genre.trim()).length, [tracks]);
  const yearCount = React.useMemo(() => tracks.filter((t) => t.year && t.year > 0).length, [tracks]);
  const keyCount = React.useMemo(() => tracks.filter((t) => t.key && t.key.trim()).length, [tracks]);
  const bpmCount = React.useMemo(() => tracks.filter((t) => t.bpm && t.bpm > 0).length, [tracks]);
  const keyOrBpmCount = React.useMemo(() => tracks.filter((t) => (t.key && t.key.trim()) || (t.bpm && t.bpm > 0)).length, [tracks]);
  const zeroDbGainCount = React.useMemo(
    () => tracks.filter((t) => t.replay_gain_db != null && Math.abs(t.replay_gain_db) < 0.001).length,
    [tracks]
  );
  const completelyUntaggedCount = React.useMemo(
    () => tracks.filter((t) => t.replay_gain_db == null).length,
    [tracks]
  );
  const validReplayGainCount = React.useMemo(
    () => tracks.filter((t) => t.replay_gain_db != null && Math.abs(t.replay_gain_db) >= 0.001).length,
    [tracks]
  );
  const untaggedOrZeroCount = completelyUntaggedCount + zeroDbGainCount;

  const isScanning = isScanningLocal;
  const isRefreshing = isRefreshingLibrary;
  const isAnalyzing = isAnalyzingAudio || audioAnalysisProgress !== null;

  const pickDirectory = async (): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (!selected) return null;
    return typeof selected === 'string' ? selected : selected[0];
  };

  const handleAddIncludedDir = async () => {
    try {
      const selected = await pickDirectory();
      if (selected) {
        setIsScanningLocal(true);
        await addIncludedDirectory(selected);
        setIsScanningLocal(false);
      }
    } catch (e) {
      console.warn('Picker error:', e);
      setIsScanningLocal(false);
    }
  };

  const handleAddExcludedDir = async () => {
    try {
      const selected = await pickDirectory();
      if (selected) {
        setIsScanningLocal(true);
        await addExcludedDirectory(selected);
        setIsScanningLocal(false);
      }
    } catch (e) {
      console.warn('Picker error:', e);
      setIsScanningLocal(false);
    }
  };

  const handleManualAddPath = async () => {
    const path = customPathInput.trim();
    if (!path) return;
    try {
      setIsScanningLocal(true);
      await addIncludedDirectory(path);
      setCustomPathInput('');
      setIsScanningLocal(false);
    } catch (e) {
      console.warn('Manual path add error:', e);
      setIsScanningLocal(false);
    }
  };

  const handleRescan = async () => {
    setIsScanningLocal(true);
    await rescanConfiguredLibraries();
    setIsScanningLocal(false);
  };

  const handlePurgeMissing = async () => {
    if (window.confirm('Remove all missing songs from library index now?')) {
      await purgeMissingTracks();
    }
  };

  const handleAnalyzeAudio = async () => {
    setIsAnalyzingAudio(true);
    await analyzeAndIndexAudio();
    setIsAnalyzingAudio(false);
  };

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
            <Folder className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-white">Library & Folder Management</h3>
            <p className="text-xs text-zinc-400 truncate">
              Watched directories, tag indexing, audio waveform analysis, and exclusions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
            {includedDirectories.length} {includedDirectories.length === 1 ? 'Folder' : 'Folders'} • {totalTracks} Songs
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
        <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-5 mt-1">
          {/* Last Scan Summary Inline Card */}
          {lastRefreshResult && (
            <div
              className="p-4 rounded-2xl border flex flex-col gap-3 shadow-lg animate-in fade-in duration-200 mt-4"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 8%, #121216)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, rgba(255, 255, 255, 0.1))',
              }}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Library Scan Summary</span>
                </div>
                <button
                  onClick={() => usePlayerStore.setState({ lastRefreshResult: null })}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss summary"
                >
                  ✕ Dismiss
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">New Added</span>
                  <span className={`text-base font-mono font-bold ${lastRefreshResult.added_count > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    +{lastRefreshResult.added_count}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Updated Tags</span>
                  <span className={`text-base font-mono font-bold ${(lastRefreshResult.updated_count ?? 0) > 0 ? 'text-blue-400' : 'text-zinc-400'}`}>
                    ~{lastRefreshResult.updated_count ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Missing Files</span>
                  <span className={`text-base font-mono font-bold ${lastRefreshResult.missing_count > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {lastRefreshResult.missing_count}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Purged Files</span>
                  <span className={`text-base font-mono font-bold ${lastRefreshResult.removed_count > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                    -{lastRefreshResult.removed_count}
                  </span>
                </div>
              </div>

              {lastRefreshResult.added_track_names && lastRefreshResult.added_track_names.length > 0 && (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar bg-black/40 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Newly Added Songs:</span>
                  {lastRefreshResult.added_track_names.map((name, i) => (
                    <span key={i} className="text-[11px] text-zinc-200 truncate font-medium">
                      • {name}
                    </span>
                  ))}
                </div>
              )}

              {lastRefreshResult.updated_track_names && lastRefreshResult.updated_track_names.length > 0 && (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar bg-black/40 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Metadata Updated:</span>
                  {lastRefreshResult.updated_track_names.map((name, i) => (
                    <span key={i} className="text-[11px] text-zinc-200 truncate font-medium">
                      • {name}
                    </span>
                  ))}
                </div>
              )}

              {lastRefreshResult.removed_track_names && lastRefreshResult.removed_track_names.length > 0 && (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar bg-black/40 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Purged Songs:</span>
                  {lastRefreshResult.removed_track_names.map((name, i) => (
                    <span key={i} className="text-[11px] text-zinc-300 truncate font-medium">
                      • {name}
                    </span>
                  ))}
                </div>
              )}

              {lastRefreshResult.added_count === 0 &&
                (lastRefreshResult.updated_count ?? 0) === 0 &&
                lastRefreshResult.missing_count === 0 &&
                lastRefreshResult.removed_count === 0 && (
                  <p className="text-xs text-zinc-400 italic">
                    Library is up to date. No new or missing tracks detected.
                  </p>
              )}

              {lastRefreshResult.missing_count > 0 && (
                <button
                  onClick={handlePurgeMissing}
                  className="self-start px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/50 transition-colors cursor-pointer"
                >
                  Purge Missing Songs Now
                </button>
              )}
            </div>
          )}

          {/* Tag Indexing Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Tracks</span>
              <span className="text-xl font-bold font-mono text-white">{totalTracks}</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Genre Tags</span>
              <span className="text-xl font-bold font-mono text-white">
                {totalTracks > 0 ? `${Math.round((genreCount / totalTracks) * 100)}%` : '0%'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">{genreCount} / {totalTracks}</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Year / Date</span>
              <span className="text-xl font-bold font-mono text-white">
                {totalTracks > 0 ? `${Math.round((yearCount / totalTracks) * 100)}%` : '0%'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">{yearCount} / {totalTracks}</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Key & BPM</span>
              <span className="text-xl font-bold font-mono text-white">
                {totalTracks > 0 ? `${Math.round((keyOrBpmCount / totalTracks) * 100)}%` : '0%'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">Key: {keyCount} • BPM: {bpmCount}</span>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">ReplayGain</span>
              <span className="text-xl font-bold font-mono text-white">
                {totalTracks > 0 ? `${Math.round((validReplayGainCount / totalTracks) * 100)}%` : '0%'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">
                {validReplayGainCount} / {totalTracks}
                {zeroDbGainCount > 0 ? ` • ${zeroDbGainCount} at 0.00 dB` : ''}
              </span>
            </div>
          </div>

          {/* Library Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={handleAddIncludedDir}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-xs font-semibold transition-all hover:scale-105 shadow-md cursor-pointer"
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Music Folder</span>
            </button>

            <button
              onClick={handleAnalyzeAudio}
              disabled={isAnalyzing || totalTracks === 0}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-md ${
                isAnalyzing || totalTracks === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                  : 'text-white hover:scale-105 active:scale-95 cursor-pointer'
              }`}
              style={
                !isAnalyzing && totalTracks > 0
                  ? { backgroundColor: 'color-mix(in srgb, var(--color-stop-2, #8b5cf6) 80%, black)' }
                  : undefined
              }
              title="Analyze audio waveforms asynchronously to calculate missing Key and BPM"
            >
              <Activity className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>
                {audioAnalysisProgress
                  ? `Analyzing: ${audioAnalysisProgress.current} / ${audioAnalysisProgress.total} (${Math.round(
                      (audioAnalysisProgress.current / audioAnalysisProgress.total) * 100
                    )}%)`
                  : isAnalyzing
                  ? 'Analyzing Key/BPM...'
                  : 'Detect Key & BPM'}
              </span>
            </button>

            <button
              onClick={handleRescan}
              disabled={isScanning || isRefreshing || includedDirectories.length === 0}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-md ${
                isScanning || isRefreshing || includedDirectories.length === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                  : 'text-white hover:scale-105 active:scale-95 cursor-pointer'
              }`}
              style={
                !isScanning && !isRefreshing && includedDirectories.length > 0
                  ? { backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 60%, black)' }
                  : undefined
              }
              title="Force re-reading of all ID3/Vorbis tags from disk for all tracks"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Re-indexing...' : 'Re-index All Tags'}</span>
            </button>
          </div>

          {/* ReplayGain Loudness Scanner Card */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white">ReplayGain Loudness Scanner (EBU R128)</span>
                  <span className="text-[11px] text-zinc-400">
                    Measures integrated loudness against standard (-18.0 LUFS) for smooth consistent playback volume
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                {!isScanningReplayGain && (
                  <button
                    onClick={() => {
                      setSearchQuery('replaygain:0');
                      setActiveTab('library');
                    }}
                    disabled={untaggedOrZeroCount === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                      color: 'var(--color-stop-1, #6366f1)',
                    }}
                    title="Search and display all tracks without tags or at 0.00 dB in the library"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Untagged / 0.00 dB ({untaggedOrZeroCount})</span>
                  </button>
                )}

                {isScanningReplayGain ? (
                  <button
                    onClick={cancelReplayGainScan}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Scan
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      startReplayGainScan({
                        untaggedOnly: scanUntaggedOnly,
                        includeZeroDb,
                        writeToFiles: writeRgTagsToFiles,
                      })
                    }
                    disabled={totalTracks === 0}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--color-stop-1, #6366f1)',
                      color: 'var(--color-stop-1-text, #ffffff)',
                    }}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      {scanUntaggedOnly
                        ? includeZeroDb
                          ? `Scan Untagged & 0.00 dB (${untaggedOrZeroCount})`
                          : `Scan Untagged (${completelyUntaggedCount})`
                        : `Recalculate All (${totalTracks})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Options checkboxes */}
            {!isScanningReplayGain && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-zinc-300 border-t border-white/5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={scanUntaggedOnly}
                    onChange={(e) => setScanUntaggedOnly(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'var(--color-stop-1, #6366f1)',
                      '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                      p: 0.25,
                    }}
                  />
                  <span>Scan untagged tracks only (Skip already analyzed)</span>
                </label>

                {scanUntaggedOnly && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox
                      checked={includeZeroDb}
                      onChange={(e) => setIncludeZeroDb(e.target.checked)}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.25,
                      }}
                    />
                    <span className="flex items-center gap-1.5">
                      Include 0.00 dB tracks (Treat 0.00 dB as missing / dummy tags)
                      {zeroDbGainCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {zeroDbGainCount} found
                        </span>
                      )}
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={writeRgTagsToFiles}
                    onChange={(e) => setWriteRgTagsToFiles(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'var(--color-stop-1, #6366f1)',
                      '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                      p: 0.25,
                    }}
                  />
                  <span>Also embed ReplayGain tags into audio files on disk</span>
                </label>
              </div>
            )}

            {/* Live Progress Bar when Scanning */}
            {isScanningReplayGain && replayGainScanProgress && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium truncate max-w-[70%]">
                    Analyzing: <span className="text-white font-mono">{replayGainScanProgress.path.split(/[\\/]/).pop()}</span>
                  </span>
                  <span className="font-mono text-zinc-400 shrink-0">
                    {replayGainScanProgress.current} / {replayGainScanProgress.total} (
                    {Math.round((replayGainScanProgress.current / Math.max(1, replayGainScanProgress.total)) * 100)}%)
                  </span>
                </div>
                <LinearProgress
                  variant="determinate"
                  value={Math.round((replayGainScanProgress.current / Math.max(1, replayGainScanProgress.total)) * 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: 'var(--color-stop-1, #6366f1)',
                    },
                  }}
                />
              </div>
            )}
          </div>

          {/* Manual Directory Path Input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Paste directory path manually (e.g. D:\Music or /home/music)..."
              value={customPathInput}
              onChange={(e) => setCustomPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualAddPath();
              }}
              className="flex-1 bg-zinc-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={() => handleManualAddPath()}
              disabled={!customPathInput.trim() || isScanning || isRefreshing}
              className="px-4 py-2 rounded-xl disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
              style={
                customPathInput.trim() && !isScanning && !isRefreshing
                  ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                  : undefined
              }
            >
              Add Path
            </button>
          </div>

          {/* Included Folders List */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Included Watched Folders ({includedDirectories.length})
            </span>
            {includedDirectories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-1.5 border border-dashed border-white/10 rounded-xl bg-white/5">
                <Folder className="w-6 h-6 text-zinc-600" />
                <span className="text-xs font-semibold text-zinc-300">No watched directories configured</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {includedDirectories.map((dir) => (
                  <div
                    key={`inc-${dir}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <span className="text-xs font-mono text-white truncate">{dir}</span>
                    </div>
                    <button
                      onClick={() => removeIncludedDirectory(dir)}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                      title="Remove folder from library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Excluded Subfolders */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Excluded Subfolders ({excludedDirectories.length})
              </span>
              <button
                onClick={handleAddExcludedDir}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer"
              >
                <FolderMinus className="w-3.5 h-3.5" />
                <span>Exclude Folder</span>
              </button>
            </div>

            {excludedDirectories.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {excludedDirectories.map((dir) => (
                  <div
                    key={`exc-${dir}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <FolderGit2 className="w-4 h-4 shrink-0" style={{ color: 'var(--color-stop-2, #8b5cf6)' }} />
                      <span className="text-xs font-mono text-zinc-300 truncate">{dir}</span>
                    </div>
                    <button
                      onClick={() => removeExcludedDirectory(dir)}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                      title="Remove exclusion rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
