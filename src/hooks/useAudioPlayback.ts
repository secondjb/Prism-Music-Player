import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { broadcastStateSync, broadcastPlaylistsSync, broadcastP2pFrame, broadcastTrackNotFound, sendP2pFile } from '../utils/p2pSync';

interface UseAudioPlaybackOptions {
  trackArt?: string | null;
}

/**
 * Centralized audio playback and hardware integration hook.
 * Decouples high-frequency state updates (currentTime) from UI components,
 * while managing audio engine polling, track auto-advance, Windows SMTC / MediaSession,
 * sleep timer ticks, and global keyboard shortcuts.
 */
let lastCompanionConnectTime = 0;

export function useAudioPlayback({ trackArt }: UseAudioPlaybackOptions = {}) {
  // Low-frequency subscriptions only
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const tickSleepTimerSecond = usePlayerStore((s) => s.tickSleepTimerSecond);

  // Auto-sync backend next track whenever queue or playback state changes
  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state, prevState) => {
      if (
        state.userQueue !== prevState.userQueue ||
        state.queue !== prevState.queue ||
        state.currentIndex !== prevState.currentIndex ||
        state.repeatMode !== prevState.repeatMode ||
        state.linkedTracks !== prevState.linkedTracks ||
        state.alwaysGaplessForLinkedSongs !== prevState.alwaysGaplessForLinkedSongs ||
        state.alwaysGaplessSongIds !== prevState.alwaysGaplessSongIds ||
        state.currentTrack !== prevState.currentTrack ||
        state.replayGainMode !== prevState.replayGainMode
      ) {
        state.syncNextTrackToBackend();
      }

      if (
        state.currentTrack !== prevState.currentTrack ||
        state.isPlaying !== prevState.isPlaying ||
        state.volume !== prevState.volume ||
        state.repeatMode !== prevState.repeatMode ||
        state.shuffleEnabled !== prevState.shuffleEnabled ||
        state.queue !== prevState.queue ||
        state.userQueue !== prevState.userQueue ||
        state.currentIndex !== prevState.currentIndex ||
        state.p2pActiveDeviceId !== prevState.p2pActiveDeviceId ||
        state.isPlaying !== prevState.isPlaying
      ) {
        broadcastStateSync(true);
      }

      if (state.playlists !== prevState.playlists) {
        broadcastPlaylistsSync();
      }
    });
    return unsub;
  }, []);

  const isTransitioningRef = useRef(false);
  const lastPosRef = useRef(-1);
  const stallCountRef = useRef(0);

  useEffect(() => {
    isTransitioningRef.current = false;
    lastPosRef.current = -1;
    stallCountRef.current = 0;
  }, [currentTrack?.id]);

  // Continuous audio engine position polling & auto-advance (runs globally regardless of page/tab)
  useEffect(() => {
    if (!isPlaying || !window.__TAURI_INTERNALS__) return;
    const pollInterval = showLyricsFullscreen || activeTab === 'lyrics' ? 150 : 250;
    let lastTick = performance.now();
    let tickCount = 0;
    let accumulatedIpc = 0;
    let accumulatedUpdate = 0;

    const interval = setInterval(async () => {
      const tickStart = performance.now();
      const intervalJitter = tickStart - lastTick - pollInterval;
      lastTick = tickStart;

      try {
        const ipcStart = performance.now();
        const res: any = await invoke('get_playback_position');
        const ipcEnd = performance.now();
        const ipcDuration = ipcEnd - ipcStart;

        const pos = Array.isArray(res) ? res[0] : res;
        const durFromRust = Array.isArray(res) ? res[1] : 0;
        if (typeof pos === 'number' && !isNaN(pos) && pos >= 0) {
          const updateStart = performance.now();
          const state = usePlayerStore.getState();

          // Seek debouncing: if a manual seek occurred recently (< 650ms)
          // and the backend hasn't caught up to within 0.8s of the target yet,
          // ignore the stale position tick to avoid UI snapback / rubber-banding.
          const timeSinceSeek = performance.now() - (state.lastSeekTime || 0);
          if (timeSinceSeek < 650 && Math.abs(pos - (state.lastSeekTarget ?? state.currentTime)) > 0.8) {
            return;
          }

          const effectiveDur =
            durFromRust > 0 ? durFromRust : state.currentTrack?.duration_secs || state.duration || 0;

          // Skip expensive React renders when app is minimized/hidden
          if (!document.hidden) {
            usePlayerStore.setState({
              currentTime: pos,
              ...(effectiveDur > 0 ? { duration: effectiveDur } : {}),
            });
          }
          const updateEnd = performance.now();
          const updateDuration = updateEnd - updateStart;

          accumulatedIpc += ipcDuration;
          accumulatedUpdate += updateDuration;
          tickCount++;

          // Log warning if single poll exceeded 10ms or log periodic 5s performance summary
          if (ipcDuration > 10 || updateDuration > 10) {
            console.warn(
              `[Perf:useAudioPlayback:SPIKE] Slow tick: IPC=${ipcDuration.toFixed(2)}ms, StateUpdate=${updateDuration.toFixed(2)}ms, Jitter=${intervalJitter.toFixed(1)}ms`
            );
          } else if (tickCount % 20 === 0) {
            console.log(
              `[Perf:useAudioPlayback:Avg] Avg IPC=${(accumulatedIpc / tickCount).toFixed(2)}ms, Avg Update=${(accumulatedUpdate / tickCount).toFixed(2)}ms, Jitter=${intervalJitter.toFixed(1)}ms (${tickCount} ticks)`
            );
            accumulatedIpc = 0;
            accumulatedUpdate = 0;
            tickCount = 0;
          }

          const dur = effectiveDur;

          // Detect if playback position has stalled near end of track (stream EOF)
          if (dur > 1 && pos >= dur - 1.5) {
            if (lastPosRef.current >= 0 && Math.abs(pos - lastPosRef.current) < 0.03) {
              stallCountRef.current += 1;
            } else {
              stallCountRef.current = 0;
            }
          } else {
            stallCountRef.current = 0;
          }

          // Halt before transition if sleep timer expiring on last track
          if (sleepTimer.active && sleepTimer.mode === 'tracks' && sleepTimer.remainingTracks <= 1) {
            if (effectiveDur > 1 && pos >= effectiveDur - 0.7) {
              usePlayerStore.getState().pause();
              usePlayerStore.setState({
                sleepTimer: { active: false, mode: 'tracks', remainingSeconds: 0, remainingTracks: 0 }
              });
              broadcastStateSync(true);
            }
          }

          // Periodic P2P Companion state sync update
          if (tickCount % 4 === 0) {
            broadcastStateSync();
          }
          lastPosRef.current = pos;

        }
      } catch (e) {
        // Ignored
      }
    }, pollInterval);
    return () => clearInterval(interval);
  }, [isPlaying, nextTrack, showLyricsFullscreen, activeTab]);

  // Sleep timer interval tick (runs globally)
  useEffect(() => {
    if (!sleepTimer.active || sleepTimer.mode !== 'time') return;
    const interval = setInterval(() => {
      tickSleepTimerSecond();
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimer.active, sleepTimer.mode, tickSleepTimerSecond]);

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
      invoke('set_taskbar_playback_state', { isPlaying }).catch(() => {});
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

  // MediaSession Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => usePlayerStore.getState().resume()],
      ['pause', () => usePlayerStore.getState().pause()],
      ['previoustrack', () => usePlayerStore.getState().previousTrack()],
      ['nexttrack', () => usePlayerStore.getState().nextTrack()],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            usePlayerStore.getState().seek(details.seekTime);
          }
        },
      ],
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
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        usePlayerStore.getState().togglePlay();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
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

    const unlistens: (() => void)[] = [];
    if (window.__TAURI_INTERNALS__) {
      listen('track-transitioned', () => {
        usePlayerStore.getState().onTrackTransitioned();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen('track-finished', () => {
        usePlayerStore.getState().nextTrack(false);
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen<{ current: number; total: number; track_id: string; bpm?: number; key?: string }>(
        'audio_analysis_progress',
        (e) => {
          const { current, total, track_id, bpm, key } = e.payload;
          const store = usePlayerStore.getState();
          const currentTracks = Array.isArray(store.tracks) ? store.tracks : [];
          const updated = currentTracks.map((t) =>
            t.id === track_id
              ? {
                  ...t,
                  ...(bpm !== undefined ? { bpm } : {}),
                  ...(key !== undefined ? { key } : {}),
                }
              : t
          );
          usePlayerStore.setState({
            tracks: updated,
            audioAnalysisProgress: { current, total },
          });
        }
      ).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen<any[]>('audio_analysis_completed', (e) => {
        if (Array.isArray(e.payload) && e.payload.length > 0) {
          usePlayerStore.setState({
            tracks: e.payload,
            audioAnalysisProgress: null,
          });
        } else {
          usePlayerStore.setState({ audioAnalysisProgress: null });
        }
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

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
        unlistens.push(unlistenFn);
      });

      listen('media-prev', () => {
        usePlayerStore.getState().previousTrack();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen('media-toggle', () => {
        usePlayerStore.getState().togglePlay();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen('media-next', () => {
        usePlayerStore.getState().nextTrack();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion remote command handling
      listen('p2p-command', (event: any) => {
        const { action, seekPositionMs, volume, repeatMode, trackFilename, trackTitle, trackArtist, queueFilenames } = event.payload || {};
        const store = usePlayerStore.getState();
        switch (action) {
          case 'PLAY_TRACK': {
            const normalize = (s?: string) => (s || '').toLowerCase().trim();
            const targetFn = trackFilename ? normalize(trackFilename) : '';
            const targetTitle = normalize(trackTitle);
            const targetArtist = normalize(trackArtist);

            const allTracks = store.tracks || [];
            let matchedTrack = allTracks.find((t) => {
              if (targetFn) {
                const fn = normalize(t.path ? t.path.replace(/\\/g, "/").split("/").pop() : "");
                if (fn && fn === targetFn) return true;
              }
              if (targetTitle && normalize(t.title) === targetTitle) {
                if (!targetArtist || normalize(t.artist).includes(targetArtist) || targetArtist.includes(normalize(t.artist))) {
                  return true;
                }
              }
              return false;
            });

            if (!matchedTrack && store.queue && store.queue.length > 0) {
              matchedTrack = store.queue.find((t) => {
                if (targetFn) {
                  const fn = normalize(t.path ? t.path.replace(/\\/g, "/").split("/").pop() : "");
                  if (fn && fn === targetFn) return true;
                }
                if (targetTitle && normalize(t.title) === targetTitle) return true;
                return false;
              });
            }

            if (!matchedTrack && targetTitle) {
              matchedTrack = allTracks.find((t) => normalize(t.title) === targetTitle) || (store.queue || []).find((t) => normalize(t.title) === targetTitle);
            }
            if (matchedTrack) {
              let contextTracks: any[] = [];
              if (Array.isArray(queueFilenames) && queueFilenames.length > 0) {
                const mapByFn = new Map<string, any>();
                for (const t of allTracks) {
                  const fn = normalize(t.path ? t.path.replace(/\\/g, "/").split("/").pop() : "");
                  if (fn) mapByFn.set(fn, t);
                  const tit = normalize(t.title);
                  if (tit) mapByFn.set(tit, t);
                }
                for (const qf of queueFilenames) {
                  const found = mapByFn.get(normalize(qf));
                  if (found) contextTracks.push(found);
                }
              }
              if (contextTracks.length === 0) {
                contextTracks = allTracks;
              }

              if (store.currentTrack && store.currentTrack.id === matchedTrack.id) {
                if (!store.isPlaying) {
                  store.resume();
                }
              } else {
                if (Array.isArray(queueFilenames) && queueFilenames.length > 0) {
                  store.playTrack(matchedTrack, contextTracks);
                } else {
                  const queueIdx = (store.queue || []).findIndex((t) => t.id === matchedTrack.id);
                  if (queueIdx !== -1) {
                    store.playIndex(queueIdx);
                  } else {
                    store.playTrack(matchedTrack, contextTracks);
                  }
                }
              }
              broadcastStateSync(true);
            } else {
              broadcastTrackNotFound(trackTitle || '', trackArtist || '', trackFilename || '');
            }
            break;
          }
          case 'PLAY_NEXT':
          case 'ADD_TO_QUEUE': {
            const normalize = (s?: string) => (s || '').toLowerCase().trim();
            const targetFn = trackFilename ? normalize(trackFilename) : '';
            const targetTitle = normalize(trackTitle);
            const targetArtist = normalize(trackArtist);

            const allTracks = store.tracks || [];
            let matchedTrack = allTracks.find((t) => {
              if (targetFn) {
                const fn = normalize(t.path ? t.path.replace(/\\/g, "/").split("/").pop() : "");
                if (fn && fn === targetFn) return true;
              }
              if (targetTitle && normalize(t.title) === targetTitle) {
                if (!targetArtist || normalize(t.artist).includes(targetArtist) || targetArtist.includes(normalize(t.artist))) {
                  return true;
                }
              }
              return false;
            });

            if (!matchedTrack && targetTitle) {
              matchedTrack = allTracks.find((t) => normalize(t.title) === targetTitle);
            }

            if (matchedTrack) {
              if (action === 'PLAY_NEXT') {
                store.playNext(matchedTrack);
              } else {
                store.addToQueue(matchedTrack);
              }
              broadcastStateSync(true);
            }
            break;
          }
          case 'REQUEST_FILE_DOWNLOAD': {
            const normalize = (s?: string) => (s || '').toLowerCase().trim();
            const targetFn = trackFilename ? normalize(trackFilename) : '';
            const allTracks = store.tracks || [];
            const matched = allTracks.find((t) => {
              if (targetFn) {
                const fn = normalize(t.path ? t.path.replace(/\\/g, "/").split("/").pop() : "");
                if (fn && fn === targetFn) return true;
              }
              if (trackTitle && normalize(t.title) === normalize(trackTitle)) return true;
              return false;
            });
            if (matched && matched.path) {
              const fileId = matched.path.replace(/\\/g, '/').split('/').pop() || 'track.mp3';
              sendP2pFile(matched.path, fileId).catch(console.error);
            }
            break;
          }
          case 'PLAY':
            if (!store.isPlaying) store.resume();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'PAUSE':
            if (store.isPlaying) store.pause();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'TOGGLE_PLAY_PAUSE':
            store.togglePlay();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'SEEK':
            if (typeof seekPositionMs === 'number') {
              const targetSecs = seekPositionMs / 1000;
              const currentSecs = store.currentTime || 0;
              const timeSinceConnect = performance.now() - lastCompanionConnectTime;
              const delta = Math.abs(currentSecs - targetSecs);

              // Prevent connection-synchronization echo loops:
              // If a companion recently connected (< 3s) and sends a seek within 3s
              // of the current playback position, or if actively playing and the delta is tiny (< 0.4s),
              // ignore it to avoid interrupting the audio stream with buffer flushes / stutters.
              if (store.isPlaying) {
                if (timeSinceConnect < 3000 && delta < 3.0) {
                  console.log(
                    `[P2P Sync] Ignored redundant connect-sync seek (${targetSecs.toFixed(2)}s vs current ${currentSecs.toFixed(2)}s, delta ${delta.toFixed(2)}s)`
                  );
                  break;
                }
                if (delta < 0.4) {
                  console.log(
                    `[P2P Sync] Ignored micro-seek while playing (${targetSecs.toFixed(2)}s vs current ${currentSecs.toFixed(2)}s)`
                  );
                  break;
                }
              }

              store.seek(targetSecs);
              setTimeout(() => broadcastStateSync(true), 30);
            }
            break;
          case 'SKIP_NEXT':
            store.nextTrack(true);
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'SKIP_PREVIOUS':
            store.previousTrack();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'SET_VOLUME':
            if (typeof volume === 'number') {
              store.setVolume(Math.max(0, Math.min(1, volume)));
            }
            break;
          case 'TOGGLE_SHUFFLE':
            store.toggleShuffle();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'RESHUFFLE_UPCOMING':
            store.reshuffleUpcomingContext();
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'SET_REPEAT':
            if (repeatMode === 'OFF') store.setRepeatMode('off');
            else if (repeatMode === 'ALL') store.setRepeatMode('all');
            else if (repeatMode === 'ONE') store.setRepeatMode('one');
            setTimeout(() => broadcastStateSync(true), 30);
            break;
          case 'SET_SLEEP_TIMER': {
            const { sleepTimerMode, sleepTimerValue } = event.payload || {};
            if (sleepTimerMode && typeof sleepTimerValue === 'number' && sleepTimerValue > 0) {
              store.startSleepTimer(sleepTimerMode, sleepTimerValue);
            } else {
              store.cancelSleepTimer();
            }
            break;
          }
          case 'CANCEL_SLEEP_TIMER':
            store.cancelSleepTimer();
            break;
        }
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Output routing sync (checkboxes & starred queue authority)
      listen('p2p-routing-sync', (event: any) => {
        const { isDesktopEnabled, isCompanionEnabled, starredDeviceId } = event.payload || {};
        const store = usePlayerStore.getState();
        if (typeof isDesktopEnabled === 'boolean') {
          store.setIsDesktopAudioEnabled(isDesktopEnabled);
          if (!isDesktopEnabled && store.isPlaying) {
            store.togglePlay();
          } else if (isDesktopEnabled && !isCompanionEnabled && !store.isPlaying) {
            store.togglePlay();
          }
        }
        if (typeof isCompanionEnabled === 'boolean') {
          store.setIsCompanionAudioEnabled(isCompanionEnabled);
        }
        if (starredDeviceId) {
          store.setStarredDeviceId(starredDeviceId);
        }
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion audio output target handoff (desktop vs android companion)
      listen('p2p-swap-device', (event: any) => {
        const { targetDeviceId } = event.payload || {};
        const store = usePlayerStore.getState();
        store.setP2pActiveDeviceId(targetDeviceId);
        if (targetDeviceId === 'local' || targetDeviceId === 'android') {
          // Playback handed off to Android companion -> pause desktop engine
          if (store.isPlaying) {
            store.togglePlay();
          }
        } else if (targetDeviceId === 'desktop') {
          // Playback returned to desktop -> resume if paused
          if (!store.isPlaying) {
            store.togglePlay();
          }
        }
        broadcastStateSync(true);
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion requested instantaneous state sync (e.g. after handshake approval)
      listen('p2p-request-state-sync', () => {
        lastCompanionConnectTime = performance.now();
        broadcastStateSync(true);
        broadcastPlaylistsSync();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion playlist synchronization
      listen('p2p-playlist-sync', (event: any) => {
        const { playlists } = event.payload || {};
        if (Array.isArray(playlists)) {
          usePlayerStore.getState().syncIncomingPlaylists(playlists);
        }
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion library manifest diff request
      listen('p2p-manifest-req', () => {
        const store = usePlayerStore.getState();
        const tracks = (store.tracks || []).map((t) => {
          const fn = t.path ? t.path.replace(/\\/g, '/').split('/').pop() || '' : '';
          return {
            filename: fn,
            title: t.title || '',
            artist: t.artist || '',
            sizeBytes: (t as any).size_bytes || 25_000_000,
            durationSecs: t.duration_secs || 0,
          };
        });
        broadcastP2pFrame({
          type: 'manifest_resp',
          tracks,
        }).catch(console.error);
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion file chunk transfer completed
      listen('p2p-file-received', (event: any) => {
        console.log('[P2P Sync] Incoming audio file received from companion:', event.payload);
        const store = usePlayerStore.getState();
        store.rescanConfiguredLibraries?.();
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Connected companion device count updates
      listen('p2p-client-count-changed', (event: any) => {
        lastCompanionConnectTime = performance.now();
        const count = typeof event.payload === 'number' ? event.payload : 0;
        usePlayerStore.getState().setP2pConnectedClients(count);
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      // P2P Companion device paired event
      listen('p2p-client-paired', (event: any) => {
        lastCompanionConnectTime = performance.now();
        const { deviceName, clientVersion } = event.payload || {};
        usePlayerStore.getState().addP2pPairedClient({
          name: deviceName || 'Companion Device',
          version: clientVersion || '1.0.0',
          pairedAt: Date.now(),
        });
      }).then((unlistenFn) => {
        unlistens.push(unlistenFn);
      });

      listen(
        'replaygain-scan-progress',
        (event: {
          payload: {
            current: number;
            total: number;
            path: string;
            replay_gain_db: number | null;
            replay_gain_peak: number | null;
            error: string | null;
            is_finished: boolean;
          };
        }) => {
          const { current, total, path, replay_gain_db, replay_gain_peak, is_finished } =
            event.payload;
          usePlayerStore.getState().setReplayGainScanProgress({
            current,
            total,
            path,
            isFinished: is_finished,
          });
          if (replay_gain_db != null) {
            usePlayerStore.getState().updateTrackReplayGain(path, replay_gain_db, replay_gain_peak);
          }
        }
      ).then((unlistenFn) => {
        unlistens.push(unlistenFn);
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
      unlistens.forEach((fn) => fn());
    };
  }, []);
}
