import React from 'react';
import Box from '@mui/material/Box';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackList } from './TrackList';
import { useTrackArt } from '../utils/useTrackArt';
import { AlbumDetailHeader } from './albums/AlbumDetailHeader';

export const AlbumView: React.FC = () => {
  const selectedAlbum = usePlayerStore((s) => s.selectedAlbum);
  const tracks = usePlayerStore((s) => s.tracks);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playIndex = usePlayerStore((s) => s.playIndex);

  if (!selectedAlbum) return null;

  const albumTracks = tracks.filter((t) => t.album === selectedAlbum || (!t.album && selectedAlbum === 'Unknown Album'));
  const firstTrack = albumTracks[0];
  const artistName = firstTrack?.artist || 'Unknown Artist';
  const art = useTrackArt(firstTrack);

  const playAlbum = () => {
    setQueue(albumTracks);
    playIndex(0);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', pr: 1, pb: 16 }} className="custom-scrollbar">
      <AlbumDetailHeader
        albumName={selectedAlbum}
        artistName={artistName}
        songCount={albumTracks.length}
        artUrl={art}
        onPlayAlbum={playAlbum}
        onBack={() => setActiveTab('albums')}
      />

      <Box
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          px: { xs: 1.5, sm: 3 },
          pt: 2,
          pb: 6,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <TrackList tracks={albumTracks} hideControls autoHeight />
      </Box>
    </Box>
  );
};
