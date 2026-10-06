import React from 'react';
import Box from '@mui/material/Box';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { ArtistDetailHeader } from './artists/ArtistDetailHeader';
import { ArtistAlbumSection } from './artists/ArtistAlbumSection';

export const ArtistView: React.FC = () => {
  const selectedArtist = usePlayerStore((s) => s.selectedArtist);
  const tracks = usePlayerStore((s) => s.tracks);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  if (!selectedArtist) return null;

  const artistTracks = tracks.filter((t) => t.artist === selectedArtist || t.artist?.includes(selectedArtist));

  const albumsMap: Record<string, Track[]> = {};
  artistTracks.forEach((track) => {
    const albumName = track.album || 'Unknown Album';
    if (!albumsMap[albumName]) {
      albumsMap[albumName] = [];
    }
    albumsMap[albumName].push(track);
  });

  const sortedAlbums = Object.keys(albumsMap).sort();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', pr: 1, pb: 16 }} className="custom-scrollbar">
      <ArtistDetailHeader
        artistName={selectedArtist}
        totalSongs={artistTracks.length}
        onBack={() => setActiveTab('artists')}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sortedAlbums.map((albumName) => (
          <ArtistAlbumSection
            key={albumName}
            albumName={albumName}
            tracks={albumsMap[albumName]}
            artistName={selectedArtist}
          />
        ))}
      </Box>
    </Box>
  );
};
