import React, { useState } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../store/usePlayerStore';
import { showOpenDirPicker } from 'tauri-plugin-android-fs-api';
import {
  FolderPlus,
  FolderMinus,
  Folder,
  FolderGit2,
  Trash2,
  RefreshCw,
  Settings2,
  Sliders,
  Sparkles,
  Mic2,
  Languages,
  Info,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const excludedDirectories = usePlayerStore((s) => s.excludedDirectories);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const removeIncludedDirectory = usePlayerStore((s) => s.removeIncludedDirectory);
  const addExcludedDirectory = usePlayerStore((s) => s.addExcludedDirectory);
  const removeExcludedDirectory = usePlayerStore((s) => s.removeExcludedDirectory);
  const rescanConfiguredLibraries = usePlayerStore((s) => s.rescanConfiguredLibraries);
  const analyzeAndIndexAudio = usePlayerStore((s) => s.analyzeAndIndexAudio);
  const wipeDataAndReset = usePlayerStore((s) => s.wipeDataAndReset);

  const lrclibAutoFetch = usePlayerStore((s) => s.lrclibAutoFetch);
  const setLrclibAutoFetch = usePlayerStore((s) => s.setLrclibAutoFetch);
  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const toggleRomanization = usePlayerStore((s) => s.toggleRomanization);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const setRomanizationMode = usePlayerStore((s) => s.setRomanizationMode);
  const showAudioSpecs = usePlayerStore((s) => s.showAudioSpecs);
  const toggleShowAudioSpecs = usePlayerStore((s) => s.toggleShowAudioSpecs);
  const showAudioSpecsInLibrary = usePlayerStore((s) => s.showAudioSpecsInLibrary);
  const toggleShowAudioSpecsInLibrary = usePlayerStore((s) => s.toggleShowAudioSpecsInLibrary);
  const autoHideLyricsControls = usePlayerStore((s) => s.autoHideLyricsControls);
  const toggleAutoHideLyricsControls = usePlayerStore((s) => s.toggleAutoHideLyricsControls);
  const preferOnlineLyrics = usePlayerStore((s) => s.preferOnlineLyrics);
  const setPreferOnlineLyrics = usePlayerStore((s) => s.setPreferOnlineLyrics);
  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  const toggleStatsCollection = usePlayerStore((s) => s.toggleStatsCollection);
  const lyricsFontSizePreset = usePlayerStore((s) => s.lyricsFontSizePreset);
  const setLyricsFontSizePreset = usePlayerStore((s) => s.setLyricsFontSizePreset);

  const isScanningStore = usePlayerStore((s) => s.isScanning);
  const scanStatusMessage = usePlayerStore((s) => s.scanStatusMessage);
  const setScanStatusMessage = usePlayerStore((s) => s.setScanStatusMessage);

  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const isScanning = isScanningStore || isScanningLocal;

  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');

  // Compute Tag Indexing Stats
  const totalTracks = tracks.length;
  const genreCount = tracks.filter((t) => Boolean(t.genre)).length;
  const yearCount = tracks.filter((t) => Boolean(t.year || t.date)).length;
  const keyCount = tracks.filter((t) => Boolean(t.key)).length;
  const bpmCount = tracks.filter((t) => Boolean(t.bpm)).length;
  const keyOrBpmCount = tracks.filter((t) => Boolean(t.key || t.bpm)).length;

  const handleManualAddPath = async (pathToAdd?: string) => {
    const target = (pathToAdd || customPathInput).trim();
    if (!target) return;
    try {
      setIsScanningLocal(true);
      await addIncludedDirectory(target);
      setCustomPathInput('');
      setIsScanningLocal(false);
    } catch (e) {
      console.warn('Add path error:', e);
      setIsScanningLocal(false);
    }
  };

  const handleRescan = async () => {
    setIsScanningLocal(true);
    await rescanConfiguredLibraries();
    setIsScanningLocal(false);
  };

  const handleAnalyzeAudio = async () => {
    setIsAnalyzingAudio(true);
    await analyzeAndIndexAudio();
    setIsAnalyzingAudio(false);
  };

  const pickDirectory = async (): Promise<string | null> => {
    const res = await showOpenDirPicker();
    if (!res) return null;
    return typeof res === 'string' ? res : res.uri;
  };

  const handleAddIncludedDir = async () => {
    try {
      const selected = await pickDirectory();
      console.log('Picked directory URI:', selected);
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
      console.log('Picked directory URI:', selected);
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

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 pb-36 overflow-y-auto custom-scrollbar pr-2 h-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-5 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-950/30 shrink-0">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Settings & Library Folders</h2>
            <p className="text-xs text-zinc-400 mt-0.5 max-w-sm">
              Manage watched music directories, background tag indexing, audio waveform analysis, and lyrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyzeAudio}
            disabled={isAnalyzingAudio || totalTracks === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-md ${
              isAnalyzingAudio || totalTracks === 0
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
            title="Analyze audio waveforms asynchronously to calculate missing Key and BPM"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzingAudio ? 'animate-spin' : ''}`} />
            <span>{isAnalyzingAudio ? 'Analyzing Audio Waveforms...' : 'Detect Key & BPM'}</span>
          </button>

          <button
            onClick={handleRescan}
            disabled={isScanning || includedDirectories.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-md ${
              isScanning || includedDirectories.length === 0
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Indexing...' : 'Re-index Tags'}</span>
          </button>
        </div>
      </div>


      {/* Library Tag Indexing Stats Card */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4 bg-gradient-to-br from-indigo-950/20 to-purple-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-5 h-5 text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
            <div>
              <h3 className="text-base font-bold text-white">Library Indexing & Tag Coverage</h3>
              <p className="text-xs text-zinc-400">
                {isScanning
                  ? 'Currently reading local files and updating metadata index...'
                  : `All ${totalTracks} tracks stored in local AppData index (library.json) for instant search.`}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isScanning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isScanning ? 'Indexing in progress' : 'Library Fully Indexed'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Indexed Tracks</span>
            <span className="text-2xl font-black font-mono text-white">{totalTracks}</span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Genre Tag Coverage</span>
            <span className="text-2xl font-black font-mono text-indigo-300">
              {totalTracks > 0 ? `${Math.round((genreCount / totalTracks) * 100)}%` : '0%'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{genreCount} / {totalTracks} tracks</span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Year / Date Tags</span>
            <span className="text-2xl font-black font-mono text-purple-300">
              {totalTracks > 0 ? `${Math.round((yearCount / totalTracks) * 100)}%` : '0%'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{yearCount} / {totalTracks} tracks</span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Key & BPM Coverage</span>
            <span className="text-2xl font-black font-mono text-pink-300">
              {totalTracks > 0 ? `${Math.round((keyOrBpmCount / totalTracks) * 100)}%` : '0%'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Key: {keyCount} • BPM: {bpmCount}</span>
          </div>

        </div>
      </div>



      {/* Live Folder Scan Status Banner */}
      {scanStatusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xl transition-all ${
            isScanning
              ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200 animate-pulse'
              : scanStatusMessage.includes('Success') || totalTracks > 0
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <RefreshCw className={`w-5 h-5 shrink-0 ${isScanning ? 'animate-spin text-indigo-400' : 'text-emerald-400'}`} />
            <div>
              <p className="text-xs font-bold text-white">{scanStatusMessage}</p>
              {!isScanning && totalTracks === 0 && (
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Tip: Tap a Quick-Add preset below or type your folder path manually. Supported formats: FLAC, MP3, M4A, WAV, OGG, AAC.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setScanStatusMessage(null)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Included Music Folders */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-white">Included Music Directories</h3>
              <p className="text-xs text-zinc-400">
                Add local or Android storage directories to automatically scan and play your music files.
              </p>
            </div>
          </div>
          <button
            onClick={handleAddIncludedDir}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all hover:scale-105 shadow-md"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Open Folder Picker</span>
          </button>
        </div>

        {/* Android & Mobile Quick Presets */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span className="text-[11px] font-semibold text-zinc-400">Quick-Add Common Android Music Folders:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleManualAddPath('/storage/emulated/0/Music')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-indigo-300 hover:text-white transition-all active:scale-95"
            >
              📁 /storage/emulated/0/Music
            </button>
            <button
              onClick={() => handleManualAddPath('/storage/emulated/0/Download')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-indigo-300 hover:text-white transition-all active:scale-95"
            >
              📁 /storage/emulated/0/Download
            </button>
            <button
              onClick={() => handleManualAddPath('/sdcard/Music')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-indigo-300 hover:text-white transition-all active:scale-95"
            >
              📁 /sdcard/Music
            </button>
          </div>
        </div>

        {/* Manual Folder Path Input */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={customPathInput}
            onChange={(e) => setCustomPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualAddPath();
            }}
            placeholder="Type or paste custom folder path (e.g. /storage/emulated/0/Music)"
            className="flex-1 bg-zinc-900 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          <button
            onClick={() => handleManualAddPath()}
            disabled={!customPathInput.trim() || isScanning}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold transition-all shrink-0"
          >
            Add Path
          </button>
        </div>

        {includedDirectories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 border border-dashed border-white/10 rounded-xl bg-white/5">
            <Folder className="w-8 h-8 text-zinc-600" />
            <span className="text-xs font-semibold text-zinc-300">No included directories configured</span>
            <p className="text-[11px] text-zinc-500 max-w-xs">
              Click "Add Folder" above to choose directories containing your FLAC audio library.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {includedDirectories.map((dir) => (
              <div
                key={`inc-${dir}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-mono text-white truncate">{dir}</span>
                </div>
                <button
                  onClick={() => removeIncludedDirectory(dir)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  title="Remove folder from library"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Excluded Subfolders */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderMinus className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">Excluded Subfolders</h3>
              <p className="text-xs text-zinc-400">
                Any subfolders added here will be skipped during audio scanning.
              </p>
            </div>
          </div>
          <button
            onClick={handleAddExcludedDir}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all border border-white/10 hover:scale-105"
          >
            <FolderMinus className="w-4 h-4 text-amber-400" />
            <span>Exclude Folder</span>
          </button>
        </div>

        {excludedDirectories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-1 border border-dashed border-white/5 rounded-xl bg-white/5">
            <span className="text-xs font-medium text-zinc-500">No excluded subfolders configured</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {excludedDirectories.map((dir) => (
              <div
                key={`exc-${dir}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <FolderGit2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-mono text-zinc-300 truncate">{dir}</span>
                </div>
                <button
                  onClick={() => removeExcludedDirectory(dir)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  title="Remove exclusion rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Audio Specs & Lyrics Preferences */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white">Playback & Lyrics Preferences</h3>
            <p className="text-xs text-zinc-400">Configure online lyrics auto-fetch and display options.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Mic2 className="w-4 h-4 text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Auto-fetch Online Lyrics</span>
                <span className="text-[11px] text-zinc-400">Fetch synced lyrics from LRCLIB if embedded lyrics missing</span>
              </div>
            </div>
            <Checkbox
              checked={lrclibAutoFetch}
              onChange={(e) => setLrclibAutoFetch(e.target.checked)}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Lyric Romanization / Translation</span>
                <span className="text-[11px] text-zinc-400">Romanize non-Latin script lyrics automatically</span>
              </div>
            </div>
            <Checkbox
              checked={isRomanizationEnabled}
              onChange={toggleRomanization}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          {/* Romanization Mode Setting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Romanization Display Mode</span>
                <span className="text-[11px] text-zinc-400">Choose whether romanization is shown below or replaces original text</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setRomanizationMode('below')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  romanizationMode === 'below'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Add Below Original
              </button>
              <button
                onClick={() => setRomanizationMode('replace')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  romanizationMode === 'replace'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Replace Original
              </button>
            </div>
          </div>

          {/* Lyrics Font Size Setting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
            <div className="flex items-center gap-3">
              <Mic2 className="w-4 h-4 text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Lyrics Font Size Preset</span>
                <span className="text-[11px] text-zinc-400">Choose default font scaling preset for Karaoke & Lyrics view</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
              {(['normal', 'balanced', 'large', 'maximum'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setLyricsFontSizePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    lyricsFontSizePreset === preset
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {preset === 'maximum' ? 'Max Space' : preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Show Audio Specs Badge</span>
                <span className="text-[11px] text-zinc-400">Display sample rate (kHz) and bit rate in player bar</span>
              </div>
            </div>
            <Checkbox
              checked={showAudioSpecs}
              onChange={() => toggleShowAudioSpecs()}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Show Audio Format in Library</span>
                <span className="text-[11px] text-zinc-400">Display sample rate / bit depth column in track list</span>
              </div>
            </div>
            <Checkbox
              checked={showAudioSpecsInLibrary}
              onChange={() => toggleShowAudioSpecsInLibrary()}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Auto-hide Lyrics Controls</span>
                <span className="text-[11px] text-zinc-400">Fade overlay controls after mouse stops moving</span>
              </div>
            </div>
            <Checkbox
              checked={autoHideLyricsControls}
              onChange={() => toggleAutoHideLyricsControls()}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Mic2 className="w-4 h-4 text-indigo-300" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Prefer Online Lyrics</span>
                <span className="text-[11px] text-zinc-400">Always check online LRCLIB first before embedded lyrics</span>
              </div>
            </div>
            <Checkbox
              checked={preferOnlineLyrics}
              onChange={(e) => setPreferOnlineLyrics(e.target.checked)}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Enable Listening Statistics</span>
                <span className="text-[11px] text-zinc-400">Log play counts to build personalized stats</span>
              </div>
            </div>
            <Checkbox
              checked={isStatsCollectionEnabled}
              onChange={() => toggleStatsCollection()}
              size="small"
              sx={{
                color: 'var(--color-stop-1, #6366f1)',
                '&.Mui-checked': {
                  color: 'var(--color-stop-1, #6366f1)',
                },
                p: 0.5,
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Clear Listening History</span>
                <span className="text-[11px] text-zinc-400">Delete all local listening history data permanently</span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to permanently delete all your listening history? This cannot be undone.")) {
                  const { deleteListeningHistory } = await import('../utils/stats');
                  await deleteListeningHistory();
                  alert("Listening history cleared.");
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 transition-colors"
            >
              Clear History
            </button>
          </div>
        </div>
      </div>

      {/* 4. Privacy, App Reset & Storage (Danger Zone) */}
      <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-950/10 flex flex-col gap-4 items-center sm:items-stretch text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 flex-1 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0 items-center sm:items-start">
              <h3 className="text-base font-bold text-white">Reset App Data & Synced Folders</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-0.5 max-w-md">
                Removes all synced directory paths, clears app cache, and resets settings. Your audio files on disk will NOT be deleted or modified.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowWipeModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all hover:scale-105 shadow-md shadow-rose-950/50 shrink-0 self-center sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe Personal Data</span>
          </button>
        </div>
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
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowWipeModal(false);
                  await wipeDataAndReset();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md shadow-rose-950/50"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
