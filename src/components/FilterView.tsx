import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { invoke } from '@tauri-apps/api/core';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { isWordSyncedLrc, hasLrcTimestamps } from '../utils/lrclibFetcher';
import { hasTranslationInLyrics } from '../utils/lyricsParser';
import {
  SlidersHorizontal,
  Search,
  RotateCcw,
  PlusCircle,
  Play,
  Music,
  Heart,
  Calendar,
  Activity,
  Check,
  ChevronDown,
  X,
  Tag,
  KeyRound,
  Languages,
  Sparkles,
  Clock,
  AlignLeft,
} from 'lucide-react';

type LyricsFilterType = 'translation' | 'wordSynced' | 'synced' | 'unsynced';

// Dark MUI Theme for Sliders
const muiDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo 500
    },
  },
});

// Lazy-loaded Track Row with Album Art Thumbnail & Hover Play Button
const FilterTrackRow: React.FC<{
  track: Track;
  isPlayingCurrent: boolean;
  isLiked: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onShowInfo: () => void;
  formatDuration: (secs: number) => string;
}> = ({ track, isPlayingCurrent, isLiked, onPlay, onToggleLike, onShowInfo, formatDuration }) => {
  const trackArt = useTrackArt(track);

  return (
    <div
      onDoubleClick={onPlay}
      className={`flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-150 group cursor-pointer border ${
        isPlayingCurrent
          ? 'text-white'
          : 'hover:bg-white/10 border-transparent text-zinc-300 hover:text-white'
      }`}
      style={
        isPlayingCurrent
          ? {
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              boxShadow: '0 0 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Lazy Loaded Art Thumbnail with Hover Play Button */}
        <div
          onClick={onPlay}
          className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-white/10 relative group/art cursor-pointer"
        >
          {trackArt ? (
            <img src={trackArt} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800/80 flex items-center justify-center text-zinc-400">
              <Music className="w-4 h-4" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center shadow-md group-hover/art:scale-110 transition-transform"
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            >
              <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate text-white">{track.title}</span>
          <span className="text-xs text-zinc-400 truncate pointer-events-auto">
            <span 
              className="cursor-pointer hover:underline hover:text-indigo-400"
              onClick={(e) => {
                if (track.artist && track.artist !== 'Unknown Artist') {
                  e.stopPropagation();
                  usePlayerStore.getState().navigateToArtist(track.artist);
                }
              }}
            >
              {track.artist}
            </span>
            {track.album && (
              <>
                {' • '}
                <span 
                  className="cursor-pointer hover:underline hover:text-indigo-400"
                  onClick={(e) => {
                    if (track.album && track.album !== 'Unknown Album') {
                      e.stopPropagation();
                      usePlayerStore.getState().navigateToAlbum(track.album);
                    }
                  }}
                >
                  {track.album}
                </span>
              </>
            )}
          </span>
        </div>
      </div>


      <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 shrink-0">
        {track.genre && (
          <span className="hidden md:inline-block px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-sans text-zinc-300">
            {track.genre}
          </span>
        )}

        {track.year && (
          <span 
            className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[11px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
              color: 'var(--color-stop-1, #818cf8)',
            }}
          >
            {track.year}
          </span>
        )}

        {track.key && (
          <span className="hidden md:inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold">
            {track.key}
          </span>
        )}

        {track.bpm && (
          <span 
            className="hidden lg:inline-block px-2 py-0.5 rounded-md text-[11px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-4, #d946ef) 20%, transparent)',
              color: 'var(--color-stop-4, #e879f9)',
            }}
          >
            {track.bpm} BPM
          </span>
        )}

        {track.bit_rate_kbps && (
          <span 
            className="px-2 py-0.5 rounded-md text-[11px] font-bold"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 20%, transparent)',
              color: 'var(--color-stop-3, #f472b6)',
            }}
          >
            {track.bit_rate_kbps} kbps
          </span>
        )}

        {track.sample_rate && (
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[11px]">
            {(track.sample_rate / 1000).toFixed(1)} kHz
          </span>
        )}

        <span>{formatDuration(track.duration_secs)}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          className="p-1 text-zinc-500 hover:text-pink-500 transition-colors"
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowInfo();
          }}
          className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors font-sans text-[11px]"
          title="Song Info"
        >
          Info
        </button>
      </div>
    </div>
  );
};

