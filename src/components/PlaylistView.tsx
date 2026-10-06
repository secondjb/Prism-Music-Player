import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { PlusCircle, LayoutGrid, List } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track, Playlist } from '../types/player';
import { TrackTableView } from './TrackTableView';
import { PlaylistCard } from './playlist/PlaylistCard';
import { PlaylistListRow } from './playlist/PlaylistListRow';
import { PlaylistDetailHeader } from './playlist/PlaylistDetailHeader';
import { PlaylistAddSongsPanel } from './playlist/PlaylistAddSongsPanel';
import { PlaylistContextMenu } from './playlist/PlaylistContextMenu';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export const PlaylistView: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);
  const playlists = usePlayerStore((s) => s.playlists);
  const likedTrackIds = usePlayerStore((s) => s.likedTrackIds);
  const activePlaylistId = usePlayerStore((s) => s.activePlaylistId);
  const setActivePlaylistId = usePlayerStore((s) => s.setActivePlaylistId);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playPlaylistNext = usePlayerStore((s) => s.playPlaylistNext);
  const addPlaylistToQueue = usePlayerStore((s) => s.addPlaylistToQueue);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    pos: { top: number; left: number };
    playlist: Playlist;
  } | null>(null);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [addSongsQuery, setAddSongsQuery] = useState('');
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('prism_playlist_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('prism_playlist_view_mode', mode);
  };

  // Liked songs virtual playlist
  const likedTracks = useMemo(() => {
    return tracks.filter((t) => likedTrackIds.includes(t.id));
  }, [tracks, likedTrackIds]);

  const activePlaylist = useMemo(() => {
    if (activePlaylistId === '__liked__') {
      return { id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 } as Playlist;
    }
    return playlists.find((p) => p.id === activePlaylistId) || null;
  }, [activePlaylistId, playlists, likedTrackIds]);

  const handlePlayPlaylist = (pl: Playlist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let plTracks: Track[] = [];
    if (pl.id === '__liked__') {
      plTracks = likedTracks;
    } else {
      plTracks = pl.trackIds
        .map((tid) => tracks.find((t) => t.id === tid))
        .filter((t): t is Track => Boolean(t));
    }
    if (plTracks.length > 0) {
      playTrack(plTracks[0], plTracks);
    }
  };

  const handleDropOnPlaylist = (e: React.DragEvent, plId: string) => {
    e.preventDefault();
    setDragOverCardId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'tracks' && Array.isArray(data.ids)) {
        if (plId === '__liked__') {
          const state = usePlayerStore.getState();
          data.ids.forEach((id: string) => {
            if (!state.likedTrackIds.includes(id)) {
              state.toggleLikeTrack(id);
            }
          });
        } else {
          data.ids.forEach((id: string) => addTrackToPlaylist(plId, id));
        }
      }
    } catch {}
  };

  // If viewing playlist details
  if (activePlaylist) {
    const isLiked = activePlaylist.id === '__liked__';
    const playlistTracks = isLiked
      ? likedTracks
      : activePlaylist.trackIds
          .map((tid) => tracks.find((t) => t.id === tid))
          .filter((t): t is Track => Boolean(t));

    const totalDuration = playlistTracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

    const searchFilter = addSongsQuery.trim().toLowerCase();
    const candidateTracks = searchFilter
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(searchFilter) ||
            (t.artist && t.artist.toLowerCase().includes(searchFilter)) ||
            (t.album && t.album.toLowerCase().includes(searchFilter))
        )
      : tracks;

    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', pr: 1 }}>
        <PlaylistDetailHeader
          playlistId={activePlaylist.id}
          playlistName={activePlaylist.name}
          trackCount={playlistTracks.length}
          totalDurationSecs={totalDuration}
          isLikedPlaylist={isLiked}
          onBack={() => {
            setActivePlaylistId(null);
            setShowAddSongs(false);
            setAddSongsQuery('');
          }}
          onPlayAll={() => handlePlayPlaylist(activePlaylist)}
          showAddSongs={showAddSongs}
          onToggleAddSongs={() => setShowAddSongs(!showAddSongs)}
        />

        {showAddSongs && !isLiked && (
          <PlaylistAddSongsPanel
            searchQuery={addSongsQuery}
            onSearchChange={setAddSongsQuery}
            candidateTracks={candidateTracks}
            playlistTrackIds={activePlaylist.trackIds}
            onAddTrack={(tid) => addTrackToPlaylist(activePlaylist.id, tid)}
            onClose={() => setShowAddSongs(false)}
          />
        )}

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <TrackTableView
            tracks={playlistTracks}
            playlistId={isLiked ? undefined : activePlaylist.id}
            onRemoveFromPlaylist={isLiked ? undefined : (tid) => removeTrackFromPlaylist(activePlaylist.id, tid)}
          />
        </Box>
      </Box>
    );
  }

  // Playlist Grid / List Index View
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
          Playlists
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={() => setShowCreateModal(true)}
            startIcon={<PlusCircle size={16} />}
            sx={{
              bgcolor: 'var(--color-stop-1, #6366f1)',
              color: '#ffffff',
              borderRadius: '12px',
              py: 0.75,
              px: 2,
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 85%, #000000)',
              },
            }}
          >
            Create Playlist
          </Button>

          {/* View mode toggle */}
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, val) => {
              if (val) handleToggleViewMode(val);
            }}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              p: 0.25,
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                borderRadius: '8px !important',
                mx: 0.25,
                p: 0.75,
                color: '#a1a1aa',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                },
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' },
              },
            }}
          >
            <ToggleButton value="grid" aria-label="Grid view">
              <Tooltip title="Grid View" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LayoutGrid size={16} />
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <Tooltip title="List View" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <List size={16} />
                </Box>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Grid or List of Playlists */}
      <Box sx={{ overflowY: 'auto', flex: 1, pr: 1 }} className="custom-scrollbar">
        {viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(150px, 1fr))',
                sm: 'repeat(auto-fill, minmax(170px, 1fr))',
                md: 'repeat(auto-fill, minmax(190px, 1fr))',
              },
              gap: 2.5,
              pb: 6,
            }}
          >
            {/* Liked Songs Pseudo-Playlist Card */}
            <PlaylistCard
              playlist={{ id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 }}
              tracks={likedTracks}
              isLiked
              onPlay={(e) => handlePlayPlaylist({ id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 }, e)}
              onClick={() => setActivePlaylistId('__liked__')}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  pos: { top: e.clientY, left: e.clientX },
                  playlist: { id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 },
                });
              }}
              onDrop={(e) => handleDropOnPlaylist(e, '__liked__')}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCardId('__liked__');
              }}
              onDragLeave={() => setDragOverCardId(null)}
              isDragOver={dragOverCardId === '__liked__'}
            />

            {/* User Playlists Cards */}
            {playlists.map((pl) => {
              const plTracks = pl.trackIds
                .map((tid) => tracks.find((t) => t.id === tid))
                .filter((t): t is Track => Boolean(t));

              return (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  tracks={plTracks}
                  onPlay={(e) => handlePlayPlaylist(pl, e)}
                  onClick={() => setActivePlaylistId(pl.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      pos: { top: e.clientY, left: e.clientX },
                      playlist: pl,
                    });
                  }}
                  onDrop={(e) => handleDropOnPlaylist(e, pl.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCardId(pl.id);
                  }}
                  onDragLeave={() => setDragOverCardId(null)}
                  isDragOver={dragOverCardId === pl.id}
                />
              );
            })}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 6 }}>
            {/* Liked Songs Row */}
            <PlaylistListRow
              playlist={{ id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 }}
              tracks={likedTracks}
              isLiked
              onPlay={(e) => handlePlayPlaylist({ id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 }, e)}
              onClick={() => setActivePlaylistId('__liked__')}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  pos: { top: e.clientY, left: e.clientX },
                  playlist: { id: '__liked__', name: 'Liked Songs', trackIds: likedTrackIds, createdAt: 0 },
                });
              }}
              onDrop={(e) => handleDropOnPlaylist(e, '__liked__')}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCardId('__liked__');
              }}
              onDragLeave={() => setDragOverCardId(null)}
              isDragOver={dragOverCardId === '__liked__'}
            />

            {playlists.map((pl) => {
              const plTracks = pl.trackIds
                .map((tid) => tracks.find((t) => t.id === tid))
                .filter((t): t is Track => Boolean(t));

              return (
                <PlaylistListRow
                  key={pl.id}
                  playlist={pl}
                  tracks={plTracks}
                  onPlay={(e) => handlePlayPlaylist(pl, e)}
                  onClick={() => setActivePlaylistId(pl.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      pos: { top: e.clientY, left: e.clientX },
                      playlist: pl,
                    });
                  }}
                  onDrop={(e) => handleDropOnPlaylist(e, pl.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCardId(pl.id);
                  }}
                  onDragLeave={() => setDragOverCardId(null)}
                  isDragOver={dragOverCardId === pl.id}
                />
              );
            })}
          </Box>
        )}
      </Box>

      {/* Playlist Context Menu */}
      <PlaylistContextMenu
        anchorPosition={contextMenu ? contextMenu.pos : null}
        onClose={() => setContextMenu(null)}
        playlist={contextMenu ? contextMenu.playlist : null}
        onPlay={handlePlayPlaylist}
        onPlayNext={playPlaylistNext}
        onAddToQueue={addPlaylistToQueue}
        onRename={() => {
          if (contextMenu) {
            const nextName = window.prompt('Rename playlist:', contextMenu.playlist.name);
            if (nextName && nextName.trim()) {
              usePlayerStore.getState().renamePlaylist(contextMenu.playlist.id, nextName.trim());
            }
          }
        }}
        onDelete={(plId) => {
          if (window.confirm('Are you sure you want to delete this playlist?')) {
            deletePlaylist(plId);
          }
        }}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={(name) => createPlaylist(name)}
      />
    </Box>
  );
};
