import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { usePlayerStore, sanitizeTrackForStorage } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { searchEnhancedLyrics, isWordSyncedLrc, hasLrcTimestamps, isLyricsPlusServiceAvailable, resetLyricsPlusCircuitBreaker } from '../utils/lrclibFetcher';
import { parseRichLyrics, ParsedLyricLine, hasTranslationInLyrics } from '../utils/lyricsParser';
import { createRomanizer, detectScript } from 'lyric-romanizer';
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
  Zap,
  Trash2,
  Globe,
  Languages,
  List,
} from 'lucide-react';

import { enrichLineWithRomanization } from '../utils/japaneseRomanizer';

const romanizer = createRomanizer({ japaneseDictPath: '/dict' });

export interface WordSyncCandidate {
  track: Track;
  lyrics: string;
  status: 'found' | 'embedding' | 'embedded' | 'failed';
  hasWordSync?: boolean;
  hasTranslation?: boolean;
  isSynced?: boolean;
  source?: 'Lyrics+' | 'LRCLIB';
}

export function getCandidateFeatures(c: WordSyncCandidate) {
  const hasWordSync = c.hasWordSync !== undefined ? c.hasWordSync : isWordSyncedLrc(c.lyrics);
  const hasTranslation = c.hasTranslation !== undefined ? c.hasTranslation : hasTranslationInLyrics(c.lyrics);
  const isSynced = c.isSynced !== undefined ? c.isSynced : hasLrcTimestamps(c.lyrics);
  return { hasWordSync, hasTranslation, isSynced, source: c.source || (hasWordSync ? 'Lyrics+' : 'LRCLIB') };
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
  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const isTranslationEnabled = usePlayerStore((s) => s.isTranslationEnabled);
  const translationMode = usePlayerStore((s) => s.translationMode);

  const [onlyMissingWordSync, setOnlyMissingWordSync] = useState(true);
  const [onlyMissingTranslation, setOnlyMissingTranslation] = useState(false);
  const [strictWordSyncOnly, setStrictWordSyncOnly] = useState(false);
  const [lyricsPlusAvailable, setLyricsPlusAvailable] = useState(() => isLyricsPlusServiceAvailable());
  const [scanConcurrency, setScanConcurrency] = useState<number>(4);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
    activeWorkers?: number;
  } | null>(null);

  // Persistence across app sessions
  const [candidates, setCandidates] = useState<WordSyncCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('prism_word_sync_candidates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved candidates:', e);
    }
    return [];
  });

  // Scanned tracks persistence (tracks already searched)
  const [scannedTrackIds, setScannedTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('prism_word_sync_scanned_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  });
  const scannedTrackIdsRef = useRef<Set<string>>(scannedTrackIds);
  useEffect(() => {
    scannedTrackIdsRef.current = scannedTrackIds;
  }, [scannedTrackIds]);

  // Rejected tracks persistence (user dismissed bad translations / syncs)
  const [rejectedTrackIds, setRejectedTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('prism_word_sync_rejected_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  });
  const rejectedTrackIdsRef = useRef<Set<string>>(rejectedTrackIds);
  useEffect(() => {
    rejectedTrackIdsRef.current = rejectedTrackIds;
  }, [rejectedTrackIds]);

  const [activeCandidateIdx, setActiveCandidateIdx] = useState<number>(0);
  const [candidateFilter, setCandidateFilter] = useState<'all' | 'wordsync' | 'translation' | 'synced' | 'pending' | 'embedded'>('all');
  const [showCandidateList, setShowCandidateList] = useState<boolean>(false);
  const [isBatchEmbedding, setIsBatchEmbedding] = useState(false);
  const [batchEmbedProgress, setBatchEmbedProgress] = useState<{ current: number; total: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const activeWorkersCountRef = useRef<number>(0);
  const scanConcurrencyRef = useRef<number>(scanConcurrency);
  const nextTrackIdxRef = useRef<number>(0);
  const targetTracksRef = useRef<Track[]>([]);
  const completedCountRef = useRef<number>(0);

  const lyricsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scanConcurrencyRef.current = scanConcurrency;
  }, [scanConcurrency]);

  // Save candidates on change (strip redundant unsynced_lyrics and artwork from candidate.track to save localStorage space)
  useEffect(() => {
    try {
      const compactCandidates = candidates.map((c) => ({
        ...c,
        track: sanitizeTrackForStorage(c.track) || c.track,
      }));
      localStorage.setItem('prism_word_sync_candidates', JSON.stringify(compactCandidates));
    } catch (e) {
      console.warn('Failed to persist candidates:', e);
    }
  }, [candidates]);

  const isEligibleTrack = useCallback(
    (t: Track) => {
      if (onlyMissingWordSync && onlyMissingTranslation) {
        return !isWordSyncedLrc(t.unsynced_lyrics) || !hasTranslationInLyrics(t.unsynced_lyrics);
      }
      if (onlyMissingWordSync) {
        return !isWordSyncedLrc(t.unsynced_lyrics);
      }
      if (onlyMissingTranslation) {
        return !hasTranslationInLyrics(t.unsynced_lyrics);
      }
      return true;
    },
    [onlyMissingWordSync, onlyMissingTranslation]
  );

  // Unscanned remaining tracks count (for "Continue Search")
  const unscannedRemainingCount = useMemo(() => {
    const candidateIds = new Set(candidates.map((c) => c.track.id));
    return tracks.filter((t) => {
      if (candidateIds.has(t.id)) return false;
      if (scannedTrackIds.has(t.id)) return false;
      if (rejectedTrackIds.has(t.id)) return false;
      return isEligibleTrack(t);
    }).length;
  }, [tracks, scannedTrackIds, candidates, rejectedTrackIds, isEligibleTrack]);

  // Counts for each category
  const wordSyncCount = useMemo(
    () => candidates.filter((c) => (c.hasWordSync !== undefined ? c.hasWordSync : isWordSyncedLrc(c.lyrics))).length,
    [candidates]
  );
  const translationCount = useMemo(
    () => candidates.filter((c) => (c.hasTranslation !== undefined ? c.hasTranslation : hasTranslationInLyrics(c.lyrics))).length,
    [candidates]
  );
  const syncedCount = useMemo(
    () => candidates.filter((c) => (c.isSynced !== undefined ? c.isSynced : hasLrcTimestamps(c.lyrics))).length,
    [candidates]
  );
  const embeddedCount = useMemo(
    () => candidates.filter((c) => c.status === 'embedded').length,
    [candidates]
  );
  const remainingToEmbed = useMemo(
    () => candidates.filter((c) => c.status !== 'embedded').length,
    [candidates]
  );

  // Filtered candidate list based on user filter tab
  const filteredCandidates = useMemo(() => {
    switch (candidateFilter) {
      case 'wordsync':
        return candidates.filter((c) => (c.hasWordSync !== undefined ? c.hasWordSync : isWordSyncedLrc(c.lyrics)));
      case 'translation':
        return candidates.filter((c) => (c.hasTranslation !== undefined ? c.hasTranslation : hasTranslationInLyrics(c.lyrics)));
      case 'synced':
        return candidates.filter((c) => (c.isSynced !== undefined ? c.isSynced : hasLrcTimestamps(c.lyrics)));
      case 'pending':
        return candidates.filter((c) => c.status !== 'embedded');
      case 'embedded':
        return candidates.filter((c) => c.status === 'embedded');
      case 'all':
      default:
        return candidates;
    }
  }, [candidates, candidateFilter]);

  const activeCandidate: WordSyncCandidate | undefined =
    filteredCandidates[activeCandidateIdx] || filteredCandidates[0];

  const activeFeatures = useMemo(
    () => (activeCandidate ? getCandidateFeatures(activeCandidate) : { hasWordSync: false, hasTranslation: false, isSynced: false, source: 'Lyrics+' }),
    [activeCandidate]
  );

  // Enriched lines for preview (with syllables, romanization, and translation)
  const [enrichedLines, setEnrichedLines] = useState<ParsedLyricLine[]>([]);

  useEffect(() => {
    if (!activeCandidate?.lyrics) {
      setEnrichedLines([]);
      return;
    }

    const formatted = parseRichLyrics(activeCandidate.lyrics);
    setEnrichedLines(formatted);

    let isMounted = true;
    async function enrich() {
      let res = formatted;
      if (isRomanizationEnabled) {
        const allContents = res.map((l) => l.content);
        const trackScript = detectScript(allContents);

        res = await Promise.all(
          res.map((line) => enrichLineWithRomanization(line, trackScript, romanizer))
        );
      }
      if (isMounted) {
        setEnrichedLines(res);
      }
    }

    enrich();
    return () => {
      isMounted = false;
    };
  }, [activeCandidate?.lyrics, isRomanizationEnabled]);

  // Is the currently reviewed candidate also the active player track?
  const isCandidatePlayingThis = currentTrack?.id === activeCandidate?.track.id;
  const activeTimeSecs = isCandidatePlayingThis ? currentTime : 0;
  const activeTimeMs = activeTimeSecs * 1000;

  // Pause preview audition if user leaves the lyrics finder while auditioning
  const isAuditioningRef = useRef(false);
  isAuditioningRef.current = Boolean(isCandidatePlayingThis && isPlaying);
  useEffect(() => {
    return () => {
      if (isAuditioningRef.current) {
        usePlayerStore.getState().pause();
      }
    };
  }, []);

  // Active line index and set of overlapping active lines in lyrics preview
  const { activeLineIndex, activeLineIndices } = useMemo(() => {
    if (!isCandidatePlayingThis || enrichedLines.length === 0) {
      return { activeLineIndex: -1, activeLineIndices: new Set<number>() };
    }
    let lastActiveIdx = -1;
    const indices = new Set<number>();
    for (let i = 0; i < enrichedLines.length; i++) {
      const line = enrichedLines[i];
      if (activeTimeSecs >= line.startSecs) {
        lastActiveIdx = i;
      }
      let endSecs = line.startSecs + line.durationSecs;
      if (line.syllables.length > 0) {
        const lastSyl = line.syllables[line.syllables.length - 1];
        endSecs = Math.max(endSecs, (lastSyl.timeMs + lastSyl.durationMs) / 1000);
      }
      if (activeTimeSecs >= line.startSecs && activeTimeSecs < endSecs) {
        indices.add(i);
      }
    }
    if (indices.size === 0 && lastActiveIdx !== -1) {
      indices.add(lastActiveIdx);
    }
    return { activeLineIndex: lastActiveIdx, activeLineIndices: indices };
  }, [isCandidatePlayingThis, enrichedLines, activeTimeSecs]);

  // FIX 1: Auto-scroll lyrics container ONLY (never scrolls entire page)
  useEffect(() => {
    if (activeLineRef.current && lyricsScrollContainerRef.current) {
      const container = lyricsScrollContainerRef.current;
      const lineEl = activeLineRef.current;
      const lineTop = lineEl.offsetTop - container.offsetTop;
      const targetScroll = lineTop - container.clientHeight / 2 + lineEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeLineIndex]);

  // FIX 2: Reset scroll position to top when navigating to another song
  useEffect(() => {
    if (lyricsScrollContainerRef.current) {
      lyricsScrollContainerRef.current.scrollTop = 0;
    }
  }, [activeCandidateIdx]);

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
    if (newIdx < 0 || newIdx >= filteredCandidates.length) return;
    const targetCandidate = filteredCandidates[newIdx];
    const shouldAutoPlay = isPlaying && isCandidatePlayingThis;
    setActiveCandidateIdx(newIdx);
    if (shouldAutoPlay && targetCandidate) {
      playTrack(targetCandidate.track);
    }
  };

  // Embed lyrics for a single candidate and auto-advance
  const handleEmbedCandidate = async (candidateToEmbed?: WordSyncCandidate) => {
    const candidate = candidateToEmbed || activeCandidate;
    if (!candidate || candidate.status === 'embedded') return;

    setCandidates((prev) =>
      prev.map((c) => (c.track.id === candidate.track.id ? { ...c, status: 'embedding' } : c))
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
        prev.map((c) => (c.track.id === candidate.track.id ? { ...c, status: 'embedded' } : c))
      );

      // Auto-advance to next song in filtered list if available
      if (activeCandidateIdx < filteredCandidates.length - 1) {
        handleSelectCandidate(activeCandidateIdx + 1);
      }
    } catch (err) {
      console.error('Failed to embed lyrics:', err);
      setCandidates((prev) =>
        prev.map((c) => (c.track.id === candidate.track.id ? { ...c, status: 'failed' } : c))
      );
    }
  };

  // Embed All Found Candidates (Parallel Worker Pool)
  const handleEmbedAll = async () => {
    const pendingCandidates = candidates.filter((c) => c.status !== 'embedded');
    if (pendingCandidates.length === 0) return;

    setIsBatchEmbedding(true);
    let currentStoreTracks = [...usePlayerStore.getState().tracks];
    const embedConcurrency = 6;
    let nextEmbedIdx = 0;
    let completedEmbeds = 0;

    const embedWorkers = Array.from(
      { length: Math.min(embedConcurrency, pendingCandidates.length) },
      async () => {
        while (nextEmbedIdx < pendingCandidates.length) {
          const idx = nextEmbedIdx++;
          const candidate = pendingCandidates[idx];

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
          } finally {
            completedEmbeds++;
            setBatchEmbedProgress({ current: completedEmbeds, total: pendingCandidates.length });
          }
        }
      }
    );

    await Promise.all(embedWorkers);

    setTracks(currentStoreTracks);
    if (window.__TAURI_INTERNALS__) {
      await invoke('save_library', { tracks: currentStoreTracks }).catch(() => {});
    }

    setIsBatchEmbedding(false);
    setBatchEmbedProgress(null);
  };

  // Reject a candidate track (bad translation or bad sync)
  const handleRejectCandidate = (candidateToReject?: WordSyncCandidate) => {
    const candidate = candidateToReject || activeCandidate;
    if (!candidate) return;

    // Add to rejected IDs
    setRejectedTrackIds((prev) => {
      const updated = new Set(prev);
      updated.add(candidate.track.id);
      rejectedTrackIdsRef.current = updated;
      try {
        localStorage.setItem('prism_word_sync_rejected_ids', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });

    // Remove from candidates list
    setCandidates((prev) => prev.filter((c) => c.track.id !== candidate.track.id));

    // Keep active index in bounds
    if (activeCandidateIdx >= filteredCandidates.length - 1) {
      setActiveCandidateIdx(Math.max(0, filteredCandidates.length - 2));
    }
  };

  const handleResetRejected = () => {
    if (window.confirm(`Reset ${rejectedTrackIds.size} rejected track(s) so they can be discovered again?`)) {
      rejectedTrackIdsRef.current.clear();
      setRejectedTrackIds(new Set());
      try {
        localStorage.removeItem('prism_word_sync_rejected_ids');
      } catch {}
    }
  };

  // Dynamic concurrency adjuster (can be called anytime, even while actively scanning!)
  const handleSetConcurrency = (newCount: number) => {
    setScanConcurrency(newCount);
    scanConcurrencyRef.current = newCount;

    if (isScanningRef.current && !abortControllerRef.current?.signal.aborted) {
      const active = activeWorkersCountRef.current;
      if (newCount > active) {
        const toSpawn = Math.min(newCount - active, Math.max(0, targetTracksRef.current.length - nextTrackIdxRef.current));
        for (let i = 0; i < toSpawn; i++) {
          spawnWorker();
        }
      }
      setScanProgress((prev) =>
        prev ? { ...prev, activeWorkers: Math.min(newCount, targetTracksRef.current.length) } : null
      );
    }
  };

  // Worker loop for dynamic concurrency pool
  const spawnWorker = async () => {
    if (!isScanningRef.current || abortControllerRef.current?.signal.aborted) return;
    activeWorkersCountRef.current++;

    setScanProgress((prev) =>
      prev ? { ...prev, activeWorkers: activeWorkersCountRef.current } : null
    );

    try {
      while (
        nextTrackIdxRef.current < targetTracksRef.current.length &&
        !abortControllerRef.current?.signal.aborted &&
        isScanningRef.current
      ) {
        // If user decreased concurrency, gracefully terminate this worker
        if (activeWorkersCountRef.current > scanConcurrencyRef.current) {
          break;
        }

        const idx = nextTrackIdxRef.current++;
        const track = targetTracksRef.current[idx];
        if (!track) break;

        try {
          const discovered = await searchEnhancedLyrics(
            track.title,
            track.artist,
            track.album,
            track.duration_secs,
            abortControllerRef.current?.signal,
            strictWordSyncOnly
          );

          // Update service availability state
          setLyricsPlusAvailable(isLyricsPlusServiceAvailable());

          // Mark track as scanned
          scannedTrackIdsRef.current.add(track.id);

          if (discovered && discovered.lyrics?.trim()) {
            const trackHasSynced = hasLrcTimestamps(track.unsynced_lyrics);
            const trackHasWordSync = isWordSyncedLrc(track.unsynced_lyrics);
            const trackHasTranslation = hasTranslationInLyrics(track.unsynced_lyrics);

            const isUpgrade =
              (discovered.hasWordSync && !trackHasWordSync) ||
              (discovered.hasTranslation && !trackHasTranslation) ||
              (discovered.isSynced && !trackHasSynced);

            if ((isUpgrade || !onlyMissingWordSync) && !rejectedTrackIdsRef.current.has(track.id)) {
              const candidate: WordSyncCandidate = {
                track,
                lyrics: discovered.lyrics,
                status: 'found',
                hasWordSync: discovered.hasWordSync,
                hasTranslation: discovered.hasTranslation,
                isSynced: discovered.isSynced,
                source: discovered.source,
              };
              setCandidates((prev) => {
                if (prev.some((c) => c.track.id === track.id)) return prev;
                return [...prev, candidate];
              });
            }
          }
        } catch (e) {
          // Skip on glitch
        } finally {
          completedCountRef.current++;
          if (!abortControllerRef.current?.signal.aborted && isScanningRef.current) {
            setScanProgress({
              current: completedCountRef.current,
              total: targetTracksRef.current.length,
              currentTitle: `${track.title} • ${track.artist}`,
              activeWorkers: activeWorkersCountRef.current,
            });
          }
        }

        // Pacing delay
        await new Promise((r) => setTimeout(r, 60));
      }
    } finally {
      activeWorkersCountRef.current--;
      setScanProgress((prev) =>
        prev ? { ...prev, activeWorkers: activeWorkersCountRef.current } : null
      );

      // Persist scanned IDs
      try {
        localStorage.setItem(
          'prism_word_sync_scanned_ids',
          JSON.stringify(Array.from(scannedTrackIdsRef.current))
        );
        setScannedTrackIds(new Set(scannedTrackIdsRef.current));
      } catch {}

      // If all workers finished, finalize scanning state
      if (activeWorkersCountRef.current <= 0 && isScanningRef.current) {
        setIsScanning(false);
        isScanningRef.current = false;
        setScanProgress(null);
        abortControllerRef.current = null;
      }
    }
  };

  const handleStartSearch = async (mode: 'continue' | 'all') => {
    if (isScanning) return;

    let targetTracks: Track[] = [];
    const candidateIds = new Set(candidates.map((c) => c.track.id));

    if (mode === 'all') {
      if (
        candidates.length > 0 &&
        !window.confirm('Rescan all tracks from scratch? This will clear current candidate results.')
      ) {
        return;
      }
      scannedTrackIdsRef.current.clear();
      setScannedTrackIds(new Set());
      try {
        localStorage.removeItem('prism_word_sync_scanned_ids');
      } catch {}

      setCandidates([]);
      setActiveCandidateIdx(0);
      targetTracks = tracks.filter((t) => isEligibleTrack(t));
    } else {
      // mode === 'continue': keep existing candidates and scan remaining tracks
      targetTracks = tracks.filter((t) => {
        if (candidateIds.has(t.id)) return false;
        if (scannedTrackIdsRef.current.has(t.id)) return false;
        if (rejectedTrackIdsRef.current.has(t.id)) return false;
        return isEligibleTrack(t);
      });
    }

    if (targetTracks.length === 0) {
      alert('All eligible library tracks have already been scanned! You can click "Rescan All" to re-verify.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    isScanningRef.current = true;
    setIsScanning(true);

    targetTracksRef.current = targetTracks;
    nextTrackIdxRef.current = 0;
    completedCountRef.current = 0;
    activeWorkersCountRef.current = 0;

    const numWorkers = Math.min(scanConcurrencyRef.current, targetTracks.length);

    setScanProgress({
      current: 0,
      total: targetTracks.length,
      currentTitle: `Starting search with ${numWorkers} worker agent(s)...`,
      activeWorkers: numWorkers,
    });

    for (let i = 0; i < numWorkers; i++) {
      spawnWorker();
    }
  };

  const handlePauseSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isScanningRef.current = false;
    setIsScanning(false);
    setScanProgress(null);

    try {
      localStorage.setItem(
        'prism_word_sync_scanned_ids',
        JSON.stringify(Array.from(scannedTrackIdsRef.current))
      );
      setScannedTrackIds(new Set(scannedTrackIdsRef.current));
    } catch {}
  };


  const handleClearResults = () => {
    if (
      window.confirm(
        'Clear all saved candidates? This will also reset scanned progress so you can scan fresh.'
      )
    ) {
      setCandidates([]);
      setActiveCandidateIdx(0);
      scannedTrackIdsRef.current.clear();
      setScannedTrackIds(new Set());
      try {
        localStorage.removeItem('prism_word_sync_candidates');
        localStorage.removeItem('prism_word_sync_scanned_ids');
      } catch (e) {
        console.warn('Failed to clear candidates from localStorage:', e);
      }
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-5">
      {/* Header & Description */}
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
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
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h3 className="text-base font-bold text-white whitespace-nowrap">
                Word-Synced Lyrics & Translation Finder
              </h3>
              <span
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 15%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 30%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                }}
              >
                LRCLIB & LyricsPlus
              </span>
            </div>
          </div>

          {/* Scan Actions: Continue Search, Pause Search, Rescan All, Clear Results */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isScanning ? (
              <button
                onClick={handlePauseSearch}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-300 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Search</span>
              </button>
            ) : (
              <>
                {/* Continue / Start Search */}
                <button
                  onClick={() => handleStartSearch('continue')}
                  disabled={tracks.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-stop-1, #6366f1), var(--color-stop-2, #8b5cf6))',
                  }}
                  title={
                    candidates.length > 0
                      ? `Keep existing ${candidates.length} candidates and search ${unscannedRemainingCount} remaining tracks`
                      : 'Start scanning library tracks'
                  }
                >
                  <Search className="w-4 h-4" />
                  <span>
                    {candidates.length > 0
                      ? unscannedRemainingCount > 0
                        ? `Continue Search (${unscannedRemainingCount} left)`
                        : 'Scan New Tracks'
                      : `Start Search (${unscannedRemainingCount} tracks)`}
                  </span>
                </button>

                {/* Rescan All Songs from Scratch */}
                <button
                  onClick={() => handleStartSearch('all')}
                  disabled={tracks.length === 0}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  title="Rescan entire library from scratch (re-checks all tracks)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rescan All</span>
                </button>

                {/* Reset Rejected */}
                {rejectedTrackIds.size > 0 && (
                  <button
                    onClick={handleResetRejected}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                    title="Clear rejected songs list so previously dismissed tracks can be discovered again"
                  >
                    <span>Reset Rejected ({rejectedTrackIds.size})</span>
                  </button>
                )}

                {/* Clear Results */}
                {candidates.length > 0 && (
                  <button
                    onClick={handleClearResults}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                    title="Delete saved candidate results and reset scanned progress"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear List</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Description underneath */}
        <p className="text-xs text-zinc-400 pl-0 md:pl-[52px] max-w-3xl leading-relaxed">
          Scan your music library for word-by-word syllable timestamps and dual-language translations. Audition tracks with real-time synchronized karaoke and embed directly into audio tags.
        </p>
      </div>

      {/* Server Status Warning / Circuit Breaker Banner */}
      {!lyricsPlusAvailable && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Lyrics+ Server Offline / Unreachable:</strong> Word-by-word lyrics server is currently not responding. Searches will fall back to LRCLIB (line-synced lyrics), or you can enable <em>Strict Mode</em> below to pause/retry later.
            </span>
          </div>
          <button
            onClick={() => {
              resetLyricsPlusCircuitBreaker();
              setLyricsPlusAvailable(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-100 shrink-0 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Filter Options */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Only scan tracks missing Word-by-Word sync</span>
              <span className="text-[11px] text-zinc-400">
                Skips songs that already have word-by-word syllable timestamps (&lt;mm:ss.xx&gt;)
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

        <div className="border-t border-white/5 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Also scan tracks missing Translations</span>
              <span className="text-[11px] text-zinc-400">
                Include songs missing dual-language translations (uncheck if your songs already have word sync and don't need translations)
              </span>
            </div>
          </div>
          <Checkbox
            checked={onlyMissingTranslation}
            onChange={(e) => setOnlyMissingTranslation(e.target.checked)}
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

        <div className="border-t border-white/5 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Strict Mode: Word-by-Word only</span>
              <span className="text-[11px] text-zinc-400">
                Never accept basic line-synced lyrics from LRCLIB; only import if rich word-sync lyrics are found
              </span>
            </div>
          </div>
          <Checkbox
            checked={strictWordSyncOnly}
            onChange={(e) => setStrictWordSyncOnly(e.target.checked)}
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
      </div>

      {/* Parallel Worker Agents Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 gap-3">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Parallel Worker Agents</span>
            <span className="text-[11px] text-zinc-400">
              Adjust number of concurrent agents anytime — changes take effect immediately even while searching
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
          {[
            { count: 2, label: '2x Gentle' },
            { count: 4, label: '4x Balanced' },
            { count: 6, label: '6x Fast' },
            { count: 8, label: '8x Turbo' },
            { count: 12, label: '12x Max' },
          ].map((opt) => (
            <button
              key={opt.count}
              onClick={() => handleSetConcurrency(opt.count)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                scanConcurrency === opt.count
                  ? 'text-white shadow-md font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              style={
                scanConcurrency === opt.count
                  ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
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
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <span>{scanProgress.activeWorkers ?? scanConcurrency} worker agent(s) active (switch speeds above anytime)</span>
            </span>
            <span style={{ color: 'var(--color-stop-1, #6366f1)' }} className="font-semibold">
              Found {candidates.length} candidate(s)
            </span>
          </div>
        </div>
      )}

      {/* Batch Actions & Summary Bar */}
      {candidates.length > 0 && (
        <div
          className="p-4 rounded-xl border flex flex-col gap-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 12%, transparent)',
            borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <div>
                <span className="text-xs font-bold text-white">
                  {candidates.length} Enhanced Lyrics Discovered
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                  <span className="flex items-center gap-1 font-semibold text-indigo-400">
                    <Zap className="w-3 h-3" />
                    {wordSyncCount} Word-by-Word
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <Globe className="w-3 h-3" />
                    {translationCount} Translated
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-semibold text-sky-400">
                    <Music className="w-3 h-3" />
                    {syncedCount} Synced
                  </span>
                  <span>•</span>
                  <span className="text-zinc-300">
                    {embeddedCount} embedded • {remainingToEmbed} ready to embed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleClearResults}
                disabled={isBatchEmbedding || isScanning}
                className="px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
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

          {/* Filter Tabs & Candidate List Drawer Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setCandidateFilter('all');
                  setActiveCandidateIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'all'
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                All ({candidates.length})
              </button>

              <button
                onClick={() => {
                  setCandidateFilter('wordsync');
                  setActiveCandidateIdx(0);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'wordsync'
                    ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                }`}
              >
                <Zap className="w-3 h-3 text-indigo-400" />
                Word-by-Word ({wordSyncCount})
              </button>

              <button
                onClick={() => {
                  setCandidateFilter('translation');
                  setActiveCandidateIdx(0);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'translation'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                }`}
              >
                <Globe className="w-3 h-3 text-emerald-400" />
                With Translation ({translationCount})
              </button>

              <button
                onClick={() => {
                  setCandidateFilter('synced');
                  setActiveCandidateIdx(0);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'synced'
                    ? 'bg-sky-500/30 text-sky-200 border border-sky-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-sky-300 hover:bg-sky-500/10'
                }`}
              >
                <Music className="w-3 h-3 text-sky-400" />
                Synced ({syncedCount})
              </button>

              <button
                onClick={() => {
                  setCandidateFilter('pending');
                  setActiveCandidateIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'pending'
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                Pending ({remainingToEmbed})
              </button>

              <button
                onClick={() => {
                  setCandidateFilter('embedded');
                  setActiveCandidateIdx(0);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  candidateFilter === 'embedded'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                }`}
              >
                <Check className="w-3 h-3" />
                Embedded ({embeddedCount})
              </button>
            </div>

            <button
              onClick={() => setShowCandidateList((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer ml-auto"
            >
              <List className="w-3.5 h-3.5" />
              <span>{showCandidateList ? 'Hide Candidate List' : `Browse Tracks (${filteredCandidates.length})`}</span>
            </button>
          </div>

          {/* Quick Track Browser Drawer */}
          {showCandidateList && (
            <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-black/60 p-2 flex flex-col gap-1 mt-1">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-500">
                  No candidates match the selected filter.
                </div>
              ) : (
                filteredCandidates.map((c, idx) => {
                  const feats = getCandidateFeatures(c);
                  const isCurrent = idx === activeCandidateIdx;
                  return (
                    <button
                      key={`${c.track.id}-${idx}`}
                      onClick={() => handleSelectCandidate(idx)}
                      className={`flex items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-white/15 text-white border border-white/20'
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 mr-2">
                        <span className="font-mono text-[11px] text-zinc-500 w-6 shrink-0 text-right">
                          {idx + 1}.
                        </span>
                        <span className="text-xs font-medium truncate">
                          {c.track.title}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          • {c.track.artist}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {feats.hasWordSync ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" />
                            Word
                          </span>
                        ) : feats.isSynced ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                            <Music className="w-2.5 h-2.5" />
                            Synced
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 bg-white/5 border border-white/5">
                            Plain
                          </span>
                        )}

                        {feats.hasTranslation && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                            <Globe className="w-2.5 h-2.5" />
                            Trans
                          </span>
                        )}

                        {c.status === 'embedded' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectCandidate(c);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                          title="Reject candidate (dismiss from list)"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* One-by-One Review & Audition Interface */}
      {activeCandidate && (
        <div className="p-5 rounded-2xl border border-white/10 bg-black/40 flex flex-col gap-5">
          {/* Candidate Stepper Navigation */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Candidate</span>
              <span className="font-bold text-white">
                {activeCandidateIdx + 1} of {filteredCandidates.length}
              </span>

              {/* Status Badge */}
              {activeCandidate.status === 'embedded' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Embedded
                </span>
              ) : activeCandidate.status === 'embedding' ? (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 animate-pulse"
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
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                    color: 'var(--color-stop-1, #6366f1)',
                    borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  }}
                >
                  Ready to Embed
                </span>
              )}

              {/* Word-by-Word Badge */}
              {activeFeatures.hasWordSync ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-sm">
                  <Zap className="w-3 h-3 text-indigo-400" />
                  Word-by-Word Sync
                </span>
              ) : activeFeatures.isSynced ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Music className="w-3 h-3 text-sky-400" />
                  Line-Synced
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-white/10 flex items-center gap-1">
                  Plain Lyrics
                </span>
              )}

              {/* Translation Badge */}
              {activeFeatures.hasTranslation && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                  <Globe className="w-3 h-3 text-emerald-400" />
                  Bilingual Translation
                </span>
              )}

              {/* Source Badge */}
              {activeCandidate.source && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-zinc-300 border border-white/10">
                  {activeCandidate.source}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 ml-auto">
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
                disabled={activeCandidateIdx === filteredCandidates.length - 1}
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
                  {/* Feature Badges for This Track */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {activeFeatures.hasWordSync ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Zap className="w-2.5 h-2.5 text-indigo-400" /> Word-Synced
                      </span>
                    ) : activeFeatures.isSynced ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        <Music className="w-2.5 h-2.5 text-sky-400" /> Line-Synced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-white/10">
                        Plain Lyrics
                      </span>
                    )}

                    {activeFeatures.hasTranslation && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Globe className="w-2.5 h-2.5 text-emerald-400" /> Bilingual LRC
                      </span>
                    )}

                    {activeCandidate.source && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-zinc-300 border border-white/10">
                        {activeCandidate.source}
                      </span>
                    )}
                  </div>
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
                  onClick={() => handleEmbedCandidate()}
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
                  onClick={() => handleRejectCandidate(activeCandidate)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all cursor-pointer"
                  title="Reject this candidate (won't appear again in scan results)"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => handleSelectCandidate(activeCandidateIdx + 1)}
                  disabled={activeCandidateIdx === filteredCandidates.length - 1}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Right Column: Live Word-Synced Karaoke Lyrics & Translation Preview */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                    <span>Live Preview</span>
                  </span>
                  {activeFeatures.hasWordSync ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-indigo-400" />
                      Word-by-Word
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-white/10">
                      Line-Synced
                    </span>
                  )}
                  {activeFeatures.hasTranslation && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5 text-emerald-400" />
                      Translation
                    </span>
                  )}
                  {isRomanizationEnabled && (
                    <span title="Romanization Enabled" className="px-1.5 py-0.5 rounded text-[10px] text-zinc-400 bg-white/5 border border-white/10 flex items-center gap-1">
                      <Languages className="w-3 h-3 text-indigo-400" />
                      Rom
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 shrink-0 ml-auto font-medium">
                  Click any line or word to seek audio
                </span>
              </div>

              {/* Scrollable container strictly isolated to prevent page scrolling */}
              <div
                ref={lyricsScrollContainerRef}
                className="h-80 overflow-y-auto custom-scrollbar p-4 rounded-xl bg-black/60 border border-white/10 flex flex-col gap-3.5"
              >
                {enrichedLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 text-xs">
                    No lyrics available to preview
                  </div>
                ) : (
                  enrichedLines.map((line, idx) => {
                    const isLineActive = activeLineIndices.has(idx) || idx === activeLineIndex;
                    const isLinePast = !isLineActive && activeLineIndex >= 0 && idx < activeLineIndex;

                    const showRom = isRomanizationEnabled && Boolean(line.romanized);
                    const showTrans = isTranslationEnabled && Boolean(line.translation);

                    let mainText = line.content;
                    if (showTrans && translationMode === 'replace' && line.translation) {
                      mainText = line.translation;
                    } else if (showRom && romanizationMode === 'replace' && line.romanized) {
                      mainText = line.romanized;
                    }

                    const subRom = showRom && romanizationMode === 'below' ? line.romanized : null;
                    const subTrans = showTrans && translationMode === 'below' ? line.translation : null;

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
                        className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center select-none ${
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
                        {/* Main Syllables with Word-by-Word active highlight */}
                        {line.hasSyllables && isLineActive ? (
                          <div className="w-full flex flex-wrap justify-center items-baseline">
                            {(() => {
                              if (isTranslationEnabled && translationMode === 'replace' && line.translation) {
                                const transWords = line.translation.trim().split(/\s+/).filter(Boolean);
                                const wordDur = line.durationMs / Math.max(1, transWords.length);
                                return transWords.map((word, wIdx) => {
                                  const sylStart = line.timeMs + (wIdx * wordDur);
                                  const sylEnd = sylStart + wordDur;
                                  const isSylActive =
                                    isCandidatePlayingThis &&
                                    activeTimeMs >= sylStart &&
                                    activeTimeMs < sylEnd;
                                  const isSylPast =
                                    isCandidatePlayingThis && activeTimeMs >= sylEnd;

                                  return (
                                    <span
                                      key={`trans-syl-${wIdx}`}
                                      className="inline-block transition-all duration-150 mr-[0.3em]"
                                      style={{
                                        color: isSylActive
                                          ? '#ffffff'
                                          : isSylPast
                                          ? 'rgba(255, 255, 255, 0.95)'
                                          : 'rgba(255, 255, 255, 0.45)',
                                        transform: isSylActive ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
                                        textShadow: isSylActive
                                          ? '0 0 14px rgba(255, 255, 255, 0.6), 0 0 24px var(--color-stop-1, #6366f1)'
                                          : undefined,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                });
                              }

                              return line.syllables.map((syl, sIdx) => {
                                const sylStart = syl.timeMs;
                                const sylEnd = syl.timeMs + syl.durationMs;
                                const isSylActive =
                                  isCandidatePlayingThis &&
                                  activeTimeMs >= sylStart &&
                                  activeTimeMs < sylEnd;
                                const isSylPast =
                                  isCandidatePlayingThis && activeTimeMs >= sylEnd;

                                const sylDisplay =
                                  isRomanizationEnabled && romanizationMode === 'replace' && syl.romanizedText
                                    ? syl.romanizedText
                                    : syl.text;

                                return (
                                  <span
                                    key={`syl-${sIdx}`}
                                    className={`inline-block transition-all duration-150 ${
                                      syl.hasTrailingSpace ? 'mr-[0.3em]' : ''
                                    }`}
                                    style={{
                                      color: isSylActive
                                        ? '#ffffff'
                                        : isSylPast
                                        ? 'rgba(255, 255, 255, 0.95)'
                                        : 'rgba(255, 255, 255, 0.45)',
                                      transform: isSylActive ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
                                      textShadow: isSylActive
                                        ? '0 0 14px rgba(255, 255, 255, 0.6), 0 0 24px var(--color-stop-1, #6366f1)'
                                        : undefined,
                                    }}
                                  >
                                    {sylDisplay}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          <span
                            className="text-sm font-medium"
                            style={isLineActive ? { color: '#ffffff' } : undefined}
                          >
                            {mainText}
                          </span>
                        )}

                        {/* Word-by-Word Romanization Underneath */}
                        {subRom && (
                          line.hasSyllables && isLineActive ? (
                            <div className="w-full flex flex-wrap justify-center items-center gap-1 font-mono mt-1.5 select-none">
                              {line.syllables.map((syl, sIdx) => {
                                const sylStart = syl.timeMs;
                                const sylEnd = syl.timeMs + syl.durationMs;
                                const isSylActive =
                                  isCandidatePlayingThis && activeTimeMs >= sylStart && activeTimeMs < sylEnd;
                                const isSylPast = isCandidatePlayingThis && activeTimeMs >= sylEnd;
                                const romText = syl.romanizedText || syl.text;

                                return (
                                  <span
                                    key={`syl-rom-${sIdx}`}
                                    className={`inline-block transition-all duration-150 ${
                                      syl.hasTrailingSpace ? 'mr-[0.28em]' : ''
                                    }`}
                                    style={{
                                      fontSize: '11px',
                                      color: isSylActive
                                        ? '#ffffff'
                                        : isSylPast
                                        ? 'rgba(255, 255, 255, 0.85)'
                                        : 'rgba(255, 255, 255, 0.45)',
                                      fontWeight: isSylActive ? 700 : 400,
                                      transform: isSylActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                                      textShadow: isSylActive
                                        ? '0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px var(--color-stop-1, #6366f1)'
                                        : undefined,
                                    }}
                                  >
                                    {romText}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              className="w-full flex items-center justify-center font-mono font-normal mt-1.5 text-xs select-none"
                              style={{
                                color: 'rgba(255, 255, 255, 0.6)',
                              }}
                            >
                              <span>{subRom}</span>
                            </div>
                          )
                        )}

                        {/* Word-by-Word Translation Underneath */}
                        {subTrans && (
                          line.hasSyllables && isLineActive ? (
                            <div className="w-full flex flex-wrap justify-center items-center gap-1 font-sans mt-1.5 select-none">
                              {(() => {
                                const transWords = subTrans.trim().split(/\s+/).filter(Boolean);
                                const wordDur = line.durationMs / Math.max(1, transWords.length);
                                return transWords.map((word, wIdx) => {
                                  const sylStart = line.timeMs + (wIdx * wordDur);
                                  const sylEnd = sylStart + wordDur;
                                  const isSylActive =
                                    isCandidatePlayingThis && activeTimeMs >= sylStart && activeTimeMs < sylEnd;
                                  const isSylPast = isCandidatePlayingThis && activeTimeMs >= sylEnd;

                                  return (
                                    <span
                                      key={`syl-trans-${wIdx}`}
                                      className="inline-block transition-all duration-150 mr-[0.28em]"
                                      style={{
                                        fontSize: '11px',
                                        color: isSylActive
                                          ? '#ffffff'
                                          : isSylPast
                                          ? 'rgba(255, 255, 255, 0.85)'
                                          : 'rgba(255, 255, 255, 0.45)',
                                        fontWeight: isSylActive ? 700 : 400,
                                        transform: isSylActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                                        textShadow: isSylActive
                                          ? '0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px var(--color-stop-1, #6366f1)'
                                          : undefined,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          ) : (
                            <div
                              className="w-full flex items-center justify-center font-sans font-normal mt-1.5 text-xs select-none"
                              style={{
                                color: 'rgba(255, 255, 255, 0.6)',
                              }}
                            >
                              <span>{subTrans}</span>
                            </div>
                          )
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
