import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Checkbox from '@mui/material/Checkbox';
import Slider from '@mui/material/Slider';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { usePlayerStore } from '../store/usePlayerStore';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  FolderPlus,
  FolderMinus,
  Folder,
  FolderGit2,
  Trash2,
  RefreshCw,
  Settings2,
  Sparkles,
  Mic2,
  Languages,
  Info,
  AlertTriangle,
  BarChart2,
  GitBranch,
  Download,
  ExternalLink,
  CheckCircle2,
  Waves,
  Activity,
  Type as TypeIcon,
  Globe,
  Volume2,
  Radio,
  FastForward,
  Image as ImageIcon,
  Palette,
  Layers,
  Columns,
  ChevronDown,
  Search,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  GITHUB_RELEASES_URL,
  openExternalLink,
} from '../utils/updateChecker';
import { M3Selector } from './M3Selector';
import { WordSyncedLyricsFinder } from './WordSyncedLyricsFinder';

// Dark MUI Theme with custom theme-reactive Discrete Slider & Checkbox styling
const muiDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
  },
  components: {
    MuiSlider: {
      styleOverrides: {
        root: {
          color: 'var(--color-stop-1, #6366f1)',
          height: 6,
        },
        thumb: {
          height: 18,
          width: 18,
          backgroundColor: '#ffffff',
          border: '2px solid var(--color-stop-1, #6366f1)',
          '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
            boxShadow: '0 0 0 8px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
          },
        },
        valueLabel: {
          lineHeight: 1.2,
          fontSize: 12,
          fontWeight: 700,
          background: 'unset',
          padding: 0,
          width: 32,
          height: 32,
          borderRadius: '50% 50% 50% 0',
          backgroundColor: 'var(--color-stop-1, #6366f1)',
          transformOrigin: 'bottom left',
          transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
          '&:before': { display: 'none' },
          '&.MuiSlider-valueLabelOpen': {
            transform: 'translate(50%, -100%) rotate(-45deg) scale(1)',
          },
          '& > *': {
            transform: 'rotate(45deg)',
          },
        },
        track: {
          height: 6,
          borderRadius: 3,
          backgroundColor: 'var(--color-stop-1, #6366f1)',
          border: 'none',
        },
        rail: {
          height: 6,
          borderRadius: 3,
          opacity: 0.25,
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
        },
        mark: {
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          height: 4,
          width: 4,
          borderRadius: '50%',
          '&.MuiSlider-markActive': {
            opacity: 1,
            backgroundColor: '#ffffff',
          },
        },
        markLabel: {
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: '0.72rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          '&.MuiSlider-markLabelActive': {
            color: 'rgba(255, 255, 255, 0.85)',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: 'rgba(255, 255, 255, 0.3)',
          '&.Mui-checked': {
            color: 'var(--color-stop-1, #6366f1)',
          },
        },
      },
    },
  },
});

const REPLAY_GAIN_OPTIONS = [
  { id: 'track', name: 'Track Gain (Recommended)', desc: 'Normalizes each track individually to standard loudness' },
  { id: 'album', name: 'Album Gain', desc: 'Preserves dynamic volume balance across album tracks' },
  { id: 'off', name: 'Disabled', desc: 'Play raw unadjusted source volume' },
] as const;

const CROSSFADE_MARKS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1s' },
  { value: 2, label: '2s' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 7, label: '7s' },
  { value: 10, label: '10s' },
];

const FONT_OPTIONS = [
  { id: 'system-ui, -apple-system, sans-serif', name: 'System Default', desc: 'Native OS typeface' },
  { id: "'Plus Jakarta Sans', system-ui, sans-serif", name: 'Google Sans / Jakarta', desc: 'Modern geometric sans', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "'Outfit', system-ui, sans-serif", name: 'Outfit', desc: 'Warm display sans', fontFamily: "'Outfit', system-ui, sans-serif" },
  { id: "'Inter', system-ui, sans-serif", name: 'Inter Clean', desc: 'Neutral high-legibility sans', fontFamily: "'Inter', system-ui, sans-serif" },
  { id: "'Lexend', system-ui, sans-serif", name: 'Lexend', desc: 'Designed for fluid reading', fontFamily: "'Lexend', system-ui, sans-serif" },
  { id: "'Poppins', system-ui, sans-serif", name: 'Poppins', desc: 'Geometric round shapes', fontFamily: "'Poppins', system-ui, sans-serif" },
  { id: "'DM Sans', system-ui, sans-serif", name: 'DM Sans', desc: 'Clean geometric low-contrast', fontFamily: "'DM Sans', system-ui, sans-serif" },
  { id: "'Nunito', system-ui, sans-serif", name: 'Nunito (Rounded)', desc: 'Soft rounded terminals', fontFamily: "'Nunito', system-ui, sans-serif" },
];

