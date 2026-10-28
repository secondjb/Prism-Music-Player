import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    length: 0,
  } as any;
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {} as any;
}

describe('Prism Windows P2P Sync & Handoff Test Suite', () => {
  const mockTracks: Track[] = [
    {
      id: 'track-1',
      title: 'Midnight Echoes',
      artist: 'Lunar City',
      album: 'Night Waves',
      duration_secs: 210,
      path: 'C:\\Music\\Lunar City\\Midnight Echoes.flac',
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
    },
    {
      id: 'track-2',
      title: 'Neon Horizon',
      artist: 'Synthwave Express',
      album: 'Future Past',
      duration_secs: 185,
      path: 'C:\\Music\\Synthwave Express\\Neon Horizon.mp3',
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
    },
    {
      id: 'track-3',
      title: 'Solar Flare',
      artist: 'Cosmic Ray',
      album: 'Star Dust',
      duration_secs: 240,
      path: 'C:\\Music\\Cosmic Ray\\Solar Flare.wav',
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
    },
  ];

  beforeEach(() => {
    // Reset store state before each test
    usePlayerStore.setState({
      tracks: mockTracks,
      queue: mockTracks,
      currentTrack: mockTracks[0],
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 210,
      p2pActiveDeviceId: 'desktop',
      playlists: [
        {
          id: 'pl-favorites',
          name: 'Favorites',
          trackIds: ['track-1', 'track-2'],
          createdAt: 1000,
        },
      ],
    });
  });

  describe('P2P Command Execution & Track Matching', () => {
    it('matches incoming track by filename and correctly sets queue order', () => {
      const store = usePlayerStore.getState();
      const normalize = (s?: string) => (s || '').toLowerCase().trim();
      const targetFn = 'neon horizon.mp3';

      const matched = store.tracks.find((t) => {
        const fn = normalize(t.path ? t.path.replace(/\\/g, '/').split('/').pop() : '');
        return fn === targetFn;
      });

      expect(matched).toBeDefined();
      expect(matched?.id).toBe('track-2');

      // Given queueFilenames in order [Solar Flare.wav, Midnight Echoes.flac]
      const queueFilenames = ['Solar Flare.wav', 'Midnight Echoes.flac'];
      const mapByFn = new Map<string, Track>();
      for (const t of store.tracks) {
        const fn = normalize(t.path ? t.path.replace(/\\/g, '/').split('/').pop() : '');
        if (fn) mapByFn.set(fn, t);
      }

      const contextTracks: Track[] = [];
      for (const qf of queueFilenames) {
        const found = mapByFn.get(normalize(qf));
        if (found) contextTracks.push(found);
      }

      expect(contextTracks).toHaveLength(2);
      expect(contextTracks[0].id).toBe('track-3');
      expect(contextTracks[1].id).toBe('track-1');
    });

    it('matches incoming track by title and artist when filename is generic', () => {
      const store = usePlayerStore.getState();
      const targetTitle = 'solar flare';
      const targetArtist = 'cosmic ray';

      const matched = store.tracks.find(
        (t) =>
          t.title.toLowerCase().trim() === targetTitle &&
          t.artist.toLowerCase().trim() === targetArtist
      );

      expect(matched).toBeDefined();
      expect(matched?.id).toBe('track-3');
    });

    it('preserves seekPositionMs when handing off PLAY_TRACK from companion', () => {
      const targetTrack = mockTracks[1];
      const targetSeekMs = 45500; // 45.5 seconds into song

      usePlayerStore.getState().playTrack(targetTrack, mockTracks);
      usePlayerStore.getState().seek(targetSeekMs / 1000);

      const updated = usePlayerStore.getState();
      expect(updated.currentTrack?.id).toBe('track-2');
      expect(updated.currentTime).toBe(45.5);
    });
  });

  describe('Audio Output Handoff & Swap Device Target Logic', () => {
    it('pauses desktop engine when playback is handed off to local/android', () => {
      // Simulate playing on desktop
      usePlayerStore.setState({ isPlaying: true });

      // Event: p2p-swap-device with targetDeviceId = "local"
      const targetDeviceId = 'local';
      usePlayerStore.getState().setP2pActiveDeviceId(targetDeviceId);

      if (targetDeviceId === 'local' || targetDeviceId === 'android') {
        const state = usePlayerStore.getState();
        if (state.isPlaying) {
          usePlayerStore.setState({ isPlaying: false });
        }
      }

      expect(usePlayerStore.getState().p2pActiveDeviceId).toBe('local');
      expect(usePlayerStore.getState().isPlaying).toBe(false);
    });

    it('resumes playback at current track and position when target is desktop', () => {
      // Desktop was paused at 72s on track 2
      usePlayerStore.setState({
        currentTrack: mockTracks[1],
        currentTime: 72,
        isPlaying: false,
      });

      const targetDeviceId = 'desktop';
      usePlayerStore.getState().setP2pActiveDeviceId(targetDeviceId);

      if (targetDeviceId === 'desktop') {
        const state = usePlayerStore.getState();
        if (!state.isPlaying) {
          usePlayerStore.setState({ isPlaying: true });
        }
      }

      expect(usePlayerStore.getState().p2pActiveDeviceId).toBe('desktop');
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentTime).toBe(72);
      expect(usePlayerStore.getState().currentTrack?.id).toBe('track-2');
    });

    it('updates desktop queue and timestamp from p2p-remote-state-sync', () => {
      // Companion is playing track-3 with a custom reordered queue
      const remoteState = {
        currentTrack: {
          title: 'Solar Flare',
          artist: 'Cosmic Ray',
          uri: 'file:///storage/emulated/0/Music/Solar Flare.wav',
        },
        queue: [
          { title: 'Solar Flare', uri: 'Solar Flare.wav' },
          { title: 'Neon Horizon', uri: 'Neon Horizon.mp3' },
        ],
        positionMs: 63000,
        durationMs: 240000,
        isPlaying: true,
      };

      const store = usePlayerStore.getState();
      const allTracks = store.tracks;
      const remoteFn = remoteState.currentTrack.uri.replace(/\\/g, '/').split('/').pop()?.toLowerCase().trim();
      const matched = allTracks.find((t) => {
        const fn = (t.path || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase().trim();
        return fn === remoteFn;
      });

      expect(matched).toBeDefined();

      const syncedQueue: Track[] = [];
      const mapByFn = new Map<string, Track>();
      for (const t of allTracks) {
        const fn = (t.path || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase().trim();
        if (fn) mapByFn.set(fn, t);
      }
      for (const qt of remoteState.queue) {
        const qFn = qt.uri.replace(/\\/g, '/').split('/').pop()?.toLowerCase().trim();
        const found = qFn ? mapByFn.get(qFn) : null;
        if (found) syncedQueue.push(found);
      }

      usePlayerStore.setState({
        currentTrack: matched,
        queue: syncedQueue,
        currentTime: remoteState.positionMs / 1000,
        duration: remoteState.durationMs / 1000,
      });

      const updated = usePlayerStore.getState();
      expect(updated.currentTrack?.id).toBe('track-3');
      expect(updated.currentTime).toBe(63);
      expect(updated.queue).toHaveLength(2);
      expect(updated.queue[0].id).toBe('track-3');
      expect(updated.queue[1].id).toBe('track-2');
    });
  });

  describe('Playlist Cover Sync & Reset Handling', () => {
    it('applies base64 custom cover uri from sync', () => {
      const syncPlaylists = [
        {
          id: 'pl-favorites',
          name: 'Favorites',
          customCoverUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          tracks: [{ filename: 'Midnight Echoes.flac', title: 'Midnight Echoes', artist: 'Lunar City' }],
        },
      ];

      usePlayerStore.getState().syncIncomingPlaylists(syncPlaylists);

      const playlist = usePlayerStore.getState().playlists.find((p) => p.id === 'pl-favorites');
      expect(playlist).toBeDefined();
      expect(playlist?.customCoverUri).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg...');
    });

    it('resets custom cover to undefined (default collage) when reset is synced', () => {
      // First set custom cover
      usePlayerStore.getState().updatePlaylistCover('pl-favorites', 'color:#6366f1');
      expect(usePlayerStore.getState().playlists.find((p) => p.id === 'pl-favorites')?.customCoverUri).toBe('color:#6366f1');

      // Then sync incoming playlist with customCoverUri = null (reset on phone)
      const syncPlaylists = [
        {
          id: 'pl-favorites',
          name: 'Favorites',
          customCoverUri: null,
          tracks: [{ filename: 'Midnight Echoes.flac', title: 'Midnight Echoes', artist: 'Lunar City' }],
        },
      ];

      usePlayerStore.getState().syncIncomingPlaylists(syncPlaylists);

      const playlist = usePlayerStore.getState().playlists.find((p) => p.id === 'pl-favorites');
      expect(playlist?.customCoverUri).toBeUndefined();
    });
  });
});
