import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { usePlayerStore } from '../store/usePlayerStore';
import { PlayerTrackInfo } from './player/PlayerTrackInfo';
import { PlayerControls } from './player/PlayerControls';
import { TrackProgressBar } from './player/TrackProgressBar';
import { PlayerVolumeControl } from './player/PlayerVolumeControl';
import { PlayerActions } from './player/PlayerActions';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export const BottomBar: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const toggleLikeTrack = usePlayerStore((s) => s.toggleLikeTrack);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const showAudioSpecs = usePlayerStore((s) => s.showAudioSpecs);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);

  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const isLyricsActive = showLyricsFullscreen || activeTab === 'lyrics';

  const handleCreatePlaylistConfirm = (playlistName: string) => {
    if (currentTrack) {
      createPlaylist(playlistName);
      setTimeout(() => {
        const latest = usePlayerStore.getState().playlists;
        const created = latest.find((p) => p.name === playlistName);
        if (created) {
          addTrackToPlaylist(created.id, currentTrack.id);
        }
      }, 50);
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        height: 92,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 2, sm: 3, md: 4 },
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        bgcolor: 'rgba(12, 12, 16, 0.85)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        position: 'relative',
        zIndex: 30,
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* 1. Track Info (Left) */}
      <PlayerTrackInfo
        currentTrack={currentTrack}
        isLiked={isLiked}
        onToggleLike={toggleLikeTrack}
        showAudioSpecs={showAudioSpecs}
        onOpenCreatePlaylistModal={() => setShowCreatePlaylistModal(true)}
      />

      {/* 2. Audio Controls & Expressive Seek Bar (Center) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          flex: 2,
          maxWidth: 680,
          minWidth: 0,
          px: { xs: 0.5, sm: 1.5, md: 2 },
          overflow: 'visible',
          py: 0.5,
        }}
      >
        <PlayerControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNextTrack={() => nextTrack()}
          onPreviousTrack={previousTrack}
          shuffleEnabled={shuffleEnabled}
          onToggleShuffle={toggleShuffle}
          repeatMode={repeatMode}
          onCycleRepeatMode={cycleRepeatMode}
        />
        <TrackProgressBar isLyricsActive={isLyricsActive} />
      </Box>

      {/* 3. Volume & Extra Actions (Right) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: { xs: 0.5, sm: 1, md: 1.5 },
          flex: 1,
          maxWidth: { xs: '35%', sm: '40%', md: '35%', lg: '30%' },
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        <PlayerVolumeControl volume={volume} setVolume={setVolume} />
        <PlayerActions />
      </Box>

      {/* Create Playlist Modal (when triggered via context menu) */}
      <CreatePlaylistModal
        isOpen={showCreatePlaylistModal}
        onClose={() => setShowCreatePlaylistModal(false)}
        onConfirm={handleCreatePlaylistConfirm}
      />
    </Box>
  );
};
