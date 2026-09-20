import React, { useEffect, useRef, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { usePlayerStore, getEffectiveReplayGain } from './store/usePlayerStore';
import { Track, LibraryChunkResponse } from './types/player';
import { useTrackArt } from './utils/useTrackArt';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TrackList } from './components/TrackList';
import { BottomBar } from './components/BottomBar';
import { LyricsView } from './components/LyricsView';
import { QueueDrawer } from './components/QueueDrawer';
import { invoke } from '@tauri-apps/api/core';
import { logListeningEvent } from './utils/stats';
import { updateLogoGradientFromImage } from './utils/colorExtractor';

// Code-split heavy views & modals for instant initial bundle loading
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const StatsView = lazy(() =>
  import('./components/StatsView').then((m) => ({ default: m.StatsView }))
);
const FilterView = lazy(() =>
  import('./components/FilterView').then((m) => ({ default: m.FilterView }))
);
const SongInfoModal = lazy(() =>
  import('./components/SongInfoModal').then((m) => ({ default: m.SongInfoModal }))
);
const LinkTrackModal = lazy(() =>
  import('./components/LinkTrackModal').then((m) => ({ default: m.LinkTrackModal }))
);
const PlaylistView = lazy(() =>
  import('./components/PlaylistView').then((m) => ({ default: m.PlaylistView }))
);
const AlbumGrid = lazy(() =>
  import('./components/AlbumGrid').then((m) => ({ default: m.AlbumGrid }))
);
const ArtistsGrid = lazy(() =>
  import('./components/ArtistsGrid').then((m) => ({ default: m.ArtistsGrid }))
);
const ArtistView = lazy(() =>
  import('./components/ArtistView').then((m) => ({ default: m.ArtistView }))
);
const AlbumView = lazy(() =>
  import('./components/AlbumView').then((m) => ({ default: m.AlbumView }))
);

const ViewSuspenseFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
    <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mr-2.5" />
    <span>Loading...</span>
  </div>
);

