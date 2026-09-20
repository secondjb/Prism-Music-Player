import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface UseAudioPlaybackOptions {
  trackArt?: string | null;
}

/**
 * Centralized audio playback and hardware integration hook.
 * Decouples high-frequency state updates (currentTime) from UI components,
 * while managing audio engine polling, track auto-advance, Windows SMTC / MediaSession,
 * sleep timer ticks, and global keyboard shortcuts.
 */
export function useAudioPlayback({ trackArt }: UseAudioPlaybackOptions = {}) {
  // Low-frequency subscriptions only
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const showLyricsFullscreen = usePlayerStore((s) => s.showLyricsFullscreen);
  const activeTab = usePlayerStore((s) => s.activeTab);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const tickSleepTimerSecond = usePlayerStore((s) => s.tickSleepTimerSecond);

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
          const rm = state.repeatMode;
          const crossfade = state.crossfadeDuration || 0;

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
          lastPosRef.current = pos;

          const isTransition =
            crossfade > 0 && dur > crossfade * 2
              ? pos >= dur - crossfade
              : dur > 0 && (pos >= dur - 0.04 || (pos >= dur - 0.5 && stallCountRef.current >= 4));

          if (dur > 1 && pos > 0.5 && isTransition && !isTransitioningRef.current) {
            isTransitioningRef.current = true;
            setTimeout(() => {
              isTransitioningRef.current = false;
            }, 1000);
            if (rm === 'one') {
              usePlayerStore.getState().replayCurrentTrack();
            } else {
              nextTrack();
            }
          }
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