export const FilterView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  // Dynamic ranges based on library contents
  const { minLibraryBitrate, maxLibraryBitrate } = useMemo(() => {
    let min = 128;
    let max = 6000;
    for (const t of tracks) {
      if (t.bit_rate_kbps && t.bit_rate_kbps > 0) {
        if (t.bit_rate_kbps < min) min = t.bit_rate_kbps;
        if (t.bit_rate_kbps > max) max = t.bit_rate_kbps;
      }
    }
    const roundedMax = Math.max(6000, Math.ceil(max / 500) * 500);
    const roundedMin = Math.min(64, Math.floor(min / 32) * 32);
    return { minLibraryBitrate: roundedMin, maxLibraryBitrate: roundedMax };
  }, [tracks]);

  const { minLibraryYear, maxLibraryYear } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let min = 1950;
    let max = currentYear;
    for (const t of tracks) {
      if (t.year && t.year > 1800 && t.year <= currentYear + 1) {
        if (t.year < min) min = t.year;
        if (t.year > max) max = t.year;
      }
    }
    return { minLibraryYear: Math.min(1950, min), maxLibraryYear: Math.max(currentYear, max) };
  }, [tracks]);

  const { minLibraryBpm, maxLibraryBpm } = useMemo(() => {
    let min = 60;
    let max = 220;
    for (const t of tracks) {
      if (t.bpm && t.bpm > 0) {
        if (t.bpm < min) min = t.bpm;
        if (t.bpm > max) max = t.bpm;
      }
    }
    return { minLibraryBpm: Math.min(40, min), maxLibraryBpm: Math.max(220, Math.ceil(max / 10) * 10) };
  }, [tracks]);

  // Filter States
  const [query, setQuery] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  
  // Multi-select Decades
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);

  // Material 3 Lyrics Filter States
  const [selectedLyricsTypes, setSelectedLyricsTypes] = useState<LyricsFilterType[]>([]);
  const [lyricsMatchMode, setLyricsMatchMode] = useState<'all' | 'any'>('all');
  
  // MUI Range Slider States
  const [yearRange, setYearRange] = useState<[number, number]>([1950, 2026]);
  const [useYearFilter, setUseYearFilter] = useState<boolean>(false);

  const [bitrateRange, setBitrateRange] = useState<[number, number]>([128, 6000]);
  const [useBitrateFilter, setUseBitrateFilter] = useState<boolean>(false);

  // Multi-select Sample Rates
  const [selectedSampleRates, setSelectedSampleRates] = useState<number[]>([]);

  const [keyQuery, setKeyQuery] = useState('');

  const [bpmRange, setBpmRange] = useState<[number, number]>([60, 220]);
  const [useBpmFilter, setUseBpmFilter] = useState<boolean>(false);

  // Keep bitrate range in sync if library has high bitrate tracks and filter is inactive
  useEffect(() => {
    if (!useBitrateFilter && bitrateRange[1] < maxLibraryBitrate) {
      setBitrateRange([minLibraryBitrate, maxLibraryBitrate]);
    }
  }, [maxLibraryBitrate, minLibraryBitrate, useBitrateFilter]);

  const toggleLyricsType = (type: LyricsFilterType) => {
    setSelectedLyricsTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const checkTrackLyrics = (t: Track): boolean => {
    if (selectedLyricsTypes.length === 0) return true;

    const lyrics = t.unsynced_lyrics || '';
    const hasWordSync = isWordSyncedLrc(lyrics);
    const hasSynced = hasLrcTimestamps(lyrics);
    const hasTranslation = hasTranslationInLyrics(lyrics);
    const hasUnsynced = Boolean(lyrics.trim() && !hasSynced);

    const matches: Record<LyricsFilterType, boolean> = {
      translation: hasTranslation,
      wordSynced: hasWordSync,
      synced: hasSynced,
      unsynced: hasUnsynced,
    };

    if (lyricsMatchMode === 'all') {
      return selectedLyricsTypes.every((type) => matches[type]);
    } else {
      return selectedLyricsTypes.some((type) => matches[type]);
    }
  };

  // Dropdown & Modal Popover visibility
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [keySearch, setKeySearch] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playlistNameInput, setPlaylistNameInput] = useState('');
  const [playlistSaved, setPlaylistSaved] = useState(false);

  // Matched IDs from Rust Backend
  const [filteredTrackIds, setFilteredTrackIds] = useState<string[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Extract unique Genres and Keys from current library for dropdowns
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      if (t.genre && t.genre.trim()) {
        set.add(t.genre.trim());
      }
    });
    return Array.from(set).sort();
  }, [tracks]);

  const availableKeys = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      if (t.key && t.key.trim()) {
        set.add(t.key.trim());
      }
    });
    if (set.size === 0) {
      ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Am', 'Em', 'Dm', 'Gm', 'Fm', 'Bm'].forEach((k) => set.add(k));
    }
    return Array.from(set).sort();
  }, [tracks]);

  // Multi-select Decade toggle
  const toggleDecade = (decade: string) => {
    // Uncheck Release Year range filter when decade chips are clicked
    setUseYearFilter(false);
    if (decade === 'all') {
      setSelectedDecades([]);
    } else {
      setSelectedDecades((prev) =>
        prev.includes(decade) ? prev.filter((d) => d !== decade) : [...prev, decade]
      );
    }
  };

  const handleYearFilterChange = (enabled: boolean) => {
    setUseYearFilter(enabled);
    if (enabled) {
      // Uncheck decade chips when Release Year range filter is enabled
      setSelectedDecades([]);
    }
  };


  // Multi-select Sample Rate toggle
  const toggleSampleRate = (sr: number) => {
    if (sr === 0) {
      setSelectedSampleRates([]);
    } else {
      setSelectedSampleRates((prev) =>
        prev.includes(sr) ? prev.filter((r) => r !== sr) : [...prev, sr]
      );
    }
  };

  // Quick lookup map for tracks by ID
  const trackMap = useMemo(() => {
    const map = new Map<string, Track>();
    tracks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tracks]);

  const handleResetFilters = () => {
    setQuery('');
    setArtist('');
    setGenre('');
    setSelectedDecades([]);
    setSelectedLyricsTypes([]);
    setLyricsMatchMode('all');
    setUseYearFilter(false);
    setYearRange([minLibraryYear, maxLibraryYear]);
    setUseBitrateFilter(false);
    setBitrateRange([minLibraryBitrate, maxLibraryBitrate]);
    setSelectedSampleRates([]);
    setKeyQuery('');
    setUseBpmFilter(false);
    setBpmRange([minLibraryBpm, maxLibraryBpm]);
  };

  // Debounced execution of Rust filter command
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(async () => {
      const params = {
        artist: artist.trim() || undefined,
        genre: genre.trim() || undefined,
        min_year: useYearFilter ? yearRange[0] : undefined,
        max_year: useYearFilter ? yearRange[1] : undefined,
        decades: selectedDecades.length > 0 ? selectedDecades : undefined,
        min_bitrate_kbps: useBitrateFilter ? bitrateRange[0] : undefined,
        max_bitrate_kbps: useBitrateFilter ? bitrateRange[1] : undefined,
        sample_rates: selectedSampleRates.length > 0 ? selectedSampleRates : undefined,
        key: keyQuery.trim() || undefined,
        min_bpm: useBpmFilter ? bpmRange[0] : undefined,
        max_bpm: useBpmFilter ? bpmRange[1] : undefined,
        query: query.trim() || undefined,
        lyrics_types: selectedLyricsTypes.length > 0 ? selectedLyricsTypes : undefined,
        lyrics_match_mode: lyricsMatchMode,
      };

      try {
        if (window.__TAURI_INTERNALS__) {
          const matchedIds: string[] = await invoke('filter_tracks', { params });
          const verifiedIds = matchedIds.filter((id) => {
            const t = trackMap.get(id);
            return t ? checkTrackLyrics(t) : false;
          });
          setFilteredTrackIds(verifiedIds);
        } else {
          // Frontend fallback filtering if running outside Tauri
          const matched = tracks.filter((t) => {
            if (!checkTrackLyrics(t)) return false;
            if (artist && !t.artist.toLowerCase().includes(artist.toLowerCase())) return false;
            if (genre && (!t.genre || !t.genre.toLowerCase().includes(genre.toLowerCase()))) return false;
            if (selectedDecades.length > 0) {
              if (!t.year) return false;
              const matchesDecade = selectedDecades.some((d) => {
                if (d === '1970s') return t.year! >= 1970 && t.year! <= 1979;
                if (d === '1980s') return t.year! >= 1980 && t.year! <= 1989;
                if (d === '1990s') return t.year! >= 1990 && t.year! <= 1999;
                if (d === '2000s') return t.year! >= 2000 && t.year! <= 2009;
                if (d === '2010s') return t.year! >= 2010 && t.year! <= 2019;
                if (d === '2020s') return t.year! >= 2020 && t.year! <= 2029;
                return false;
              });
              if (!matchesDecade) return false;
            }
            if (useYearFilter && (!t.year || t.year < yearRange[0] || t.year > yearRange[1])) return false;
            if (useBitrateFilter && (!t.bit_rate_kbps || t.bit_rate_kbps < bitrateRange[0] || t.bit_rate_kbps > bitrateRange[1])) return false;
            if (selectedSampleRates.length > 0 && !selectedSampleRates.includes(t.sample_rate)) return false;
            if (keyQuery && (!t.key || !t.key.toLowerCase().includes(keyQuery.toLowerCase()))) return false;
            if (useBpmFilter && (!t.bpm || t.bpm < bpmRange[0] || t.bpm > bpmRange[1])) return false;
            if (query) {
              const q = query.toLowerCase();
              const inTitle = t.title.toLowerCase().includes(q);
              const inArtist = t.artist.toLowerCase().includes(q);
              const inAlbum = t.album.toLowerCase().includes(q);
              if (!inTitle && !inArtist && !inAlbum) return false;
            }
            return true;
          });
          setFilteredTrackIds(matched.map((t) => t.id));
        }
      } catch (e) {
        console.warn('Rust filter_tracks command error:', e);
      } finally {
        setIsFiltering(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    query,
    artist,
    genre,
    selectedDecades,
    selectedLyricsTypes,
    lyricsMatchMode,
    useYearFilter,
    yearRange,
    useBitrateFilter,
    bitrateRange,
    selectedSampleRates,
    keyQuery,
    useBpmFilter,
    bpmRange,
    tracks,
    trackMap,
  ]);

  // Array of resolved matching Track objects
  const filteredTracks = useMemo(() => {
    return filteredTrackIds.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t));
  }, [filteredTrackIds, trackMap]);

  // Handle Save as New Playlist with custom inline popover
  const handleOpenSaveModal = () => {
    if (filteredTrackIds.length === 0) return;
    let defaultName = 'Filtered Playlist';
    if (artist) defaultName = `${artist} Selection`;
    else if (genre) defaultName = `${genre} Mix`;
    else if (selectedDecades.length > 0) defaultName = `${selectedDecades.join(', ')} Mix`;

    setPlaylistNameInput(defaultName);
    setShowSaveModal(true);
  };

  const handleConfirmSavePlaylist = () => {
    if (!playlistNameInput.trim() || filteredTrackIds.length === 0) return;
    const name = playlistNameInput.trim();
    createPlaylist(name);

    const statePlaylists = usePlayerStore.getState().playlists;
    const createdPl = statePlaylists.find((p) => p.name === name) || statePlaylists[statePlaylists.length - 1];

    if (createdPl) {
      addTracksToPlaylist(createdPl.id, filteredTrackIds);
    }

    setShowSaveModal(false);
    setPlaylistSaved(true);
    setTimeout(() => setPlaylistSaved(false), 3000);
  };

  const handlePlayAll = () => {
    if (filteredTracks.length > 0) {
      playTrack(filteredTracks[0], filteredTracks);
    }
  };

  const parentRef = useRef<HTMLDivElement | null>(null);

  const formatDuration = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <ThemeProvider theme={muiDarkTheme}>
      <div className="w-full h-full flex flex-col gap-4 overflow-hidden text-zinc-100 select-none pb-4">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 glass">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl border shadow-lg shrink-0"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                color: 'var(--color-stop-1, #6366f1)',
              }}
            >
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-wide">Advanced Search & Filter</h2>
              <p className="text-xs text-zinc-400">
                Dynamically filter across {tracks.length} tracks using local tags and instant queries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto relative">
            <button
              onClick={handlePlayAll}
              disabled={filteredTracks.length === 0}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play All ({filteredTracks.length})</span>
            </button>

            <button
              onClick={handleOpenSaveModal}
              disabled={filteredTracks.length === 0}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                playlistSaved
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'
              }`}
            >
              {playlistSaved ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              <span>{playlistSaved ? 'Playlist Saved!' : 'Save as New Playlist'}</span>
            </button>

            <button
              onClick={handleResetFilters}
              className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset All Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Custom Inline Playlist Naming Popover Modal */}
            {showSaveModal && (
              <div
                className="absolute right-0 top-14 z-50 w-80 glass-panel border rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, rgba(255, 255, 255, 0.12))',
                  boxShadow:
                    '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} /> Save Filtered Playlist
                  </span>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Create a playlist containing the current {filteredTracks.length} filtered songs.
                </p>
                <input
                  type="text"
                  value={playlistNameInput}
                  onChange={(e) => setPlaylistNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSavePlaylist();
                    if (e.key === 'Escape') setShowSaveModal(false);
                  }}
                  placeholder="Enter playlist name..."
                  className="w-full bg-zinc-900 border rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, rgba(255, 255, 255, 0.15))',
                  }}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSavePlaylist}
                    disabled={!playlistNameInput.trim()}
                    className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold transition-all disabled:opacity-40 hover:brightness-110 cursor-pointer shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #818cf8))',
                      boxShadow: '0 4px 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                    }}
                  >
                    Save Playlist
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Material 3 Filter Chips & Sliders Panel */}
        <div className="flex flex-col gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 glass shrink-0">
          {/* Row 1: Search Inputs & Modern Custom Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Keyword Search */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-400" /> Search Keyword
              </label>
              <input
                type="text"
                placeholder="Title, Artist, or Album..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Artist Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-purple-400" /> Artist
              </label>
              <input
                type="text"
                placeholder="Artist name..."
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Genre Modern Styled Custom Dropdown */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-pink-400" /> Genre Filter
              </label>
              <button
                onClick={() => {
                  setShowGenreDropdown(!showGenreDropdown);
                  setShowKeyDropdown(false);
                }}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between hover:border-indigo-500/50 transition-colors"
              >
                <span className={genre ? 'text-indigo-300 font-semibold truncate' : 'text-zinc-400'}>
                  {genre || 'Select or search genre...'}
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>

              {/* Genre Dropdown Popover (Visual Fix) */}
              {showGenreDropdown && (
                <div className="absolute left-0 top-16 z-50 w-72 bg-zinc-900 border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    placeholder="Search available genres..."
                    value={genreSearch}
                    onChange={(e) => setGenreSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="max-h-52 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                    <button
                      onClick={() => {
                        setGenre('');
                        setShowGenreDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        !genre ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>All Genres</span>
                      {!genre && <Check className="w-4 h-4" />}
                    </button>
                    {availableGenres
                      .filter((g) => g.toLowerCase().includes(genreSearch.toLowerCase()))
                      .map((g) => {
                        const isSelected = genre.toLowerCase() === g.toLowerCase();
                        return (
                          <button
                            key={g}
                            onClick={() => {
                              setGenre(g);
                              setShowGenreDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between truncate transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'text-zinc-200 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{g}</span>
                            {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Key Modern Styled Custom Dropdown */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Musical Key Tag
              </label>
              <button
                onClick={() => {
                  setShowKeyDropdown(!showKeyDropdown);
                  setShowGenreDropdown(false);
                }}
                className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between hover:border-indigo-500/50 transition-colors"
              >
                <span className={keyQuery ? 'text-amber-300 font-semibold truncate' : 'text-zinc-400'}>
                  {keyQuery || 'Select key tag...'}
                </span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>

              {/* Key Dropdown Popover (Visual Fix) */}
              {showKeyDropdown && (
                <div className="absolute left-0 top-16 z-50 w-64 bg-zinc-900 border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    placeholder="Search key..."
                    value={keySearch}
                    onChange={(e) => setKeySearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-3 gap-1.5 pt-1 pr-1">
                    <button
                      onClick={() => {
                        setKeyQuery('');
                        setShowKeyDropdown(false);
                      }}
                      className={`col-span-3 text-center px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        !keyQuery ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      All Keys
                    </button>
                    {availableKeys
                      .filter((k) => k.toLowerCase().includes(keySearch.toLowerCase()))
                      .map((k) => {
                        const isSelected = keyQuery.toLowerCase() === k.toLowerCase();
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              setKeyQuery(k);
                              setShowKeyDropdown(false);
                            }}
                            className={`text-center px-2 py-1.5 rounded-xl text-xs font-mono transition-colors ${
                              isSelected
                                ? 'bg-amber-500 text-zinc-950 font-bold'
                                : 'text-zinc-200 hover:text-white hover:bg-white/10 border border-white/5'
                            }`}
                          >
                            {k}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Material 3 Filter Chips (Multi-select Decades & Multi-select Sample Rates) */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/5">
            {/* Multi-Select Decade Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Decades:
              </span>
              <button
                onClick={() => toggleDecade('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedDecades.length === 0
                    ? 'text-white shadow-md font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                style={
                  selectedDecades.length === 0
                    ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                    : undefined
                }
              >
                All Eras
              </button>
              {['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'].map((d) => {
                const isSelected = selectedDecades.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDecade(d)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'text-white shadow-md font-bold'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                        : undefined
                    }
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{d}</span>
                  </button>
                );
              })}
            </div>

            {/* Multi-Select Sample Rate Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> Sample Rate:
              </span>
              <button
                onClick={() => toggleSampleRate(0)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedSampleRates.length === 0
                    ? 'text-white shadow-md font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                style={
                  selectedSampleRates.length === 0
                    ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                    : undefined
                }
              >
                All Rates
              </button>
              {[
                { label: '44.1 kHz', value: 44100 },
                { label: '48 kHz', value: 48000 },
                { label: '88.2 kHz', value: 88200 },
                { label: '96 kHz', value: 96000 },
                { label: '192 kHz', value: 192000 },
              ].map((sr) => {
                const isSelected = selectedSampleRates.includes(sr.value);
                return (
                  <button
                    key={sr.value}
                    onClick={() => toggleSampleRate(sr.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'text-white shadow-md font-bold'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                        : undefined
                    }
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{sr.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2.5: Material 3 Lyrics Filter Chips (Independent Multi-select) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} /> Lyrics Types:
              </span>
              
              <button
                type="button"
                onClick={() => setSelectedLyricsTypes([])}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedLyricsTypes.length === 0
                    ? 'text-white shadow-md font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
                style={
                  selectedLyricsTypes.length === 0
                    ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                    : undefined
                }
              >
                All
              </button>

              {[
                { type: 'translation' as const, label: 'Embedded Translation', icon: Languages },
                { type: 'wordSynced' as const, label: 'Word Synced', icon: Sparkles },
                { type: 'synced' as const, label: 'Synced', icon: Clock },
                { type: 'unsynced' as const, label: 'Unsynced', icon: AlignLeft },
              ].map(({ type, label, icon: Icon }) => {
                const isSelected = selectedLyricsTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleLyricsType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'text-white shadow-md font-bold border-transparent'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-white/5'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: 'var(--color-stop-1, #6366f1)',
                            boxShadow: '0 2px 10px color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)',
                          }
                        : undefined
                    }
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5 opacity-70" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Match All / Match Any toggle when multiple lyrics chips are selected */}
            {selectedLyricsTypes.length > 1 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-[11px] text-zinc-400 font-medium">Filter logic:</span>
                <div className="flex items-center p-0.5 rounded-full bg-white/10 border border-white/10 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setLyricsMatchMode('all')}
                    className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                      lyricsMatchMode === 'all'
                        ? 'bg-white/20 text-white font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Match tracks that satisfy all selected lyrics filters"
                  >
                    Match All (AND)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLyricsMatchMode('any')}
                    className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                      lyricsMatchMode === 'any'
                        ? 'bg-white/20 text-white font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Match tracks that satisfy any selected lyrics filter"
                  >
                    Match Any (OR)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Material UI Range Sliders (@mui/material/Slider) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-white/5">
            {/* MUI Range Slider: Release Year */}
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1">
                  <Checkbox
                    checked={useYearFilter}
                    onChange={(e) => handleYearFilterChange(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'var(--color-stop-1, #6366f1)',
                      p: 0.5,
                      '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' },
                    }}
                  />
                  Release Year Range
                </span>
                <span className="font-mono font-bold" style={{ color: 'var(--color-stop-1, #818cf8)' }}>
                  {useYearFilter ? `${yearRange[0]} - ${yearRange[1]}` : 'Any Year'}
                </span>
              </div>
              <div className="px-2 pt-1">
                <Slider
                  value={yearRange}
                  onChange={(_, val) => {
                    setYearRange(val as [number, number]);
                    if (!useYearFilter) handleYearFilterChange(true);
                  }}
                  onPointerDown={() => {
                    if (!useYearFilter) handleYearFilterChange(true);
                  }}
                  valueLabelDisplay="auto"
                  min={minLibraryYear}
                  max={maxLibraryYear}
                  sx={{
                    color: 'var(--color-stop-1, #6366f1)',
                    opacity: useYearFilter ? 1 : 0.6,
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0px 0px 0px 8px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                      },
                    },
                    '& .MuiSlider-rail': {
                      opacity: 0.2,
                    },
                  }}
                />
              </div>
            </div>

            {/* MUI Range Slider: Bitrate (kbps) */}
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1">
                  <Checkbox
                    checked={useBitrateFilter}
                    onChange={(e) => setUseBitrateFilter(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'var(--color-stop-3, #ec4899)',
                      p: 0.5,
                      '&.Mui-checked': { color: 'var(--color-stop-3, #ec4899)' },
                    }}
                  />
                  Bitrate Range (kbps)
                </span>
                <span className="font-mono font-bold" style={{ color: 'var(--color-stop-3, #f472b6)' }}>
                  {useBitrateFilter ? `${bitrateRange[0]} - ${bitrateRange[1]} kbps` : 'Any Bitrate'}
                </span>
              </div>
              <div className="px-2 pt-1">
                <Slider
                  value={bitrateRange}
                  onChange={(_, val) => {
                    setBitrateRange(val as [number, number]);
                    if (!useBitrateFilter) setUseBitrateFilter(true);
                  }}
                  onPointerDown={() => {
                    if (!useBitrateFilter) setUseBitrateFilter(true);
                  }}
                  valueLabelDisplay="auto"
                  min={minLibraryBitrate}
                  max={maxLibraryBitrate}
                  step={maxLibraryBitrate > 6000 ? 64 : 32}
                  sx={{
                    color: 'var(--color-stop-3, #ec4899)',
                    opacity: useBitrateFilter ? 1 : 0.6,
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0px 0px 0px 8px color-mix(in srgb, var(--color-stop-3, #ec4899) 20%, transparent)',
                      },
                    },
                    '& .MuiSlider-rail': {
                      opacity: 0.2,
                    },
                  }}
                />
              </div>
            </div>

            {/* MUI Range Slider: BPM */}
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1">
                  <Checkbox
                    checked={useBpmFilter}
                    onChange={(e) => setUseBpmFilter(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'var(--color-stop-4, #d946ef)',
                      p: 0.5,
                      '&.Mui-checked': { color: 'var(--color-stop-4, #d946ef)' },
                    }}
                  />
                  BPM Tag Range
                </span>
                <span className="font-mono font-bold" style={{ color: 'var(--color-stop-4, #e879f9)' }}>
                  {useBpmFilter ? `${bpmRange[0]} - ${bpmRange[1]} BPM` : 'Any BPM'}
                </span>
              </div>
              <div className="px-2 pt-1">
                <Slider
                  value={bpmRange}
                  onChange={(_, val) => {
                    setBpmRange(val as [number, number]);
                    if (!useBpmFilter) setUseBpmFilter(true);
                  }}
                  onPointerDown={() => {
                    if (!useBpmFilter) setUseBpmFilter(true);
                  }}
                  valueLabelDisplay="auto"
                  min={minLibraryBpm}
                  max={maxLibraryBpm}
                  step={5}
                  sx={{
                    color: 'var(--color-stop-4, #d946ef)',
                    opacity: useBpmFilter ? 1 : 0.6,
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                      '&:hover, &.Mui-focusVisible': {
                        boxShadow: '0px 0px 0px 8px color-mix(in srgb, var(--color-stop-4, #d946ef) 20%, transparent)',
                      },
                    },
                    '& .MuiSlider-rail': {
                      opacity: 0.2,
                    },
                  }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Results Count & Filtering Status */}
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {isFiltering ? (
              <span className="text-indigo-400 animate-pulse">Filtering tracks...</span>
            ) : (
              `Showing ${filteredTracks.length} of ${tracks.length} tracks`
            )}
          </span>
        </div>

        {/* Virtualized Results List with Lazy Loaded Artwork */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl glass p-2 relative"
        >
          {filteredTracks.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-500 py-16">
              <SlidersHorizontal className="w-12 h-12 stroke-1 text-zinc-600" />
              <span className="text-sm font-medium">No tracks match your current filter criteria.</span>
              <button
                onClick={handleResetFilters}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 w-full relative">
              {filteredTracks.slice(0, 150).map((track) => {
                const isPlayingCurrent = currentTrack?.id === track.id;
                const isLiked = likedTrackIds.includes(track.id);

                return (
                  <div key={track.id} className="px-1 relative">
                    <FilterTrackRow
                      track={track}
                      isPlayingCurrent={isPlayingCurrent}
                      isLiked={isLiked}
                      onPlay={() => playTrack(track, filteredTracks)}
                      onToggleLike={() => toggleLikeTrack(track.id)}
                      onShowInfo={() => setInfoModalTrack(track)}
                      formatDuration={formatDuration}
                    />
                  </div>
                );
              })}
              {filteredTracks.length > 150 && (
                <div className="text-center text-xs text-zinc-500 py-2">
                  + {filteredTracks.length - 150} more tracks. Use search to refine.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
};