const ANIMATION_OPTIONS = [
  { id: 'apple_fluid', name: 'Apple Fluid', desc: 'Dynamic spring & focal tracking' },
  { id: 'karaoke_pulse', name: 'Karaoke Pulse', desc: 'Rhythmic scale pop & jumping text' },
  { id: 'kinetic_slide', name: 'Kinetic Slide', desc: 'Glides smoothly from leading edge' },
  { id: 'cinematic_blur', name: 'Cinematic Focus', desc: 'Soft background depth blur' },
  { id: 'lossless_glow', name: 'Lossless Glow', desc: 'Vibrant neon gradient & glass glow' },
  { id: 'card_pop', name: 'Glass Elevation', desc: '3D floating frosted card lift' },
  { id: 'apple_zoom', name: 'Dynamic Focus Zoom', desc: 'Expanded magnification with push' },
  { id: 'minimal_wave', name: 'Minimal Clean', desc: 'Low-latency opacity transitions' },
] as const;

const BACKGROUND_OPTIONS = [
  { id: 'dynamic_glow', name: 'Dynamic Ambient Glow (Default)', desc: 'Vibrant animated gradient matching active album art colors' },
  { id: 'album_art_blur', name: 'Blurred Album Artwork', desc: 'Full-bleed frosted glass cover art with custom blur & dimming' },
  { id: 'album_art_color', name: 'Album Art Dynamic Solid Tint', desc: 'Minimalist solid background derived from current album art colors' },
  { id: 'custom_photo', name: 'Custom Wallpaper / Image', desc: 'Custom local photo background with adjustable blur & opacity' },
  { id: 'solid_color', name: 'Solid Color Theme', desc: 'Clean single-shade minimalist background' },
  { id: 'amoled_black', name: 'AMOLED Pure Black (#000000)', desc: 'Zero glow pure black for OLED displays & maximum battery saving' },
] as const;

type SettingsCategory = 'all' | 'library' | 'audio' | 'lyrics' | 'stats' | 'system';

const CATEGORIES: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Settings', icon: <Settings2 className="w-3.5 h-3.5" /> },
  { id: 'library', label: 'Library & Folders', icon: <Folder className="w-3.5 h-3.5" /> },
  { id: 'audio', label: 'Audio & Playback', icon: <Volume2 className="w-3.5 h-3.5" /> },
  { id: 'lyrics', label: 'Lyrics & Visuals', icon: <Mic2 className="w-3.5 h-3.5" /> },
  { id: 'stats', label: 'Stats & Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'system', label: 'System & Danger', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
];

const ALL_SECTION_IDS = ['library', 'audio', 'lyrics_bg', 'lyrics_typo', 'lyrics_finder', 'stats', 'system'];

const SETTINGS_COLLAPSE_STORAGE_KEY = 'prism_settings_collapsed_sections';

let savedSettingsScrollTop = 0;

export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

