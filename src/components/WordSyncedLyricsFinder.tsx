import React, { useState, useRef, useEffect, useMemo } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { searchWordSyncedLyrics, isWordSyncedLrc } from '../utils/lrclibFetcher';
import { parseRichLyrics, ParsedLyricLine } from '../utils/lyricsParser';
import { useTrackArt } from '../utils/useTrackArt';
import { invoke } from '@tauri-apps/api/core';
import {
  Mic2,
  Sparkles,
  Search,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  RefreshCw,
  XCircle,
  Check,
  Music,
  Volume2,
} from 'lucide-react';

export interface WordSyncCandidate {
  track: Track;
  lyrics: string;
  status: 'found' | 'embedding' | 'embedded' | 'failed';
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const CandidateArt: React.FC<{ track: Track }> = ({ track }) => {
  const art = useTrackArt(track, { thumbnail: true, maxSize: 128 });
  if (art) {
    return (
      <img
        src={art}
        alt={track.title}
        className="w-14 h-14 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
      <Music className="w-6 h-6" />
    </div>
  );
};

export const WordSyncedLyricsFinder: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const setTracks = usePlayerStore((s) => s.setTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const seek = usePlayerStore((s) => s.seek);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const [onlyMissingWordSync, setOnlyMissingWordSync] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
  } | null>(null);

  const [candidates, setCandidates] = useState<WordSyncCandidate[]>([]);
  const [activeCandidateIdx, setActiveCandidateIdx] = useState<number>(0);
  const [isBatchEmbedding, setIsBatchEmbedding] = useState(false);
  const [batchEmbedProgress, setBatchEmbedProgress] = useState<{ current: number; total: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lyricsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const activeCandidate: WordSyncCandidate | undefined = candidates[activeCandidateIdx];

  // Parse enhanced LRC lyrics of current active candidate
  const parsedLines: ParsedLyricLine[] = useMemo(() => {
    if (!activeCandidate?.lyrics) return [];
    return parseRichLyrics(activeCandidate.lyrics);
  }, [activeCandidate?.lyrics]);

  // Is the currently reviewed candidate also the active player track?
  const isCandidatePlayingThis = currentTrack?.id === activeCandidate?.track.id;
  const activeTimeSecs = isCandidatePlayingThis ? currentTime : 0;
  const activeTimeMs = activeTimeSecs * 1000;

  // Active line index in lyrics preview
  const activeLineIndex = useMemo(() => {
    if (!isCandidatePlayingThis || parsedLines.length === 0) return -1;
    for (let i = parsedLines.length - 1; i >= 0; i--) {
      if (activeTimeSecs >= parsedLines[i].startSecs) {
        return i;
      }
    }
    return -1;
  }, [isCandidatePlayingThis, parsedLines, activeTimeSecs]);

  // Auto-scroll lyrics container to active line
  useEffect(() => {
    if (activeLineRef.current && lyricsScrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Handle Play/Pause for Candidate
  const handleTogglePlayCandidate = (track: Track) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      playTrack(track);
    }
  };

  // Navigate Candidate (if playing, auto-play next track for audition)
  const handleSelectCandidate = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= candidates.length) return;
    const targetCandidate = candidates[newIdx];
    const shouldAutoPlay = isPlaying && isCandidatePlayingThis;
    setActiveCandidateIdx(newIdx);
    if (shouldAutoPlay && targetCandidate) {
      playTrack(targetCandidate.track);
    }
  };

  // Embed lyrics for a single candidate
  const handleEmbedCandidate = async (index: number) => {
    const candidate = candidates[index];
    if (!candidate || candidate.status === 'embedded') return;

    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'embedding' } : c))
    );

    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('embed_lyrics', {
          path: candidate.track.path,
          lyrics: candidate.lyrics,
        });
      }

      // Update in-memory track library
      const updatedTracks = usePlayerStore
        .getState()
        .tracks.map((t) =>
          t.id === candidate.track.id ? { ...t, unsynced_lyrics: candidate.lyrics } : t
        );
      setTracks(updatedTracks);

      if (window.__TAURI_INTERNALS__) {
        await invoke('save_library', { tracks: updatedTracks }).catch(() => {});
      }

      setCandidates((prev) =>
        prev.map((c, i) => (i === index ? { ...c, status: 'embedded' } : c))
      );
    } catch (err) {
      console.error('Failed to embed lyrics:', err);
      setCandidates((prev) =>
        prev.map((c, i) => (i === index ? { ...c, status: 'failed' } : c))
      );
    }
  };

  // Embed All Found Candidates
  const handleEmbedAll = async () => {
    const pendingCandidates = candidates.filter((c) => c.status !== 'embedded');
    if (pendingCandidates.length === 0) return;

    setIsBatchEmbedding(true);
    let currentStoreTracks = [...usePlayerStore.getState().tracks];

    for (let i = 0; i < pendingCandidates.length; i++) {
      const candidate = pendingCandidates[i];
      setBatchEmbedProgress({ current: i + 1, total: pendingCandidates.length });

      try {
        if (window.__TAURI_INTERNALS__) {
          await invoke('embed_lyrics', {
            path: candidate.track.path,
            lyrics: candidate.lyrics,
          });
        }

        currentStoreTracks = currentStoreTracks.map((t) =>
          t.id === candidate.track.id ? { ...t, unsynced_lyrics: candidate.lyrics } : t
        );

        setCandidates((prev) =>
          prev.map((c) =>
            c.track.id === candidate.track.id ? { ...c, status: 'embedded' } : c
          )
        );
      } catch (e) {
        console.error('Batch embed failed for', candidate.track.title, e);
        setCandidates((prev) =>
          prev.map((c) =>
            c.track.id === candidate.track.id ? { ...c, status: 'failed' } : c
          )
        );
      }
    }

    setTracks(currentStoreTracks);
    if (window.__TAURI_INTERNALS__) {
      await invoke('save_library', { tracks: currentStoreTracks }).catch(() => {});
    }

    setIsBatchEmbedding(false);
    setBatchEmbedProgress(null);
  };

  // Start Searching Library for Word-Synced Lyrics
  const handleStartSearch = async () => {
    if (isScanning) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsScanning(true);

    const targetTracks = onlyMissingWordSync
      ? tracks.filter((t) => !isWordSyncedLrc(t.unsynced_lyrics))
      : [...tracks];

    setScanProgress({
      current: 0,
      total: targetTracks.length,
      currentTitle: 'Initializing scan...',
    });

    const newCandidates: WordSyncCandidate[] = [];

    for (let i = 0; i < targetTracks.length; i++) {
      if (controller.signal.aborted) break;

      const track = targetTracks[i];
      setScanProgress({
        current: i + 1,
        total: targetTracks.length,
        currentTitle: `${track.title} • ${track.artist}`,
      });

      try {
        const foundWordLrc = await searchWordSyncedLyrics(
          track.title,
          track.artist,
          track.album,
          track.duration_secs,
          controller.signal
        );

        if (foundWordLrc && isWordSyncedLrc(foundWordLrc)) {
          const candidate: WordSyncCandidate = {
            track,
            lyrics: foundWordLrc,
            status: 'found',
          };
          newCandidates.push(candidate);
          setCandidates([...newCandidates]);
        }
      } catch (e) {
        // Skip track on network error
      }

      // Small 60ms pause between tracks to prevent API rate-limits and keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    setIsScanning(false);
    setScanProgress(null);
    abortControllerRef.current = null;
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsScanning(false);
    setScanProgress(null);
  };

  const remainingToEmbed = candidates.filter((c) => c.status !== 'embedded').length;
  const embeddedCount = candidates.filter((c) => c.status === 'embedded').length;

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-5">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
            }}
          >
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Word-Synced Lyrics Finder</span>
              <span
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                }}
              >
                LRCLIB & LyricsPlus
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Scan your music library for word-by-word syllable timestamps. Audition tracks one-by-one with live karaoke highlighting or batch embed all found lyrics.
            </p>
          </div>
        </div>

        {/* Scan Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isScanning ? (
            <button
              onClick={handleCancelSearch}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Search</span>
            </button>
          ) : (
            <button
              onClick={handleStartSearch}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #8b5cf6))',
              }}
            >
              <Search className="w-4 h-4" />
              <span>Search Library for Word Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Only scan tracks missing word-synced lyrics</span>
            <span className="text-[11px] text-zinc-400">
              Skips songs that already have word-level syllable timestamps embedded in their audio tags
            </span>
          </div>
        </div>
        <Checkbox
          checked={onlyMissingWordSync}
          onChange={(e) => setOnlyMissingWordSync(e.target.checked)}
          disabled={isScanning}
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

      {/* Live Scanning Progress Bar */}
      {isScanning && scanProgress && (
        <div
          className="p-4 rounded-xl border flex flex-col gap-2.5 animate-in fade-in"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 10%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-white font-medium truncate max-w-[70%]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span className="truncate">{scanProgress.currentTitle}</span>
            </div>
            <span className="font-mono text-zinc-400 shrink-0">
              {scanProgress.current} / {scanProgress.total} (
              {Math.round((scanProgress.current / (scanProgress.total || 1)) * 100)}%)
            </span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round((scanProgress.current / (scanProgress.total || 1)) * 100)}%`,
                background: 'linear-gradient(90deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #8b5cf6))',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Checking LRCLIB and LyricsPlus database...</span>
            <span style={{ color: 'var(--color-stop-1, #6366f1)' }} className="font-semibold">
              Found {candidates.length} candidate(s)
            </span>
          </div>
        </div>
      )}

      {/* Batch Actions & Summary Bar */}
      {candidates.length > 0 && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 12%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
          }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            <div>
              <span className="text-xs font-bold text-white">
                {candidates.length} Word-Synced Tracks Discovered
              </span>
              <p className="text-[11px] text-zinc-400">
                {embeddedCount} embedded • {remainingToEmbed} ready for review or embedding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Clear the discovered candidates list?')) {
                  setCandidates([]);
                  setActiveCandidateIdx(0);
                }
              }}
              disabled={isBatchEmbedding || isScanning}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              Clear List
            </button>

            <button
              onClick={handleEmbedAll}
              disabled={isBatchEmbedding || remainingToEmbed === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              style={{
                backgroundColor: 'var(--color-stop-1, #6366f1)',
              }}
            >
              {isBatchEmbedding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    Embedding {batchEmbedProgress?.current}/{batchEmbedProgress?.total}...
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Embed All Found ({remainingToEmbed})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* One-by-One Review & Audition Interface */}
      {activeCandidate && (
        <div className="p-5 rounded-2xl border border-white/10 bg-black/40 flex flex-col gap-5">
          {/* Candidate Stepper Navigation */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Candidate</span>
              <span className="font-bold text-white">
                {activeCandidateIdx + 1} of {candidates.length}
              </span>
              {activeCandidate.status === 'embedded' ? (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Embedded
                </span>
              ) : activeCandidate.status === 'embedding' ? (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 animate-pulse"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  }}
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Embedding...
                </span>
              ) : (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  }}
                >
                  Ready to Embed
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSelectCandidate(activeCandidateIdx - 1)}
                disabled={activeCandidateIdx === 0}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous Candidate"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleSelectCandidate(activeCandidateIdx + 1)}
                disabled={activeCandidateIdx === candidates.length - 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next Candidate"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Track Info & Mini Player Controls */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Track Info Card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/5">
                <CandidateArt track={activeCandidate.track} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-white truncate" title={activeCandidate.track.title}>
                    {activeCandidate.track.title}
                  </span>
                  <span className="text-xs text-zinc-300 truncate" title={activeCandidate.track.artist}>
                    {activeCandidate.track.artist}
                  </span>
                  <span className="text-[11px] text-zinc-500 truncate" title={activeCandidate.track.album}>
                    {activeCandidate.track.album}
                  </span>
                </div>
              </div>

              {/* Mini Audio Player */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                    Audition Track
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {formatTime(isCandidatePlayingThis ? currentTime : 0)} /{' '}
                    {formatTime(activeCandidate.track.duration_secs || duration)}
                  </span>
                </div>

                {/* Seekbar */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={activeCandidate.track.duration_secs || duration || 100}
                    step={0.1}
                    value={isCandidatePlayingThis ? currentTime : 0}
                    onChange={(e) => {
                      const pos = parseFloat(e.target.value);
                      if (!isCandidatePlayingThis) {
                        playTrack(activeCandidate.track);
                      }
                      seek(pos);
                    }}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer transition-all"
                    style={{
                      accentColor: 'var(--color-stop-1, #6366f1)',
                    }}
                  />
                </div>

                {/* Player Controls & Quick Jumps */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (isCandidatePlayingThis) {
                          seek(Math.max(0, currentTime - 5));
                        }
                      }}
                      disabled={!isCandidatePlayingThis}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
                      title="Rewind 5 seconds"
                    >
                      -5s
                    </button>
                    <button
                      onClick={() => {
                        if (isCandidatePlayingThis) {
                          seek(currentTime + 5);
                        }
                      }}
                      disabled={!isCandidatePlayingThis}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
                      title="Forward 5 seconds"
                    >
                      +5s
                    </button>
                  </div>

                  <button
                    onClick={() => handleTogglePlayCandidate(activeCandidate.track)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-stop-1, #6366f1)',
                    }}
                  >
                    {isCandidatePlayingThis && isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-white" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Play Preview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Embed or Skip */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleEmbedCandidate(activeCandidateIdx)}
                  disabled={activeCandidate.status === 'embedded' || activeCandidate.status === 'embedding'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:brightness-110 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor:
                      activeCandidate.status === 'embedded'
                        ? '#10b981'
                        : 'var(--color-stop-1, #6366f1)',
                  }}
                >
                  {activeCandidate.status === 'embedded' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Embedded in File</span>
                    </>
                  ) : activeCandidate.status === 'embedding' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Embedding...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Embed Lyrics into File</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleSelectCandidate(activeCandidateIdx + 1)}
                  disabled={activeCandidateIdx === candidates.length - 1}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Right Column: Live Word-Synced Karaoke Lyrics Preview */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  Live Word-by-Word Preview
                </span>
                <span className="text-[11px] text-zinc-500">
                  Click any line or word to seek audio
                </span>
              </div>

              <div
                ref={lyricsScrollContainerRef}
                className="h-80 overflow-y-auto custom-scrollbar p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col gap-3.5"
              >
                {parsedLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 text-xs">
                    No lyrics available to preview
                  </div>
                ) : (
                  parsedLines.map((line, idx) => {
                    const isLineActive = idx === activeLineIndex;
                    const isLinePast = activeLineIndex >= 0 && idx < activeLineIndex;

                    return (
                      <div
                        key={`line-${idx}`}
                        ref={isLineActive ? activeLineRef : null}
                        onClick={() => {
                          if (!isCandidatePlayingThis) {
                            playTrack(activeCandidate.track);
                          }
                          seek(line.startSecs);
                        }}
                        className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-center select-none ${
                          isLineActive
                            ? 'font-bold scale-[1.02] shadow-lg border'
                            : isLinePast
                            ? 'text-zinc-300 opacity-80'
                            : 'text-zinc-500 hover:text-zinc-300 opacity-60'
                        }`}
                        style={{
                          backgroundColor: isLineActive
                            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 16%, transparent)'
                            : undefined,
                          borderColor: isLineActive
                            ? 'color-mix(in srgb, var(--color-stop-1, #6366f1) 35%, transparent)'
                            : undefined,
                        }}
                      >
                        {line.hasSyllables && isLineActive ? (
                          <div className="inline-flex flex-wrap justify-center items-baseline">
                            {line.syllables.map((syl, sIdx) => {
                              const sylStart = syl.timeMs;
                              const sylEnd = syl.timeMs + syl.durationMs;
                              const isSylActive =
                                isCandidatePlayingThis &&
                                activeTimeMs >= sylStart &&
                                activeTimeMs < sylEnd;
                              const isSylPast =
                                isCandidatePlayingThis && activeTimeMs >= sylEnd;

                              return (
                                <span
                                  key={`syl-${sIdx}`}
                                  className={`inline-block transition-all duration-150 ${
                                    syl.hasTrailingSpace ? 'mr-[0.3em]' : ''
                                  }`}
                                  style={{
                                    color: isSylActive
                                      ? 'var(--color-stop-1, #6366f1)'
                                      : isSylPast
                                      ? '#ffffff'
                                      : 'rgba(255, 255, 255, 0.45)',
                                    transform: isSylActive ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
                                    textShadow: isSylActive
                                      ? '0 0 14px var(--color-stop-1, #6366f1), 0 0 24px var(--color-stop-2, #8b5cf6)'
                                      : undefined,
                                  }}
                                >
                                  {syl.text}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span
                            className="text-sm font-medium"
                            style={isLineActive ? { color: 'var(--color-stop-1, #6366f1)' } : undefined}
                          >
                            {line.content}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
