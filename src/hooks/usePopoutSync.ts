import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track, PopoutLyricsSettings } from '../types/player';
import { invoke } from '@tauri-apps/api/core';

export interface PopoutSyncPayload {
  currentTrack: Track | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  preferWordSyncedLyrics: boolean;
  inferWordSyncedLyrics: boolean;
  isRomanizationEnabled: boolean;
  romanizationMode: 'below' | 'replace';
  isTranslationEnabled: boolean;
  translationMode: 'below' | 'replace';
  popoutLyricsSettings: PopoutLyricsSettings;
  lyricsAnimationStyle: string;
}

export type PopoutMessage =
  | { type: 'REQUEST_SYNC' }
  | { type: 'SYNC_STATE'; payload: PopoutSyncPayload }
  | { type: 'STATE_CHANGE'; payload: Partial<PopoutSyncPayload> }
  | { type: 'COMMAND'; action: 'togglePlay' | 'nextTrack' | 'previousTrack' | 'seek' | 'setVolume' | 'setPopoutSettings' | 'setLyricsAnimationStyle'; value?: any };

const CHANNEL_NAME = 'prism-popout-sync';

/**
 * Hook for main window: broadcasts state updates and handles remote playback commands.
 */
export function useMainWindowPopoutBridge() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const preferWordSyncedLyrics = usePlayerStore((s) => s.preferWordSyncedLyrics);
  const inferWordSyncedLyrics = usePlayerStore((s) => s.inferWordSyncedLyrics);
  const isRomanizationEnabled = usePlayerStore((s) => s.isRomanizationEnabled);
  const romanizationMode = usePlayerStore((s) => s.romanizationMode);
  const isTranslationEnabled = usePlayerStore((s) => s.isTranslationEnabled);
  const translationMode = usePlayerStore((s) => s.translationMode);
  const lyricsAnimationStyle = usePlayerStore((s) => s.lyricsAnimationStyle);

  const channelRef = useRef<BroadcastChannel | null>(null);

  const getFullPayload = useCallback((): PopoutSyncPayload => {
    const s = usePlayerStore.getState();
    return {
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      duration: s.duration,
      currentTime: s.currentTime,
      volume: s.volume,
      preferWordSyncedLyrics: s.preferWordSyncedLyrics,
      inferWordSyncedLyrics: s.inferWordSyncedLyrics,
      isRomanizationEnabled: s.isRomanizationEnabled,
      romanizationMode: s.romanizationMode,
      isTranslationEnabled: s.isTranslationEnabled,
      translationMode: s.translationMode,
      popoutLyricsSettings: s.popoutLyricsSettings,
      lyricsAnimationStyle: s.lyricsAnimationStyle,
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;

    bc.onmessage = (event: MessageEvent<PopoutMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'REQUEST_SYNC') {
        bc.postMessage({
          type: 'SYNC_STATE',
          payload: getFullPayload(),
        });
      } else if (msg.type === 'COMMAND') {
        const store = usePlayerStore.getState();
        switch (msg.action) {
          case 'togglePlay':
            store.togglePlay();
            break;
          case 'nextTrack':
            store.nextTrack(true);
            break;
          case 'previousTrack':
            store.previousTrack();
            break;
          case 'seek':
            if (typeof msg.value === 'number') {
              store.seek(msg.value);
            }
            break;
          case 'setVolume':
            if (typeof msg.value === 'number') {
              store.setVolume(msg.value);
            }
            break;
          case 'setPopoutSettings':
            if (msg.value) {
              store.setPopoutLyricsSettings(msg.value);
            }
            break;
          case 'setLyricsAnimationStyle':
            if (typeof msg.value === 'string') {
              store.setLyricsAnimationStyle(msg.value as any);
            }
            break;
        }
      }
    };

    return () => {
      bc.close();
      channelRef.current = null;
    };
  }, [getFullPayload]);

  // Broadcast state changes whenever primary playback properties update
  useEffect(() => {
    if (!channelRef.current) return;
    channelRef.current.postMessage({
      type: 'STATE_CHANGE',
      payload: {
        currentTrack,
        isPlaying,
        duration,
        volume,
        preferWordSyncedLyrics,
        inferWordSyncedLyrics,
        isRomanizationEnabled,
        romanizationMode,
        isTranslationEnabled,
        translationMode,
        lyricsAnimationStyle,
      },
    });
  }, [
    currentTrack,
    isPlaying,
    duration,
    volume,
    preferWordSyncedLyrics,
    inferWordSyncedLyrics,
    isRomanizationEnabled,
    romanizationMode,
    isTranslationEnabled,
    translationMode,
    lyricsAnimationStyle,
  ]);
}

/**
 * Hook for pop-out window: maintains synchronized player state and dispatches user actions.
 */
export function usePopoutSync() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;

    bc.onmessage = (event: MessageEvent<PopoutMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'SYNC_STATE' && msg.payload) {
        usePlayerStore.setState({
          currentTrack: msg.payload.currentTrack,
          isPlaying: msg.payload.isPlaying,
          duration: msg.payload.duration,
          currentTime: msg.payload.currentTime,
          volume: msg.payload.volume,
          preferWordSyncedLyrics: msg.payload.preferWordSyncedLyrics,
          inferWordSyncedLyrics: msg.payload.inferWordSyncedLyrics,
          isRomanizationEnabled: msg.payload.isRomanizationEnabled,
          romanizationMode: msg.payload.romanizationMode,
          isTranslationEnabled: msg.payload.isTranslationEnabled,
          translationMode: msg.payload.translationMode,
          lyricsAnimationStyle: (msg.payload.lyricsAnimationStyle as any) || usePlayerStore.getState().lyricsAnimationStyle,
        });
        if (msg.payload.popoutLyricsSettings) {
          usePlayerStore.getState().setPopoutLyricsSettings(msg.payload.popoutLyricsSettings);
        }
      } else if (msg.type === 'STATE_CHANGE' && msg.payload) {
        usePlayerStore.setState(msg.payload as any);
      }
    };

    // Request initial state on mount
    bc.postMessage({ type: 'REQUEST_SYNC' });

    return () => {
      bc.close();
      channelRef.current = null;
    };
  }, []);

  const sendCommand = useCallback((action: 'togglePlay' | 'nextTrack' | 'previousTrack' | 'seek' | 'setVolume' | 'setPopoutSettings' | 'setLyricsAnimationStyle', value?: any) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'COMMAND', action, value });
    }

    if (action === 'setLyricsAnimationStyle' && typeof value === 'string') {
      usePlayerStore.getState().setLyricsAnimationStyle(value as any);
    }

    // Direct Rust invocations for instant response
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      if (action === 'togglePlay') {
        const currentPlaying = usePlayerStore.getState().isPlaying;
        if (currentPlaying) {
          invoke('pause_audio').catch(() => {});
          usePlayerStore.setState({ isPlaying: false });
        } else {
          invoke('resume_audio').catch(() => {});
          usePlayerStore.setState({ isPlaying: true });
        }
      } else if (action === 'seek' && typeof value === 'number') {
        invoke('seek_audio', { positionSecs: value }).catch(() => {});
        usePlayerStore.setState({ currentTime: value });
      } else if (action === 'setVolume' && typeof value === 'number') {
        invoke('set_volume', { volume: value }).catch(() => {});
        usePlayerStore.setState({ volume: value });
      }
    }
  }, []);

  return { sendCommand };
}
