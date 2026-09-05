import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import { useTrackArt } from './utils/useTrackArt';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TrackList } from './components/TrackList';
import { AlbumGrid } from './components/AlbumGrid';
import { ArtistsGrid } from './components/ArtistsGrid';
import { ArtistView } from './components/ArtistView';
import { AlbumView } from './components/AlbumView';
import { SettingsView } from './components/SettingsView';
import { PlaylistView } from './components/PlaylistView';
import { BottomBar } from './components/BottomBar';
import { LyricsView } from './components/LyricsView';
import { QueueDrawer } from './components/QueueDrawer';
import { SongInfoModal } from './components/SongInfoModal';
import { FilterView } from './components/FilterView';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { logListeningEvent } from './utils/stats';
import { StatsView } from './components/StatsView';

export const App: React.FC = () => {
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

  const trackArt = useTrackArt(currentTrack);
  const ambientArt = useTrackArt(currentTrack, { thumbnail: true, maxSize: 128 });

  // Sync MediaSession metadata & action handlers for Windows System Media Transport Controls (SMTC)
  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      if (currentTrack) {
        invoke('update_media_controls_metadata', {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || '',
          durationSecs: currentTrack.duration_secs || null,
        }).catch(() => {});
      }
      invoke('update_media_controls_playback', { isPlaying }).catch(() => {});
    }

    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || '',
        artwork: trackArt ? [{ src: trackArt, sizes: '512x512', type: 'image/png' }] : [],
      });
    } else {
      navigator.mediaSession.metadata = null;
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying, trackArt]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => usePlayerStore.getState().resume()],
      ['pause', () => usePlayerStore.getState().pause()],
      ['previoustrack', () => usePlayerStore.getState().previousTrack()],
      ['nexttrack', () => usePlayerStore.getState().nextTrack()],
      ['seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          usePlayerStore.getState().seek(details.seekTime);
        }
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        // Action not supported
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (e) {
          // Ignored
        }
      }
    };
  }, []);

  // Global hardware & keyboard media shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        usePlayerStore.getState().togglePlay();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    const handleGlobalDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    
    // Tauri/WebView2 global drag interception fix
    window.addEventListener('dragover', handleGlobalDrag, false);
    window.addEventListener('drop', handleGlobalDrag, false);

    let unlisten: (() => void) | undefined;
    if (window.__TAURI_INTERNALS__) {
      listen<string>('media-control', (event) => {
        const store = usePlayerStore.getState();
        switch (event.payload) {
          case 'play':
            store.resume();
            break;
          case 'pause':
            if (store.isPlaying) {
              store.pause();
            } else {
              store.resume();
            }
            break;
          case 'toggle':
            store.togglePlay();
            break;
          case 'next':
            store.nextTrack();
            break;
          case 'previous':
            store.previousTrack();
            break;
        }
      }).then((unlistenFn) => {
        unlisten = unlistenFn;
      });
    }

    // Global active scroll detection for auto-hiding scrollbar pills
    let scrollTimeout: any;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.classList) {
        target.classList.add('is-scrolling');
        const grid = target.closest('revo-grid');
        if (grid) grid.classList.add('is-scrolling');
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          target.classList.remove('is-scrolling');
          if (grid) grid.classList.remove('is-scrolling');
        }, 1000);
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('dragover', handleGlobalDrag, false);
      window.removeEventListener('drop', handleGlobalDrag, false);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      clearTimeout(scrollTimeout);
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Load saved library.json and synchronize saved volume state on startup
  useEffect(() => {
    const initLoad = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const store = usePlayerStore.getState();
          // Instantly sync stored volume level to Rust audio engine on startup
          await invoke('set_volume', { volume: store.volume });

          const savedTracks: any = await invoke('load_library');
          if (savedTracks && Array.isArray(savedTracks) && savedTracks.length > 0) {
            setTracks(savedTracks);
          } else {
            const sampleTracks: any = await invoke('scan_sample_folder');
            if (sampleTracks && Array.isArray(sampleTracks) && sampleTracks.length > 0) {
              setTracks(sampleTracks);
            }
          }
          
          // Restore playback state
          if (store.currentTrack) {
            // Force pause state on startup for safety
            usePlayerStore.setState({ isPlaying: false });
            // Pre-load track in rust backend and seek to saved time
            await invoke('play_audio', { 
              path: store.currentTrack.path, 
              replayGainDb: store.currentTrack.replay_gain_db || 0 
            });
            await invoke('pause_audio');
            if (store.currentTime > 0) {
              await invoke('seek_audio', { positionSecs: store.currentTime });
            }
          }

          // Check for app updates if enabled
          if (store.autoCheckUpdates) {
            store.checkAppUpdate(false);
          }

          // Pre-warm audio devices cache in background
          invoke('get_audio_output_details', { forceRefresh: false }).catch(() => {});
        }
      } catch (e) {
        console.warn('Auto init load notice:', e);
      }
    };
    initLoad();
  }, []);

  // Filter tracks based on search query
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      !deferredSearchQuery ||
      t.title.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(deferredSearchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'liked') {
      return likedTrackIds.includes(t.id);
    }
    return true;
  });

  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  
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
    if (currentTrackRef.current && currentTrackRef.current.id !== currentTrack?.id && isStatsCollectionEnabled) {
      const track = currentTrackRef.current;
      const ms = listeningMsRef.current;
      // Log if listened for > 30s or > 50% of the song duration
      const threshold = Math.min(30000, (track.duration_secs * 1000) / 2);
      if (ms >= threshold && threshold > 0) {
        logListeningEvent(
          track.title,
          track.artist,
          track.album,
          track.genre || null,
          ms
        );
      }
      listeningMsRef.current = 0;
    }
    currentTrackRef.current = currentTrack;
  }, [currentTrack?.id, isStatsCollectionEnabled]);

  const renderContent = () => {
    if (infoModalTrack) {
      return <SongInfoModal />;
    }
    switch (activeTab) {
      case 'filter':
        return <FilterView />;
      case 'settings':
        return <SettingsView />;
      case 'stats':
        return <StatsView />;
      case 'albums':
        return <AlbumGrid tracks={filteredTracks} />;
      case 'artists':
        return <ArtistsGrid tracks={filteredTracks} />;
      case 'artistView':
        return <ArtistView />;
      case 'albumView':
        return <AlbumView />;
      case 'playlists':
        return <PlaylistView />;
      default:
        return <TrackList tracks={filteredTracks} />;
    }

  };

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Ambient Glassmorphism Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {(ambientArt || trackArt) ? (
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-20 blur-[140px] transition-all duration-1000 bg-cover bg-center scale-110"
            style={{ backgroundImage: `url(${ambientArt || trackArt})` }}
          />
        ) : (
          <>
            <div 
              className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[140px] opacity-15 pointer-events-none transition-all duration-700"
              style={{
                background: 'radial-gradient(circle, var(--color-stop-1, #6366F1), var(--color-stop-3, #EC4899), transparent 70%)'
              }}
            />
            <div 
              className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] opacity-15 pointer-events-none transition-all duration-700"
              style={{
                background: 'radial-gradient(circle, var(--color-stop-4, #D946EF), var(--color-stop-6, #818CF8), transparent 70%)'
              }}
            />
          </>
        )}
      </div>

      {/* Main App Body Layout */}
      <div className="flex flex-1 min-h-0 z-10">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <div className="flex-1 min-h-0 overflow-hidden px-8 py-2 flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Bottom Audio Player Bar */}
      <div className="z-20">
        <BottomBar />
      </div>

      {/* Fullscreen Karaoke / Lyrics View Overlay */}
      {(showLyricsFullscreen || activeTab === 'lyrics') && <LyricsView />}

      {/* Queue Drawer Overlay */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => usePlayerStore.setState({ isQueueOpen: false })}
      />

    </div>
  );
};

export default App;
