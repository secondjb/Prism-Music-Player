import React, { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { open } from '@tauri-apps/plugin-dialog';
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

  const [isScanning, setIsScanning] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);

  // Compute Tag Indexing Stats
  const totalTracks = tracks.length;
  const genreCount = tracks.filter((t) => Boolean(t.genre)).length;
  const yearCount = tracks.filter((t) => Boolean(t.year || t.date)).length;
  const keyCount = tracks.filter((t) => Boolean(t.key)).length;
  const bpmCount = tracks.filter((t) => Boolean(t.bpm)).length;

  const handleAddIncludedDir = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Music Library Folder to Include',
        });
        if (selected && typeof selected === 'string') {
          setIsScanning(true);
          await addIncludedDirectory(selected);
          setIsScanning(false);
        }
      }
    } catch (e) {
      console.warn('Dialog error:', e);
      setIsScanning(false);
    }
  };

  const handleAddExcludedDir = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Folder to Exclude from Library',
        });
        if (selected && typeof selected === 'string') {
          setIsScanning(true);
          await addExcludedDirectory(selected);
          setIsScanning(false);
        }
      }
    } catch (e) {
      console.warn('Dialog error:', e);
      setIsScanning(false);
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    await rescanConfiguredLibraries();
    setIsScanning(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 pb-36 overflow-y-auto custom-scrollbar pr-2 h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-950/30">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Settings & Library Folders</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage watched music directories, tag indexing, audio specs, and lyrics preferences.
            </p>
          </div>
        </div>

        <button
          onClick={handleRescan}
          disabled={isScanning || includedDirectories.length === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all shadow-md ${
            isScanning || includedDirectories.length === 0
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Indexing Library...' : 'Re-index Library & Tags'}</span>
        </button>
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
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Key & BPM Tags</span>
            <span className="text-2xl font-black font-mono text-pink-300">
              {totalTracks > 0 ? `${Math.round((keyCount / totalTracks) * 100)}%` : '0%'}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Key: {keyCount} • BPM: {bpmCount}</span>
          </div>
        </div>
      </div>



      {/* 1. Included Music Folders */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">Included Music Directories</h3>
              <p className="text-xs text-zinc-400">
                Prism automatically indexes FLAC tracks from these folders. Album cover art and lyrics are lazy-loaded on demand.
              </p>
            </div>
          </div>
          <button
            onClick={handleAddIncludedDir}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold transition-all hover:scale-105"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Folder</span>
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
            <input
              type="checkbox"
              checked={lrclibAutoFetch}
              onChange={(e) => setLrclibAutoFetch(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
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
            <input
              type="checkbox"
              checked={isRomanizationEnabled}
              onChange={toggleRomanization}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
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

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Show Audio Specs Badge</span>
                <span className="text-[11px] text-zinc-400">Display sample rate (kHz) and bit rate in player bar</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={showAudioSpecs}
              onChange={toggleShowAudioSpecs}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
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
            <input
              type="checkbox"
              checked={showAudioSpecsInLibrary}
              onChange={toggleShowAudioSpecsInLibrary}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
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
            <input
              type="checkbox"
              checked={autoHideLyricsControls}
              onChange={toggleAutoHideLyricsControls}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 4. Privacy, App Reset & Storage (Danger Zone) */}
      <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-950/10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3 flex-1 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-base font-bold text-white">Reset App Data & Synced Folders</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                Removes all synced directory paths, clears app cache, and resets settings. Your audio files on disk will NOT be deleted or modified.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowWipeModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all hover:scale-105 shadow-md shadow-rose-950/50 shrink-0 self-start md:self-auto"
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