export const SettingsView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const excludedDirectories = usePlayerStore((s) => s.excludedDirectories);
  const addIncludedDirectory = usePlayerStore((s) => s.addIncludedDirectory);
  const removeIncludedDirectory = usePlayerStore((s) => s.removeIncludedDirectory);
  const addExcludedDirectory = usePlayerStore((s) => s.addExcludedDirectory);
  const removeExcludedDirectory = usePlayerStore((s) => s.removeExcludedDirectory);
  const rescanConfiguredLibraries = usePlayerStore((s) => s.rescanConfiguredLibraries);
  const refreshConfiguredLibraries = usePlayerStore((s) => s.refreshConfiguredLibraries);
  const purgeMissingTracks = usePlayerStore((s) => s.purgeMissingTracks);
  const isRefreshingLibrary = usePlayerStore((s) => s.isRefreshingLibrary);
  const lastRefreshResult = usePlayerStore((s) => s.lastRefreshResult);
  const analyzeAndIndexAudio = usePlayerStore((s) => s.analyzeAndIndexAudio);
  const clearAudioAnalysis = usePlayerStore((s) => s.clearAudioAnalysis);
  const wipeDataAndReset = usePlayerStore((s) => s.wipeDataAndReset);

  const isScanningReplayGain = usePlayerStore((s) => s.isScanningReplayGain);
  const replayGainScanProgress = usePlayerStore((s) => s.replayGainScanProgress);
  const startReplayGainScan = usePlayerStore((s) => s.startReplayGainScan);
  const cancelReplayGainScan = usePlayerStore((s) => s.cancelReplayGainScan);

  const [scanUntaggedOnly, setScanUntaggedOnly] = useState(true);
  const [writeRgTagsToFiles, setWriteRgTagsToFiles] = useState(false);
  const [rgToastMessage, setRgToastMessage] = useState<string | null>(null);
  const rgToastTimeoutRef = useRef<any>(null);

  const backgroundType = usePlayerStore((s) => s.backgroundType);
  const setBackgroundType = usePlayerStore((s) => s.setBackgroundType);
  const customBgPath = usePlayerStore((s) => s.customBgPath);
  const setCustomBgPath = usePlayerStore((s) => s.setCustomBgPath);
  const customBgColor = usePlayerStore((s) => s.customBgColor);
  const setCustomBgColor = usePlayerStore((s) => s.setCustomBgColor);
  const bgBlurAmount = usePlayerStore((s) => s.bgBlurAmount);
  const setBgBlurAmount = usePlayerStore((s) => s.setBgBlurAmount);
  const bgDimOpacity = usePlayerStore((s) => s.bgDimOpacity);
  const setBgDimOpacity = usePlayerStore((s) => s.setBgDimOpacity);
  const lyricsLayoutMode = usePlayerStore((s) => s.lyricsLayoutMode);
  const setLyricsLayoutMode = usePlayerStore((s) => s.setLyricsLayoutMode);

  const lrclibAutoFetch = usePlayerStore((s) => s.lrclibAutoFetch);
  const setLrclibAutoFetch = usePlayerStore((s) => s.setLrclibAutoFetch);
  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const toggleRomanization = usePlayerStore((s) => s.toggleRomanization);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const setRomanizationMode = usePlayerStore((s) => s.setRomanizationMode);
  const isTranslationEnabled = usePlayerStore((s) => s.isTranslationEnabled);
  const toggleTranslation = usePlayerStore((s) => s.toggleTranslation);
  const translationMode = usePlayerStore((s) => s.translationMode);
  const setTranslationMode = usePlayerStore((s) => s.setTranslationMode);
  const showAudioSpecs = usePlayerStore((s) => s.showAudioSpecs);
  const toggleShowAudioSpecs = usePlayerStore((s) => s.toggleShowAudioSpecs);
  const autoHideLyricsControls = usePlayerStore((s) => s.autoHideLyricsControls);
  const toggleAutoHideLyricsControls = usePlayerStore((s) => s.toggleAutoHideLyricsControls);
  const preferOnlineLyrics = usePlayerStore((s) => s.preferOnlineLyrics);
  const setPreferOnlineLyrics = usePlayerStore((s) => s.setPreferOnlineLyrics);
  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  const toggleStatsCollection = usePlayerStore((s) => s.toggleStatsCollection);
  const showDemoStats = usePlayerStore((s) => s.showDemoStats);
  const toggleShowDemoStats = usePlayerStore((s) => s.toggleShowDemoStats);
  const anonymizeStats = usePlayerStore((s) => s.anonymizeStats);
  const toggleAnonymizeStats = usePlayerStore((s) => s.toggleAnonymizeStats);
  const generateDemoPlaylists = usePlayerStore((s) => s.generateDemoPlaylists);
  const lyricsFontSizePreset = usePlayerStore((s) => s.lyricsFontSizePreset);
  const setLyricsFontSizePreset = usePlayerStore((s) => s.setLyricsFontSizePreset);
  const lyricsFontFamily = usePlayerStore((s) => s.lyricsFontFamily);
  const setLyricsFontFamily = usePlayerStore((s) => s.setLyricsFontFamily);
  const lyricsAnimationStyle = usePlayerStore((s) => s.lyricsAnimationStyle);
  const setLyricsAnimationStyle = usePlayerStore((s) => s.setLyricsAnimationStyle);
  const isWavySeekbarEnabled = usePlayerStore((s) => s.isWavySeekbarEnabled);
  const toggleWavySeekbar = usePlayerStore((s) => s.toggleWavySeekbar);
  const autoEmbedLyrics = usePlayerStore((s) => s.autoEmbedLyrics);
  const toggleAutoEmbedLyrics = usePlayerStore((s) => s.toggleAutoEmbedLyrics);
  const preferWordSyncedLyrics = usePlayerStore((s) => s.preferWordSyncedLyrics);
  const togglePreferWordSyncedLyrics = usePlayerStore((s) => s.togglePreferWordSyncedLyrics);
  const inferWordSyncedLyrics = usePlayerStore((s) => s.inferWordSyncedLyrics);
  const toggleInferWordSyncedLyrics = usePlayerStore((s) => s.toggleInferWordSyncedLyrics);

  const crossfadeDuration = usePlayerStore((s) => s.crossfadeDuration);
  const setCrossfadeDuration = usePlayerStore((s) => s.setCrossfadeDuration);
  const isGaplessEnabled = usePlayerStore((s) => s.isGaplessEnabled);
  const toggleGaplessEnabled = usePlayerStore((s) => s.toggleGaplessEnabled);
  const replayGainMode = usePlayerStore((s) => s.replayGainMode);
  const setReplayGainMode = usePlayerStore((s) => s.setReplayGainMode);

  const autoCheckUpdates = usePlayerStore((s) => s.autoCheckUpdates);
  const toggleAutoCheckUpdates = usePlayerStore((s) => s.toggleAutoCheckUpdates);
  const latestUpdateResult = usePlayerStore((s) => s.latestUpdateResult);
  const isCheckingUpdate = usePlayerStore((s) => s.isCheckingUpdate);
  const checkAppUpdate = usePlayerStore((s) => s.checkAppUpdate);

  const isScanningStore = usePlayerStore((s) => s.isScanning);
  const scanStatusMessage = usePlayerStore((s) => s.scanStatusMessage);
  const setScanStatusMessage = usePlayerStore((s) => s.setScanStatusMessage);

  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);
  const isScanning = isScanningStore || isScanningLocal;
  const isRefreshing = isRefreshingLibrary || isRefreshingLocal;

  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const [demoPlaylistsCreated, setDemoPlaylistsCreated] = useState(false);

  // Search & Filter Category
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRefreshDropdown, setShowRefreshDropdown] = useState(false);

  // Collapsible Accordion State (remembered in localStorage, default: all expanded)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_COLLAPSE_STORAGE_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // Fallback: start with all expanded (empty set of collapsed)
    }
    return new Set<string>();
  });

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(SETTINGS_COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save settings collapsed state', e);
      }
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedSections(new Set<string>());
    try {
      localStorage.setItem(SETTINGS_COLLAPSE_STORAGE_KEY, JSON.stringify([]));
    } catch {}
  };

  const collapseAll = () => {
    setCollapsedSections(new Set<string>(ALL_SECTION_IDS));
    try {
      localStorage.setItem(SETTINGS_COLLAPSE_STORAGE_KEY, JSON.stringify(ALL_SECTION_IDS));
    } catch {}
  };

  // Compute Tag Indexing Stats
  const totalTracks = tracks.length;
  const genreCount = tracks.filter((t) => Boolean(t.genre)).length;
  const yearCount = tracks.filter((t) => Boolean(t.year || t.date)).length;
  const keyCount = tracks.filter((t) => Boolean(t.key)).length;
  const bpmCount = tracks.filter((t) => Boolean(t.bpm)).length;
  const keyOrBpmCount = tracks.filter((t) => Boolean(t.key || t.bpm)).length;
  const replayGainCount = tracks.filter((t) => t.replay_gain_db != null).length;
  const missingTracksCount = tracks.filter((t) => Boolean(t.missing_since)).length;

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

  const handleRefresh = async () => {
    setIsRefreshingLocal(true);
    try {
      await refreshConfiguredLibraries();
      setShowRefreshDropdown(true);
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const handlePurgeMissing = async () => {
    if (window.confirm('Remove all missing songs from library index now?')) {
      await purgeMissingTracks();
    }
  };

  const audioAnalysisProgress = usePlayerStore((s) => s.audioAnalysisProgress);
  const isAnalyzing = isAnalyzingAudio || audioAnalysisProgress !== null;

  const handleAnalyzeAudio = async () => {
    setIsAnalyzingAudio(true);
    await analyzeAndIndexAudio();
    setIsAnalyzingAudio(false);
  };

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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedSettingsScrollTop;
    }
  }, []);

  // Filter helper
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  const shouldShowSection = (sectionId: string, searchKeywords: string) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'library' && sectionId === 'library') ||
      (selectedCategory === 'audio' && sectionId === 'audio') ||
      (selectedCategory === 'lyrics' &&
        (sectionId === 'lyrics_bg' || sectionId === 'lyrics_typo' || sectionId === 'lyrics_finder')) ||
      (selectedCategory === 'stats' && sectionId === 'stats') ||
      (selectedCategory === 'system' && sectionId === 'system');

    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    return matchesSearch(searchKeywords);
  };

  // 3-State Romanization Handler
  const handleRomanizationChange = (state: 'off' | 'below' | 'replace') => {
    if (state === 'off') {
      if (isRomanizationEnabled) toggleRomanization();
    } else {
      if (!isRomanizationEnabled) toggleRomanization();
      setRomanizationMode(state);
    }
  };

  const currentRomanizationState = !isRomanizationEnabled ? 'off' : romanizationMode;

  // 3-State Translation Handler
  const handleTranslationChange = (state: 'off' | 'below' | 'replace') => {
    if (state === 'off') {
      if (isTranslationEnabled) toggleTranslation();
    } else {
      if (!isTranslationEnabled) toggleTranslation();
      setTranslationMode(state);
    }
  };

  const currentTranslationState = !isTranslationEnabled ? 'off' : translationMode;

  return (
    <ThemeProvider theme={muiDarkTheme}>
      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          savedSettingsScrollTop = e.currentTarget.scrollTop;
        }}
        className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-36 overflow-y-auto custom-scrollbar pr-2 h-full"
      >
        {/* Top Header Toolbar */}
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl border flex items-center justify-center shadow-lg shrink-0"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                }}
              >
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Settings & Preferences</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure library indexing, audio playback, lyrics styling, and stats.
                </p>
              </div>
            </div>

            {/* Single Top Refresh Button with Dropdown Notification */}
            <div className="relative flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isScanning || includedDirectories.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md ${
                  isRefreshing || isScanning || includedDirectories.length === 0
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                    : 'text-white hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
                style={
                  !isRefreshing && !isScanning && includedDirectories.length > 0
                    ? { backgroundColor: 'var(--color-stop-1, #6366f1)', color: 'var(--color-stop-1-text, #ffffff)' }
                    : undefined
                }
                title="Scan watched music directories for newly added/removed songs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Scanning...' : 'Scan for Changes'}</span>
              </button>

              {lastRefreshResult && (
                <button
                  onClick={() => setShowRefreshDropdown(!showRefreshDropdown)}
                  className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold border transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                  }}
                  title="View scan details and changes"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    +{lastRefreshResult.added_count} / -{lastRefreshResult.removed_count}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showRefreshDropdown ? 'rotate-180' : ''}`}
                  />
                </button>
              )}

              {/* Refresh Results Dropdown */}
              {showRefreshDropdown && lastRefreshResult && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 glass-panel border rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
                  style={{ borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)' }}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      Scan Summary
                    </span>
                    <button
                      onClick={() => setShowRefreshDropdown(false)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-1.5 py-0.5 rounded"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-300">
                    <div className="flex justify-between">
                      <span>Newly Added Songs:</span>
                      <strong className="text-emerald-400 font-mono">+{lastRefreshResult.added_count}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Missing from Disk:</span>
                      <strong className="text-amber-400 font-mono">{lastRefreshResult.missing_count}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Purged Tracks:</span>
                      <strong className="text-rose-400 font-mono">{lastRefreshResult.removed_count}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5 font-semibold">
                      <span>Total Active Tracks:</span>
                      <strong className="text-white font-mono">{lastRefreshResult.total_count}</strong>
                    </div>
                  </div>

                  {lastRefreshResult.missing_count > 0 && (
                    <button
                      onClick={async () => {
                        await handlePurgeMissing();
                        setShowRefreshDropdown(false);
                      }}
                      className="mt-1 w-full py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/50 transition-colors"
                    >
                      Purge Missing Songs Now
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search Input & Category Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings (e.g. crossfade, font, romaji)..."
                className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Expand / Collapse All Controls */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <button
                onClick={expandAll}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors border border-white/5"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors border border-white/5"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'shadow-md'
                      : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: 'var(--color-stop-1, #6366f1)', color: 'var(--color-stop-1-text, #ffffff)' }
                      : undefined
                  }
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Folder Scan Status Banner */}
        {scanStatusMessage && (
          <div
            className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 shadow-xl transition-all"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, #09090b)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
          >
            <div className="flex items-center gap-3">
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${isScanning || isRefreshing ? 'animate-spin' : ''}`}
                style={{ color: 'var(--color-stop-1, #6366f1)' }}
              />
              <div>
                <p className="text-xs font-bold text-white">{scanStatusMessage}</p>
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

        {/* ========================================================================= */}
        {/* SECTION 1: LIBRARY & FOLDERS */}
        {/* ========================================================================= */}
        {shouldShowSection('library', 'library folders indexing scan tag coverage genre year key bpm missing purge') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('library')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('library') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                    !collapsedSections.has('library') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('library') && (
              <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-5 mt-1">
                {/* Tag Indexing Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Tracks</span>
                    <span className="text-xl font-bold font-mono text-white">{totalTracks}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Genre Tags</span>
                    <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                      {totalTracks > 0 ? `${Math.round((genreCount / totalTracks) * 100)}%` : '0%'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate">{genreCount} / {totalTracks}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Year / Date</span>
                    <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-stop-2, #8b5cf6)' }}>
                      {totalTracks > 0 ? `${Math.round((yearCount / totalTracks) * 100)}%` : '0%'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate">{yearCount} / {totalTracks}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Key & BPM</span>
                    <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-stop-3, #ec4899)' }}>
                      {totalTracks > 0 ? `${Math.round((keyOrBpmCount / totalTracks) * 100)}%` : '0%'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate">Key: {keyCount} • BPM: {bpmCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">ReplayGain</span>
                    <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-stop-4, #d946ef)' }}>
                      {totalTracks > 0 ? `${Math.round((replayGainCount / totalTracks) * 100)}%` : '0%'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono truncate">{replayGainCount} / {totalTracks}</span>
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

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {isScanningReplayGain ? (
                        <button
                          onClick={cancelReplayGainScan}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Cancel Scan
                        </button>
                      ) : (
                        <button
                          onClick={() => startReplayGainScan({ untaggedOnly: scanUntaggedOnly, writeToFiles: writeRgTagsToFiles })}
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
                              ? `Scan Untagged Tracks (${totalTracks - replayGainCount})`
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

                  {/* Active Scan Progress */}
                  {isScanningReplayGain && replayGainScanProgress && (
                    <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium truncate max-w-[70%]">
                          Analyzing: <span className="text-white font-mono">{replayGainScanProgress.path.split(/[\\/]/).pop()}</span>
                        </span>
                        <span className="font-mono font-bold" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                          {replayGainScanProgress.current} / {replayGainScanProgress.total} (
                          {Math.round((replayGainScanProgress.current / Math.max(1, replayGainScanProgress.total)) * 100)}%)
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-150 rounded-full"
                          style={{
                            width: `${Math.round(
                              (replayGainScanProgress.current / Math.max(1, replayGainScanProgress.total)) * 100
                            )}%`,
                            background: 'linear-gradient(90deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #8b5cf6))',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Missing Songs Alert */}
                {missingTracksCount > 0 && (
                  <div
                    className="p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 15%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 35%, transparent)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span className="text-zinc-200">
                        <strong className="text-white">{missingTracksCount}</strong> song{missingTracksCount > 1 ? 's are' : ' is'} missing from disk.
                      </span>
                    </div>
                    <button
                      onClick={handlePurgeMissing}
                      className="px-3 py-1.5 rounded-lg font-semibold text-white text-[11px] transition-all hover:scale-105 shrink-0 shadow-md cursor-pointer"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 80%, black)' }}
                    >
                      Purge Missing Now
                    </button>
                  </div>
                )}

                {/* Manual Path Input */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleManualAddPath();
                    }}
                    placeholder="Type or paste custom folder path (e.g. C:\Users\YourName\Music)"
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
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
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: AUDIO ENGINE & PLAYBACK */}
        {/* ========================================================================= */}
        {shouldShowSection('audio', 'audio crossfade gapless replaygain volume normalization sound playback engine') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('audio')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('audio') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                    Crossfading, gapless audio transitions, and ReplayGain volume normalization
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
                  {crossfadeDuration === 0 ? 'Crossfade Off' : `${crossfadeDuration}s Fade`} • {isGaplessEnabled ? 'Gapless On' : 'Gapless Off'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    !collapsedSections.has('audio') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('audio') && (
              <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-4 mt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                  {/* Crossfade Duration Slider */}
                  <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FastForward className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">Crossfade & Mix Duration</span>
                          <span className="text-[11px] text-zinc-400">
                            Seamlessly blend and crossfade outgoing songs into incoming tracks
                          </span>
                        </div>
                      </div>
                      <span
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg border"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                          color: 'var(--color-stop-1, #6366f1)',
                        }}
                      >
                        {crossfadeDuration === 0 ? 'Off (0.0s)' : `${crossfadeDuration.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="px-3 pt-2 pb-1">
                      <Slider
                        aria-label="Crossfade Duration"
                        value={crossfadeDuration}
                        onChange={(_, val) => setCrossfadeDuration(val as number)}
                        min={0}
                        max={10}
                        step={0.5}
                        marks={CROSSFADE_MARKS}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => (v === 0 ? 'Off' : `${v}s`)}
                      />
                    </div>
                  </div>

                  {/* Gapless Playback Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Radio className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white">Gapless Playback</span>
                        <span className="text-[11px] text-zinc-400 leading-tight">
                          Preloads upcoming tracks to eliminate gaps
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
                              setRgToastMessage(
                                `ReplayGain (${newMode} mode) enabled. ${untagged} track${
                                  untagged === 1 ? '' : 's'
                                } lack loudness data — run the ReplayGain Scanner in Library Settings to normalize.`
                              );
                              if (rgToastTimeoutRef.current) clearTimeout(rgToastTimeoutRef.current);
                              rgToastTimeoutRef.current = setTimeout(() => {
                                setRgToastMessage(null);
                              }, 5000);
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
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: LYRICS BACKGROUND & ATMOSPHERE */}
        {/* ========================================================================= */}
        {shouldShowSection('lyrics_bg', 'lyrics background theme dynamic glow wallpaper solid color amoled blur dim layout split centered artwork scale') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('lyrics_bg')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('lyrics_bg') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                  <Palette className="w-4.5 h-4.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm font-bold text-white">Lyrics Background & Atmosphere</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    Dynamic ambient glow, blurred album art, wallpapers, solid colors, and layout
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
                  {toTitleCase(backgroundType)} • {toTitleCase(lyricsLayoutMode)}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    !collapsedSections.has('lyrics_bg') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('lyrics_bg') && (
              <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-4 mt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                  {/* Background Mode Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Background Visual Style</span>
                        <span className="text-[11px] text-zinc-400">Atmosphere for full lyrics view</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-80">
                      <M3Selector
                        value={backgroundType}
                        onChange={(val) => setBackgroundType(val as any)}
                        options={BACKGROUND_OPTIONS}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Custom Photo Wallpaper controls */}
                  {backgroundType === 'custom_photo' && (
                    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ImageIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-white">Custom Wallpaper Photo</span>
                            <span className="text-[11px] text-zinc-400 truncate max-w-md">
                              {customBgPath ? customBgPath : 'No custom photo selected'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const selected = await open({
                                multiple: false,
                                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
                              });
                              if (selected && typeof selected === 'string') {
                                const assetUrl = window.__TAURI_INTERNALS__ ? convertFileSrc(selected) : selected;
                                setCustomBgPath(assetUrl);
                              }
                            } catch (e) {
                              console.warn('Pick background image error:', e);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0"
                          style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                        >
                          Choose Photo...
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Solid Color Picker & Presets */}
                  {backgroundType === 'solid_color' && (
                    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Palette className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                          <span className="text-xs font-semibold text-white">Solid Color Palette</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customBgColor}
                            onChange={(e) => setCustomBgColor(e.target.value)}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={customBgColor}
                            onChange={(e) => setCustomBgColor(e.target.value)}
                            className="w-20 px-2 py-0.5 text-xs font-mono bg-zinc-900 border border-white/10 rounded-lg text-white"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-white/5 flex-wrap">
                        {['#0f172a', '#18181b', '#000000', '#0a0a0c', '#1e1b4b', '#1e1e2f', '#022c22', '#1f1300', '#3b0764'].map((c) => (
                          <button
                            key={c}
                            onClick={() => setCustomBgColor(c)}
                            className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                              customBgColor.toLowerCase() === c.toLowerCase() ? 'border-white scale-110 shadow-lg' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blur & Dimming controls */}
                  {(backgroundType === 'album_art_blur' || backgroundType === 'custom_photo') && (
                    <>
                      <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">Background Blur</span>
                          <span className="font-mono text-xs text-zinc-300">{bgBlurAmount}px</span>
                        </div>
                        <Slider
                          value={bgBlurAmount}
                          min={0}
                          max={80}
                          step={2}
                          onChange={(_, val) => setBgBlurAmount(val as number)}
                          valueLabelDisplay="auto"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">Dark Dimming Overlay</span>
                          <span className="font-mono text-xs text-zinc-300">{Math.round(bgDimOpacity * 100)}%</span>
                        </div>
                        <Slider
                          value={bgDimOpacity}
                          min={0}
                          max={0.9}
                          step={0.05}
                          onChange={(_, val) => setBgDimOpacity(val as number)}
                          valueLabelDisplay="auto"
                        />
                      </div>
                    </>
                  )}

                  {/* Lyrics Screen Layout Mode */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Columns className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Lyrics Screen Layout</span>
                        <span className="text-[11px] text-zinc-400">Side-by-Side Split or Centered Focus</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                      <button
                        onClick={() => setLyricsLayoutMode('centered')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          lyricsLayoutMode === 'centered'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={lyricsLayoutMode === 'centered' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Centered Focus
                      </button>
                      <button
                        onClick={() => setLyricsLayoutMode('split')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          lyricsLayoutMode === 'split'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={lyricsLayoutMode === 'split' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Side-by-Side Split
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: LYRICS DISPLAY, TYPOGRAPHY & SYNC */}
        {/* ========================================================================= */}
        {shouldShowSection('lyrics_typo', 'lyrics typography font animation style romanization translation lrclib sync syllable word wavy seekbar specs') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('lyrics_typo')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('lyrics_typo') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                  <TypeIcon className="w-4.5 h-4.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm font-bold text-white">Lyrics Display, Typography & Sync</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    Fonts, animation styles, 3-state Romanization & Translation, and LRCLIB sync
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/5 border border-white/10 text-zinc-300">
                  {toTitleCase(lyricsFontSizePreset)} • {toTitleCase(lyricsAnimationStyle)}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    !collapsedSections.has('lyrics_typo') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('lyrics_typo') && (
              <div className="p-5 pt-0 border-t border-white/5 flex flex-col gap-4 mt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                  {/* Lyrics Typography Setting */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <TypeIcon className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Lyrics Font Family</span>
                        <span className="text-[11px] text-zinc-400">Typeface for synced & unsynced lyrics</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-72">
                      <M3Selector
                        value={lyricsFontFamily}
                        onChange={(val) => setLyricsFontFamily(val)}
                        options={FONT_OPTIONS}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Lyrics Font Size Preset */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Font Size Scaling</span>
                        <span className="text-[11px] text-zinc-400">Default sizing preset for lyrics viewport</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                      {(['normal', 'balanced', 'large', 'maximum'] as const).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setLyricsFontSizePreset(preset)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                            lyricsFontSizePreset === preset
                              ? 'text-white shadow-md font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          style={lyricsFontSizePreset === preset ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                        >
                          {preset === 'maximum' ? 'Max' : preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lyric Animation Style Setting */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-2.5 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Motion & Animation Style</span>
                        <span className="text-[11px] text-zinc-400">Fluid spring motion and focal tracking</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-72">
                      <M3Selector
                        value={lyricsAnimationStyle}
                        onChange={(val) => setLyricsAnimationStyle(val as any)}
                        options={ANIMATION_OPTIONS}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* 3-State Romanization Multi-Segment Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Languages className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Lyric Romanization</span>
                        <span className="text-[11px] text-zinc-400">Pronunciation for Japanese, Korean & Chinese</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                      <button
                        onClick={() => handleRomanizationChange('off')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentRomanizationState === 'off'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentRomanizationState === 'off' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Off
                      </button>
                      <button
                        onClick={() => handleRomanizationChange('below')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentRomanizationState === 'below'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentRomanizationState === 'below' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Below Original
                      </button>
                      <button
                        onClick={() => handleRomanizationChange('replace')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentRomanizationState === 'replace'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentRomanizationState === 'replace' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Replace Original
                      </button>
                    </div>
                  </div>

                  {/* 3-State Translation Multi-Segment Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3 col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Lyric Translation</span>
                        <span className="text-[11px] text-zinc-400">English translation with synchronized timestamps</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                      <button
                        onClick={() => handleTranslationChange('off')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentTranslationState === 'off'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentTranslationState === 'off' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Off
                      </button>
                      <button
                        onClick={() => handleTranslationChange('below')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentTranslationState === 'below'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentTranslationState === 'below' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Below Original
                      </button>
                      <button
                        onClick={() => handleTranslationChange('replace')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          currentTranslationState === 'replace'
                            ? 'text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        style={currentTranslationState === 'replace' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                      >
                        Replace Original
                      </button>
                    </div>
                  </div>

                  {/* Sync & Feature Toggles Grid */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Auto-fetch Online Lyrics</span>
                        <span className="text-[10px] text-zinc-400">Search online providers if embedded is missing</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={lrclibAutoFetch}
                      onChange={(e) => setLrclibAutoFetch(e.target.checked)}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Prefer Syllable/Word Sync</span>
                        <span className="text-[10px] text-zinc-400">Fetch word-level timestamps when available</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={preferWordSyncedLyrics}
                      onChange={togglePreferWordSyncedLyrics}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-3, #ec4899)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Infer Word-by-Word Sync</span>
                        <span className="text-[10px] text-zinc-400">Estimate word timing for standard LRC lines</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={inferWordSyncedLyrics}
                      onChange={toggleInferWordSyncedLyrics}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Download className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Auto-embed to Audio Files</span>
                        <span className="text-[10px] text-zinc-400">Save fetched lyrics directly to file tags</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={autoEmbedLyrics}
                      onChange={toggleAutoEmbedLyrics}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  {/* Prefer Online moved to slot 5 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Mic2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Prefer Online Over Embedded</span>
                        <span className="text-[10px] text-zinc-400">Check online providers before embedded tags</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={preferOnlineLyrics}
                      onChange={(e) => setPreferOnlineLyrics(e.target.checked)}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-2, #8b5cf6)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Show Audio Specs Badge</span>
                        <span className="text-[10px] text-zinc-400">Display sample rate (kHz) & bit depth</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={showAudioSpecs}
                      onChange={() => toggleShowAudioSpecs()}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Info className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Auto-hide Lyrics Controls</span>
                        <span className="text-[10px] text-zinc-400">Fade buttons after mouse stops moving</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={autoHideLyricsControls}
                      onChange={() => toggleAutoHideLyricsControls()}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>

                  {/* Wavy Seekbar moved to slot 8 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Waves className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Wavy Seekbar</span>
                        <span className="text-[10px] text-zinc-400">Dynamic 3-layer frosted waveform seekbar</span>
                      </div>
                    </div>
                    <Checkbox
                      checked={isWavySeekbarEnabled}
                      onChange={toggleWavySeekbar}
                      size="small"
                      sx={{
                        color: 'var(--color-stop-1, #6366f1)',
                        '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                        p: 0.5,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* WORD-SYNCED LYRICS FINDER (Tool block) */}
        {/* ========================================================================= */}
        {shouldShowSection('lyrics_finder', 'word synced lyrics finder tool search download lrclib lyricsplus') && (
          <WordSyncedLyricsFinder
            isCollapsed={collapsedSections.has('lyrics_finder')}
            onToggleCollapse={() => toggleSection('lyrics_finder')}
          />
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: STATS & ANALYTICS */}
        {/* ========================================================================= */}
        {shouldShowSection('stats', 'stats analytics listening history demo playlists privacy anonymize clear') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('stats')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('stats') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                    !collapsedSections.has('stats') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('stats') && (
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
                        <span className="text-[10px] text-zinc-400">Permanently delete local listening logs</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to permanently delete all your listening history?')) {
                          const { deleteListeningHistory } = await import('../utils/stats');
                          await deleteListeningHistory();
                          alert('Listening history cleared.');
                        }
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 transition-colors cursor-pointer"
                    >
                      Clear History
                    </button>
                  </div>

                  {/* Clear Key & BPM Analysis */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Reset Key & BPM Tags</span>
                        <span className="text-[10px] text-zinc-400">Reset analyzed audio tags across library</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to reset all analyzed Key & BPM tags?')) {
                          await clearAudioAnalysis();
                        }
                      }}
                      disabled={isAnalyzing || isScanning}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Reset Key/BPM
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 6: SYSTEM, UPDATES & DANGER ZONE */}
        {/* ========================================================================= */}
        {shouldShowSection('system', 'system updates version github release danger reset wipe clean data app') && (
          <div className="glass-card rounded-2xl border border-white/10 shadow-xl transition-all shrink-0">
            {/* Accordion Header */}
            <div
              onClick={() => toggleSection('system')}
              className={`flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none ${
                collapsedSections.has('system') ? 'rounded-2xl' : 'rounded-t-2xl'
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
                    !collapsedSections.has('system') ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>

            {/* Accordion Content */}
            {!collapsedSections.has('system') && (
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
        )}

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

        {/* Floating ReplayGain Toast Notification */}
        <AnimatePresence>
          {rgToastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-24 right-8 z-50 max-w-sm p-4 rounded-2xl glass-panel border shadow-2xl flex items-start justify-between gap-3 text-xs pointer-events-auto"
              style={{
                backgroundColor: 'rgba(18, 18, 24, 0.96)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.6), 0 0 20px -2px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
              }}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Volume2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="font-semibold text-white">ReplayGain Activated</span>
                  <span className="text-[11px] text-zinc-300 leading-snug">{rgToastMessage}</span>
                  <button
                    onClick={() => {
                      setSelectedCategory('library');
                      setCollapsedSections((prev) => {
                        const next = new Set(prev);
                        next.delete('library');
                        return next;
                      });
                      setRgToastMessage(null);
                    }}
                    className="self-start text-[11px] font-semibold underline underline-offset-2 hover:brightness-125 cursor-pointer"
                    style={{ color: 'var(--color-stop-1, #6366f1)' }}
                  >
                    Go to Loudness Scanner →
                  </button>
                </div>
              </div>
              <button
                onClick={() => setRgToastMessage(null)}
                className="text-zinc-500 hover:text-white px-1.5 py-0.5 rounded text-xs shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  );
};
