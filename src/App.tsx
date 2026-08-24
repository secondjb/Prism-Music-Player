import React, { useEffect } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TrackList } from './components/TrackList';
import { AlbumGrid } from './components/AlbumGrid';
import { BottomBar } from './components/BottomBar';
import { LyricsView } from './components/LyricsView';
import { QueueDrawer } from './components/QueueDrawer';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const {
    tracks,
    setTracks,
    activeTab,
    searchQuery,
    likedTrackIds,
    currentTrack,
    showLyricsFullscreen,
    isQueueOpen,
  } = usePlayerStore();

  // Load saved library.json from AppData on startup
  useEffect(() => {
    const initLoad = async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const savedTracks: any = await invoke('load_library');
          if (savedTracks && Array.isArray(savedTracks) && savedTracks.length > 0) {
            setTracks(savedTracks);
            return;
          }
          const sampleTracks: any = await invoke('scan_sample_folder');
          if (sampleTracks && Array.isArray(sampleTracks) && sampleTracks.length > 0) {
            setTracks(sampleTracks);
          }
        }
      } catch (e) {
        console.warn('Auto init load notice:', e);
      }
    };
    initLoad();
  }, []);

  // Filter tracks based on search query
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'liked') {
      return likedTrackIds.includes(t.id);
    }
    return true;
  });

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Ambient Glassmorphism Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {currentTrack?.embedded_art_base64 ? (
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-25 blur-[120px] transition-all duration-700 bg-cover bg-center scale-110"
            style={{ backgroundImage: `url(${currentTrack.embedded_art_base64})` }}
          />
        ) : (
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        )}
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      </div>

      {/* App Body Layout */}
      <div className="flex flex-1 min-h-0 z-10">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />

          <div className="flex-1 overflow-y-auto px-8 py-2 custom-scrollbar">
            {activeTab === 'albums' ? (
              <AlbumGrid tracks={filteredTracks} />
            ) : (
              <TrackList tracks={filteredTracks} />
            )}
          </div>
        </main>
      </div>

      {/* Bottom Audio Player Bar */}
      <BottomBar />

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
