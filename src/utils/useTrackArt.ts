import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Track } from '../types/player';

const artCache = new Map<string, string>();

export function useTrackArt(track: Track | null): string | null {
  const [art, setArt] = useState<string | null>(
    track?.embedded_art_base64 || (track ? artCache.get(track.path) || null : null)
  );

  useEffect(() => {
    if (!track) {
      setArt(null);
      return;
    }
    if (track.embedded_art_base64) {
      setArt(track.embedded_art_base64);
      artCache.set(track.path, track.embedded_art_base64);
      return;
    }
    if (artCache.has(track.path)) {
      setArt(artCache.get(track.path)!);
      return;
    }
    let isMounted = true;
    if (window.__TAURI_INTERNALS__) {
      invoke<string | null>('get_track_art', { path: track.path })
        .then((fetchedArt) => {
          if (isMounted && fetchedArt) {
            artCache.set(track.path, fetchedArt);
            setArt(fetchedArt);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [track?.id, track?.path, track?.embedded_art_base64]);

  return art;
}