export const App: React.FC = () => {
  // Low-frequency subscriptions
  const tracks = usePlayerStore((s) => s.tracks);
  const setTracks = usePlayerStore((s) => s.setTracks);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const infoModalTrack = usePlayerStore((s) => s.infoModalTrack);
  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);

  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (silentAudioRef.current) {
      if (isPlaying) {
        silentAudioRef.current.play().catch(() => {});
      } else {
        silentAudioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const trackArt = useTrackArt(currentTrack);
  const ambientArt = useTrackArt(currentTrack, { thumbnail: true, maxSize: 128 });

  // Dynamically extract and update theme gradient colors from album art globally across all views
  useEffect(() => {
    updateLogoGradientFromImage(trackArt || ambientArt);
  }, [trackArt, ambientArt]);

  // Centralized hardware, MediaSession, and playback lifecycle hook
  useAudioPlayback({ trackArt: trackArt || ambientArt });

  // Load saved library.json and synchronize saved volume state on startup
  useEffect(() => {
    const initLoad = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const store = usePlayerStore.getState();
          // Instantly sync stored volume level to Rust audio engine on startup
          await invoke('set_volume', { volume: store.volume });

          let savedTracks: Track[] = [];

          try {
            // High-performance chunked library loading for smooth startup with 10,000+ tracks
            const firstChunk: LibraryChunkResponse = await invoke('load_library_chunk', {
              chunkIndex: 0,
              chunkSize: 2500,
            });

            if (firstChunk && firstChunk.tracks && firstChunk.tracks.length > 0) {
              savedTracks = [...firstChunk.tracks];
              setTracks(savedTracks);

              // Stream remaining chunks asynchronously in the background so UI is interactive in <50ms
              if (!firstChunk.is_last && firstChunk.total_chunks > 1) {
                (async () => {
                  let accumulated = [...savedTracks];
                  for (let i = 1; i < firstChunk.total_chunks; i++) {
                    try {
                      const nextChunk: LibraryChunkResponse = await invoke('load_library_chunk', {
                        chunkIndex: i,
                        chunkSize: 2500,
                      });
                      if (nextChunk && nextChunk.tracks && nextChunk.tracks.length > 0) {
                        accumulated = accumulated.concat(nextChunk.tracks);
                        setTracks(accumulated);
                      }
                    } catch (err) {
                      console.warn(`Error streaming library chunk ${i}:`, err);
                    }
                  }
                })();
              }
            } else {
              savedTracks = (await invoke('load_library')) || [];
              if (savedTracks.length > 0) {
                setTracks(savedTracks);
              }
            }
          } catch (e) {
            savedTracks = (await invoke('load_library')) || [];
            if (savedTracks.length > 0) {
              setTracks(savedTracks);
            }
          }

          if (savedTracks.length > 0) {
            // Re-enrich hydrated store tracks with their full metadata (lyrics, replaygain, key, bpm) from disk library
            const trackMap = new Map<string, Track>(savedTracks.map((t: Track) => [t.id, t]));
            const state = usePlayerStore.getState();
            let needsUpdate = false;
            let enrichedCurrentTrack = state.currentTrack;
            if (state.currentTrack) {
              const full = trackMap.get(state.currentTrack.id) || trackMap.get(state.currentTrack.path);
              if (full) {
                enrichedCurrentTrack = {
                  ...state.currentTrack,
                  unsynced_lyrics: full.unsynced_lyrics ?? state.currentTrack.unsynced_lyrics,
                  replay_gain_db: full.replay_gain_db ?? state.currentTrack.replay_gain_db,
                  replay_gain_peak: full.replay_gain_peak ?? state.currentTrack.replay_gain_peak,
                  replay_gain_album_db: full.replay_gain_album_db ?? state.currentTrack.replay_gain_album_db,
                  replay_gain_album_peak: full.replay_gain_album_peak ?? state.currentTrack.replay_gain_album_peak,
                  key: full.key ?? state.currentTrack.key,
                  bpm: full.bpm ?? state.currentTrack.bpm,
                };
                needsUpdate = true;
              }
            }
            const enrichedQueue = state.queue.map((t) => {
              const full = trackMap.get(t.id) || trackMap.get(t.path);
              if (full) {
                needsUpdate = true;
                return {
                  ...t,
                  unsynced_lyrics: full.unsynced_lyrics ?? t.unsynced_lyrics,
                  replay_gain_db: full.replay_gain_db ?? t.replay_gain_db,
                  replay_gain_peak: full.replay_gain_peak ?? t.replay_gain_peak,
                  replay_gain_album_db: full.replay_gain_album_db ?? t.replay_gain_album_db,
                  replay_gain_album_peak: full.replay_gain_album_peak ?? t.replay_gain_album_peak,
                  key: full.key ?? t.key,
                  bpm: full.bpm ?? t.bpm,
                };
              }
              return t;
            });
            if (needsUpdate) {
              usePlayerStore.setState({
                currentTrack: enrichedCurrentTrack,
                queue: enrichedQueue,
              });
            }
          } else {
            const sampleTracks: any = await invoke('scan_sample_folder');
            if (sampleTracks && Array.isArray(sampleTracks) && sampleTracks.length > 0) {
              setTracks(sampleTracks);
            }
          }

          // Compact candidates in localStorage if bloated
          try {
            const rawCandidates = localStorage.getItem('prism_word_sync_candidates');
            if (rawCandidates && rawCandidates.length > 500 * 1024) {
              const parsed = JSON.parse(rawCandidates);
              if (Array.isArray(parsed)) {
                const compacted = parsed.map((c: any) => {
                  if (c.track) {
                    const { unsynced_lyrics, embedded_art_base64, ...rest } = c.track;
                    return { ...c, track: rest };
                  }
                  return c;
                });
                localStorage.setItem('prism_word_sync_candidates', JSON.stringify(compacted));
              }
            }
          } catch {}

          // Restore playback state
          if (store.currentTrack) {
            usePlayerStore.setState({ isPlaying: false });
            await invoke('play_audio', {
              path: store.currentTrack.path,
              replayGainDb: getEffectiveReplayGain(store.currentTrack, store.replayGainMode, savedTracks),
            });
            await invoke('pause_audio');
            if (store.currentTime > 0) {
              await invoke('seek_audio', { positionSecs: store.currentTime });
            }
          }

          if (store.autoCheckUpdates) {
            store.checkAppUpdate(false);
          }

          invoke('get_audio_output_details', { forceRefresh: false }).catch(() => {});
        }
      } catch (e) {
        console.warn('Auto init load notice:', e);
      }
    };
    initLoad();
  }, [setTracks]);

  // Filter tracks based on search query (metadata matches first, lyrics matches at the bottom)
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredTracks = useMemo(() => {
    if (!deferredSearchQuery || !deferredSearchQuery.trim()) {
      if (activeTab === 'liked') return tracks.filter((t) => likedTrackIds.includes(t.id));
      return tracks;
    }
    const q = deferredSearchQuery.trim().toLowerCase();

    const metadataMatches: typeof tracks = [];
    const lyricsOnlyMatches: typeof tracks = [];

    for (const t of tracks) {
      if (activeTab === 'liked' && !likedTrackIds.includes(t.id)) continue;

      const titleMatch = t.title?.toLowerCase().includes(q);
      const artistMatch = t.artist?.toLowerCase().includes(q);
      const albumMatch = t.album?.toLowerCase().includes(q);

      if (titleMatch || artistMatch || albumMatch) {
        metadataMatches.push(t);
      } else if (t.unsynced_lyrics) {
        const cleanLyrics = t.unsynced_lyrics.replace(/\[\d+:\d+(\.\d+)?\]/g, ' ');
        if (cleanLyrics.toLowerCase().includes(q)) {
          lyricsOnlyMatches.push(t);
        }
      }
    }

    return [...metadataMatches, ...lyricsOnlyMatches];
  }, [tracks, deferredSearchQuery, activeTab, likedTrackIds]);

  const listeningMsRef = useRef(0);
  const currentTrackRef = useRef(currentTrack);

  // Accumulate actual listening time when playing
  useEffect(() => {
    let interval: number;
    if (isPlaying && isStatsCollectionEnabled) {
      interval = window.setInterval(() => {
        listeningMsRef.current += 1000;
      }, 1000);
    }
    return () => window.clearInterval(interval);
  }, [isPlaying, isStatsCollectionEnabled]);

  // Log listening event when current track changes if sufficient time was spent
  useEffect(() => {
    if (
      currentTrackRef.current &&
      currentTrackRef.current.id !== currentTrack?.id &&
      isStatsCollectionEnabled
    ) {
      const track = currentTrackRef.current;
      const ms = listeningMsRef.current;
      const threshold = Math.min(30000, (track.duration_secs * 1000) / 2);
      if (ms >= threshold && threshold > 0) {
        logListeningEvent(track.title, track.artist, track.album, track.genre || null, ms);
      }
      listeningMsRef.current = 0;
    }
    currentTrackRef.current = currentTrack;
  }, [currentTrack?.id, isStatsCollectionEnabled]);

  const renderContent = () => {
    if (infoModalTrack) {
      return (
        <Suspense fallback={<ViewSuspenseFallback />}>
          <SongInfoModal />
        </Suspense>
      );
    }
    switch (activeTab) {
      case 'filter':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <FilterView />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <SettingsView />
          </Suspense>
        );
      case 'stats':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <StatsView />
          </Suspense>
        );
      case 'albums':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <AlbumGrid tracks={filteredTracks} />
          </Suspense>
        );
      case 'artists':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <ArtistsGrid tracks={filteredTracks} />
          </Suspense>
        );
      case 'artistView':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <ArtistView />
          </Suspense>
        );
      case 'albumView':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <AlbumView />
          </Suspense>
        );
      case 'playlists':
        return (
          <Suspense fallback={<ViewSuspenseFallback />}>
            <PlaylistView />
          </Suspense>
        );
      case 'lyrics':
        return null;
      default:
        return <TrackList tracks={filteredTracks} />;
    }
  };

  const isLyricsActive = showLyricsFullscreen || activeTab === 'lyrics';

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative">
      {/* Hidden audio element for Windows Taskbar Thumbnail Toolbar & MediaSession sync */}
      <audio
        ref={silentAudioRef}
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        style={{ display: 'none' }}
      />

      {/* Dynamic Ambient Background Glows */}
      {!isLyricsActive && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {ambientArt || trackArt ? (
            <div
              className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-20 blur-[140px] transition-all duration-1000 bg-cover bg-center scale-110"
              style={{ backgroundImage: `url(${ambientArt || trackArt})` }}
            />
          ) : (
            <>
              <div
                className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[140px] opacity-15 pointer-events-none transition-all duration-700"
                style={{
                  background:
                    'radial-gradient(circle, var(--color-stop-1, #6366F1), var(--color-stop-3, #EC4899), transparent 70%)',
                }}
              />
              <div
                className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] opacity-15 pointer-events-none transition-all duration-700"
                style={{
                  background:
                    'radial-gradient(circle, var(--color-stop-4, #D946EF), var(--color-stop-6, #818CF8), transparent 70%)',
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Main App Body Layout (preserved in DOM to maintain scroll offsets) */}
      <div className={`flex flex-1 min-h-0 z-10 ${isLyricsActive ? 'hidden' : ''}`}>
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <div className="flex-1 min-h-0 overflow-hidden px-8 py-2 flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Bottom Audio Player Bar */}
      <div className={`z-20 ${isLyricsActive ? 'hidden' : ''}`}>
        <BottomBar />
      </div>

      {/* Dedicated Lyrics View Page */}
      {isLyricsActive && <LyricsView />}

      {/* Queue Drawer Overlay */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => usePlayerStore.setState({ isQueueOpen: false })}
      />

      {/* Link Track Modal */}
      <Suspense fallback={null}>
        <LinkTrackModal />
      </Suspense>
    </div>
  );
};

export default App;
