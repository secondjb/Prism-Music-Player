import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { useVirtualizer } from '@tanstack/react-virtual';
import { invoke } from '@tauri-apps/api/core';
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
} from 'lucide-react';


export const FilterView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);

  // Filter States
  const [query, setQuery] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [minYear, setMinYear] = useState<number>(1950);
  const [maxYear, setMaxYear] = useState<number>(2026);
  const [useYearFilter, setUseYearFilter] = useState<boolean>(false);

  const [minBitrate, setMinBitrate] = useState<number>(128);
  const [maxBitrate, setMaxBitrate] = useState<number>(2000);
  const [useBitrateFilter, setUseBitrateFilter] = useState<boolean>(false);

  const [sampleRate, setSampleRate] = useState<string>('all');

  const [keyQuery, setKeyQuery] = useState('');

  const [minBpm, setMinBpm] = useState<number>(60);
  const [maxBpm, setMaxBpm] = useState<number>(200);
  const [useBpmFilter, setUseBpmFilter] = useState<boolean>(false);

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

  // Handle Decade selection
  const handleDecadeSelect = (decade: string) => {
    setSelectedDecade(decade);
    if (decade === 'all') {
      setUseYearFilter(false);
    } else {
      setUseYearFilter(true);
      if (decade === '1970s') { setMinYear(1970); setMaxYear(1979); }
      else if (decade === '1980s') { setMinYear(1980); setMaxYear(1989); }
      else if (decade === '1990s') { setMinYear(1990); setMaxYear(1999); }
      else if (decade === '2000s') { setMinYear(2000); setMaxYear(2009); }
      else if (decade === '2010s') { setMinYear(2010); setMaxYear(2019); }
      else if (decade === '2020s') { setMinYear(2020); setMaxYear(2026); }
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setArtist('');
    setGenre('');
    setSelectedDecade('all');
    setUseYearFilter(false);
    setMinYear(1950);
    setMaxYear(2026);
    setUseBitrateFilter(false);
    setMinBitrate(128);
    setMaxBitrate(2000);
    setSampleRate('all');
    setKeyQuery('');
    setUseBpmFilter(false);
    setMinBpm(60);
    setMaxBpm(200);
  };

  // Debounced execution of Rust filter command
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(async () => {
      const sr = sampleRate !== 'all' ? parseInt(sampleRate, 10) : undefined;

      const params = {
        artist: artist.trim() || undefined,
        genre: genre.trim() || undefined,
        min_year: useYearFilter ? minYear : undefined,
        max_year: useYearFilter ? maxYear : undefined,
        min_bitrate_kbps: useBitrateFilter ? minBitrate : undefined,
        max_bitrate_kbps: useBitrateFilter ? maxBitrate : undefined,
        sample_rate: sr && !isNaN(sr) ? sr : undefined,
        key: keyQuery.trim() || undefined,
        min_bpm: useBpmFilter ? minBpm : undefined,
        max_bpm: useBpmFilter ? maxBpm : undefined,
        query: query.trim() || undefined,
      };

      try {
        if (window.__TAURI_INTERNALS__) {
          const matchedIds: string[] = await invoke('filter_tracks', { params });
          setFilteredTrackIds(matchedIds);
        } else {
          // Frontend fallback filtering if running outside Tauri
          const matched = tracks.filter((t) => {
            if (artist && !t.artist.toLowerCase().includes(artist.toLowerCase())) return false;
            if (genre && (!t.genre || !t.genre.toLowerCase().includes(genre.toLowerCase()))) return false;
            if (useYearFilter && (!t.year || t.year < minYear || t.year > maxYear)) return false;
            if (useBitrateFilter && (!t.bit_rate_kbps || t.bit_rate_kbps < minBitrate || t.bit_rate_kbps > maxBitrate)) return false;
            if (sr && t.sample_rate !== sr) return false;
            if (keyQuery && (!t.key || !t.key.toLowerCase().includes(keyQuery.toLowerCase()))) return false;
            if (useBpmFilter && (!t.bpm || t.bpm < minBpm || t.bpm > maxBpm)) return false;
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
    useYearFilter,
    minYear,
    maxYear,
    useBitrateFilter,
    minBitrate,
    maxBitrate,
    sampleRate,
    keyQuery,
    useBpmFilter,
    minBpm,
    maxBpm,
    tracks,
  ]);

  // Quick lookup map for tracks by ID
  const trackMap = useMemo(() => {
    const map = new Map<string, Track>();
    tracks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tracks]);

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
    else if (useYearFilter) defaultName = `${minYear}-${maxYear} Selection`;

    setPlaylistNameInput(defaultName);
    setShowSaveModal(true);
  };

  const handleConfirmSavePlaylist = () => {
    if (!playlistNameInput.trim() || filteredTrackIds.length === 0) return;
    createPlaylist(playlistNameInput.trim());

    const statePlaylists = usePlayerStore.getState().playlists;
    const createdPl = statePlaylists.find((p) => p.name === playlistNameInput.trim()) || statePlaylists[statePlaylists.length - 1];

    if (createdPl) {
      filteredTrackIds.forEach((trackId) => {
        addTrackToPlaylist(createdPl.id, trackId);
      });
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

  // Virtualizer setup for 60 FPS performance on 1000+ tracks
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const formatDuration = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-hidden text-zinc-100 select-none">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 glass">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-950/30">
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
            className="flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 cursor-pointer"
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
            <div className="absolute right-0 top-14 z-50 w-80 glass-panel border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-400" /> Save Filtered Playlist
                </span>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
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
                }}
                placeholder="Enter playlist name..."
                className="w-full bg-zinc-900 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSavePlaylist}
                  disabled={!playlistNameInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
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

          {/* Genre Modern Custom Dropdown */}
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
              <span className={genre ? 'text-indigo-300 font-semibold truncate' : 'text-zinc-500'}>
                {genre || 'Select or search genre...'}
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>

            {/* Genre Dropdown Popover */}
            {showGenreDropdown && (
              <div className="absolute left-0 top-16 z-50 w-72 glass-panel border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                <input
                  type="text"
                  placeholder="Search available genres..."
                  value={genreSearch}
                  onChange={(e) => setGenreSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1 pt-1">
                  <button
                    onClick={() => {
                      setGenre('');
                      setShowGenreDropdown(false);
                    }}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      !genre ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    All Genres
                  </button>
                  {availableGenres
                    .filter((g) => g.toLowerCase().includes(genreSearch.toLowerCase()))
                    .map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          setGenre(g);
                          setShowGenreDropdown(false);
                        }}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors ${
                          genre.toLowerCase() === g.toLowerCase()
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Key Modern Custom Dropdown */}
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
              <span className={keyQuery ? 'text-amber-300 font-semibold truncate' : 'text-zinc-500'}>
                {keyQuery || 'Select key tag...'}
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </button>

            {/* Key Dropdown Popover */}
            {showKeyDropdown && (
              <div className="absolute left-0 top-16 z-50 w-64 glass-panel border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                <input
                  type="text"
                  placeholder="Search key..."
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <div className="max-h-44 overflow-y-auto custom-scrollbar grid grid-cols-3 gap-1 pt-1">
                  <button
                    onClick={() => {
                      setKeyQuery('');
                      setShowKeyDropdown(false);
                    }}
                    className={`col-span-3 text-center px-2 py-1 rounded-lg text-xs transition-colors ${
                      !keyQuery ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    All Keys
                  </button>
                  {availableKeys
                    .filter((k) => k.toLowerCase().includes(keySearch.toLowerCase()))
                    .map((k) => (
                      <button
                        key={k}
                        onClick={() => {
                          setKeyQuery(k);
                          setShowKeyDropdown(false);
                        }}
                        className={`text-center px-2 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          keyQuery.toLowerCase() === k.toLowerCase()
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Material 3 Filter Chips (Decades, Bitrate, Sample Rate) */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/5">
          {/* Decade Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Decade:
            </span>
            {['all', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'].map((d) => (
              <button
                key={d}
                onClick={() => handleDecadeSelect(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  selectedDecade === d
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {d === 'all' ? 'All Eras' : d}
              </button>
            ))}
          </div>

          {/* Sample Rate Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Hz:
            </span>
            {[
              { label: 'All Rates', value: 'all' },
              { label: '44.1 kHz', value: '44100' },
              { label: '48 kHz', value: '48000' },
              { label: '96 kHz', value: '96000' },
              { label: '192 kHz', value: '192000' },
            ].map((sr) => (
              <button
                key={sr.value}
                onClick={() => setSampleRate(sr.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  sampleRate === sr.value
                    ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {sr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Material 3 Styled Discrete Range Sliders (Year, Bitrate, BPM) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
          {/* Discrete Range Slider: Release Year */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={useYearFilter}
                  onChange={(e) => setUseYearFilter(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                />
                Release Year Range
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {useYearFilter ? `${minYear} - ${maxYear}` : 'Any Year'}
              </span>
            </div>
            {useYearFilter && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1950}
                  max={maxYear}
                  step={1}
                  value={minYear}
                  onChange={(e) => setMinYear(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
                <input
                  type="range"
                  min={minYear}
                  max={2026}
                  step={1}
                  value={maxYear}
                  onChange={(e) => setMaxYear(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
              </div>
            )}
          </div>

          {/* Discrete Range Slider: Bitrate (kbps) */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={useBitrateFilter}
                  onChange={(e) => setUseBitrateFilter(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                />
                Bitrate Range (kbps)
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {useBitrateFilter ? `${minBitrate} - ${maxBitrate} kbps` : 'Any Bitrate'}
              </span>
            </div>
            {useBitrateFilter && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={128}
                  max={maxBitrate}
                  step={32}
                  value={minBitrate}
                  onChange={(e) => setMinBitrate(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
                <input
                  type="range"
                  min={minBitrate}
                  max={2000}
                  step={32}
                  value={maxBitrate}
                  onChange={(e) => setMaxBitrate(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
              </div>
            )}
          </div>

          {/* Discrete Range Slider: BPM */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={useBpmFilter}
                  onChange={(e) => setUseBpmFilter(e.target.checked)}
                  className="w-3.5 h-3.5 accent-purple-500 rounded cursor-pointer"
                />

                BPM Tag Range
              </span>
              <span className="font-mono text-purple-400 font-bold">
                {useBpmFilter ? `${minBpm} - ${maxBpm} BPM` : 'Any BPM'}
              </span>
            </div>
            {useBpmFilter && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={40}
                  max={maxBpm}
                  step={5}
                  value={minBpm}
                  onChange={(e) => setMinBpm(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
                <input
                  type="range"
                  min={minBpm}
                  max={220}
                  step={5}
                  value={maxBpm}
                  onChange={(e) => setMaxBpm(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
              </div>
            )}
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

      {/* Virtualized Results List */}
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
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const track = filteredTracks[virtualRow.index];
              const isPlayingCurrent = currentTrack?.id === track.id;
              const isLiked = likedTrackIds.includes(track.id);

              return (
                <div
                  key={track.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-1"
                >
                  <div
                    onDoubleClick={() => playTrack(track, filteredTracks)}
                    className={`flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-150 group cursor-pointer border ${
                      isPlayingCurrent
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
                        : 'hover:bg-white/10 border-transparent text-zinc-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        onClick={() => playTrack(track, filteredTracks)}
                        className="w-8 h-8 rounded-lg bg-indigo-600/30 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-sm truncate text-white">{track.title}</span>
                        <span className="text-xs text-zinc-400 truncate">
                          {track.artist} {track.album ? `• ${track.album}` : ''}
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
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/5 text-[11px]">
                          {track.year}
                        </span>
                      )}

                      {track.key && (
                        <span className="hidden md:inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                          {track.key}
                        </span>
                      )}

                      {track.bpm && (
                        <span className="hidden lg:inline-block px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[11px]">
                          {track.bpm} BPM
                        </span>
                      )}

                      {track.bit_rate_kbps && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[11px] font-bold">
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
                          toggleLikeTrack(track.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-pink-500 transition-colors"
                      >
                        <Heart
                          className={`w-4 h-4 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`}
                        />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoModalTrack(track);
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors font-sans text-[11px]"
                        title="Song Info"
                      >
                        Info
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
