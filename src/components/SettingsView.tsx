import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from '@mui/material/styles';
import { usePlayerStore } from '../store/usePlayerStore';
import {
  Folder,
  RefreshCw,
  Settings2,
  Mic2,
  BarChart2,
  Volume2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { WordSyncedLyricsFinder } from './WordSyncedLyricsFinder';
import { LibrarySettingsSection } from './settings/LibrarySettingsSection';
import { AudioSettingsSection } from './settings/AudioSettingsSection';
import { LyricsBackgroundSection } from './settings/LyricsBackgroundSection';
import { LyricsTypographySection } from './settings/LyricsTypographySection';
import { StatsSettingsSection } from './settings/StatsSettingsSection';
import { SystemSettingsSection } from './settings/SystemSettingsSection';
import { prismDarkTheme } from '../theme/prismTheme';

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
  const includedDirectories = usePlayerStore((s) => s.includedDirectories);
  const refreshConfiguredLibraries = usePlayerStore((s) => s.refreshConfiguredLibraries);
  const isRefreshingLibrary = usePlayerStore((s) => s.isRefreshingLibrary);

  const [rgToastMessage, setRgToastMessage] = useState<string | null>(null);
  const rgToastTimeoutRef = useRef<any>(null);

  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);
  const isRefreshing = isRefreshingLocal || isRefreshingLibrary;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('all');

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_COLLAPSE_STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to parse collapsed sections from storage:', e);
    }
    return new Set<string>();
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current && savedSettingsScrollTop > 0) {
      scrollContainerRef.current.scrollTop = savedSettingsScrollTop;
    }
  }, []);

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
        console.warn('Failed to save collapsed sections:', e);
      }
      return next;
    });
  };

  const collapseAll = () => {
    const all = new Set(ALL_SECTION_IDS);
    setCollapsedSections(all);
    try {
      localStorage.setItem(SETTINGS_COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(all)));
    } catch {}
  };

  const expandAll = () => {
    setCollapsedSections(new Set());
    try {
      localStorage.setItem(SETTINGS_COLLAPSE_STORAGE_KEY, JSON.stringify([]));
    } catch {}
  };

  const shouldShowSection = (id: string, searchKeywords: string): boolean => {
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'library' && id !== 'library') return false;
      if (selectedCategory === 'audio' && id !== 'audio') return false;
      if (
        selectedCategory === 'lyrics' &&
        id !== 'lyrics_bg' &&
        id !== 'lyrics_typo' &&
        id !== 'lyrics_finder'
      )
        return false;
      if (selectedCategory === 'stats' && id !== 'stats') return false;
      if (selectedCategory === 'system' && id !== 'system') return false;
    }

    if (!searchQuery.trim()) return true;

    const queryTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    const combined = `${id} ${searchKeywords}`.toLowerCase();
    return queryTerms.every((term) => combined.includes(term));
  };

  const handleRefresh = async () => {
    setIsRefreshingLocal(true);
    try {
      await refreshConfiguredLibraries();
    } finally {
      setIsRefreshingLocal(false);
    }
  };

  const handleNotifyReplayGain = (msg: string) => {
    setRgToastMessage(msg);
    if (rgToastTimeoutRef.current) clearTimeout(rgToastTimeoutRef.current);
    rgToastTimeoutRef.current = setTimeout(() => {
      setRgToastMessage(null);
    }, 5000);
  };

  return (
    <ThemeProvider theme={prismDarkTheme}>
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

            {/* Top Refresh Button */}
            <div className="relative flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || includedDirectories.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md ${
                  isRefreshing || includedDirectories.length === 0
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                    : 'text-white hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
                style={
                  !isRefreshing && includedDirectories.length > 0
                    ? { backgroundColor: 'var(--color-stop-1, #6366f1)', color: 'var(--color-stop-1-text, #ffffff)' }
                    : undefined
                }
                title="Scan watched music directories for newly added/removed songs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Scanning...' : 'Scan for Changes'}</span>
              </button>
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
                placeholder="Search settings (e.g. gapless, font, romaji)..."
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
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors border border-white/5 cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors border border-white/5 cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                    isSelected
                      ? 'shadow-md scale-[1.02]'
                      : 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'var(--color-stop-1, #6366f1)',
                          borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 50%, transparent)',
                          color: 'var(--color-stop-1-text, #ffffff)',
                        }
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
                className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
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

        {/* SECTION 1: LIBRARY & FOLDERS */}
        <LibrarySettingsSection
          isCollapsed={collapsedSections.has('library')}
          onToggleCollapse={() => toggleSection('library')}
          shouldShow={shouldShowSection('library', 'library folders indexing scan tag coverage genre year key bpm missing purge')}
        />

        {/* SECTION 2: AUDIO ENGINE & PLAYBACK */}
        <AudioSettingsSection
          isCollapsed={collapsedSections.has('audio')}
          onToggleCollapse={() => toggleSection('audio')}
          shouldShow={shouldShowSection('audio', 'audio gapless replaygain volume normalization sound playback engine')}
          onNotifyReplayGain={handleNotifyReplayGain}
        />

        {/* SECTION 3: LYRICS BACKGROUND & ATMOSPHERE */}
        <LyricsBackgroundSection
          isCollapsed={collapsedSections.has('lyrics_bg')}
          onToggleCollapse={() => toggleSection('lyrics_bg')}
          shouldShow={shouldShowSection('lyrics_bg', 'lyrics background theme dynamic glow wallpaper solid color amoled blur dim layout split centered artwork scale')}
        />

        {/* SECTION 4: LYRICS DISPLAY, TYPOGRAPHY & SYNC */}
        <LyricsTypographySection
          isCollapsed={collapsedSections.has('lyrics_typo')}
          onToggleCollapse={() => toggleSection('lyrics_typo')}
          shouldShow={shouldShowSection('lyrics_typo', 'lyrics typography font animation style romanization translation lrclib sync syllable word wavy seekbar specs')}
          toTitleCase={toTitleCase}
        />

        {/* WORD-SYNCED LYRICS FINDER (Tool block) */}
        {shouldShowSection('lyrics_finder', 'word synced lyrics finder tool search download lrclib lyricsplus') && (
          <WordSyncedLyricsFinder
            isCollapsed={collapsedSections.has('lyrics_finder')}
            onToggleCollapse={() => toggleSection('lyrics_finder')}
          />
        )}

        {/* SECTION 5: STATS & ANALYTICS */}
        <StatsSettingsSection
          isCollapsed={collapsedSections.has('stats')}
          onToggleCollapse={() => toggleSection('stats')}
          shouldShow={shouldShowSection('stats', 'stats analytics listening history demo playlists privacy anonymize clear')}
        />

        {/* SECTION 6: SYSTEM, UPDATES & DANGER ZONE */}
        <SystemSettingsSection
          isCollapsed={collapsedSections.has('system')}
          onToggleCollapse={() => toggleSection('system')}
          shouldShow={shouldShowSection('system', 'system updates version reset wipe factory danger')}
        />

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
