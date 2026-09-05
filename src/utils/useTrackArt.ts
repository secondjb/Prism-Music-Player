import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Track } from '../types/player';

export interface UseTrackArtOptions {
  thumbnail?: boolean;
  maxSize?: number;
}

const MAX_FULL_ART_CACHE = 40;
const MAX_THUMB_CACHE = 2000;

const fullArtCache = new Map<string, string>();
const thumbnailCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

function setFullArt(path: string, art: string) {
  if (fullArtCache.has(path)) {
    fullArtCache.delete(path);
  } else if (fullArtCache.size >= MAX_FULL_ART_CACHE) {
    const oldestKey = fullArtCache.keys().next().value;
    if (oldestKey) fullArtCache.delete(oldestKey);
  }
  fullArtCache.set(path, art);
}

function setThumbnail(key: string, thumb: string) {
  if (thumbnailCache.has(key)) {
    thumbnailCache.delete(key);
  } else if (thumbnailCache.size >= MAX_THUMB_CACHE) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (oldestKey) thumbnailCache.delete(oldestKey);
  }
  thumbnailCache.set(key, thumb);
}

/**
 * Creates a lightweight downscaled JPEG thumbnail (~3KB) from a high-res image data URL.
 */
function createThumbnail(dataUrl: string, maxSize = 128): Promise<string> {
  if (!dataUrl || dataUrl.length < 4096) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= maxSize && h <= maxSize) {
        resolve(dataUrl);
        return;
      }
      if (w > h) {
        h = Math.round((h * maxSize) / w);
        w = maxSize;
      } else {
        w = Math.round((w * maxSize) / h);
        h = maxSize;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
          return;
        }
      } catch {
        // Fallback to source
      }
      resolve(dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function useTrackArt(
  track: Track | null,
  options?: UseTrackArtOptions
): string | null {
  const isThumbnail = options?.thumbnail ?? false;
  const maxSize = options?.maxSize ?? (isThumbnail ? 128 : undefined);
  const thumbKey = track ? `${track.path}_thumb_${maxSize}` : '';

  const getInitial = (): string | null => {
    if (!track) return null;
    if (isThumbnail) {
      if (thumbnailCache.has(thumbKey)) return thumbnailCache.get(thumbKey)!;
    } else {
      if (track.embedded_art_base64) return track.embedded_art_base64;
      if (fullArtCache.has(track.path)) return fullArtCache.get(track.path)!;
    }
    return null;
  };

  const [art, setArt] = useState<string | null>(getInitial);

  useEffect(() => {
    if (!track) {
      setArt(null);
      return;
    }

    if (isThumbnail && thumbnailCache.has(thumbKey)) {
      setArt(thumbnailCache.get(thumbKey)!);
      return;
    }

    if (!isThumbnail) {
      if (track.embedded_art_base64) {
        setArt(track.embedded_art_base64);
        setFullArt(track.path, track.embedded_art_base64);
        return;
      }
      if (fullArtCache.has(track.path)) {
        setArt(fullArtCache.get(track.path)!);
        return;
      }
    }

    let isMounted = true;

    const processArt = async (rawArt: string) => {
      setFullArt(track.path, rawArt);
      if (isThumbnail) {
        const thumb = await createThumbnail(rawArt, maxSize);
        setThumbnail(thumbKey, thumb);
        if (isMounted) setArt(thumb);
      } else {
        if (isMounted) setArt(rawArt);
      }
    };

    if (isThumbnail && (track.embedded_art_base64 || fullArtCache.has(track.path))) {
      const source = track.embedded_art_base64 || fullArtCache.get(track.path)!;
      createThumbnail(source, maxSize).then((thumb) => {
        setThumbnail(thumbKey, thumb);
        if (isMounted) setArt(thumb);
      });
      return () => {
        isMounted = false;
      };
    }

    if (window.__TAURI_INTERNALS__) {
      let req = pendingRequests.get(track.path);
      if (!req) {
        req = invoke<string | null>('get_track_art', { path: track.path });
        pendingRequests.set(track.path, req);
      }

      req
        .then(async (fetchedArt) => {
          pendingRequests.delete(track.path);
          if (!isMounted || !fetchedArt) return;
          await processArt(fetchedArt);
        })
        .catch(() => {
          pendingRequests.delete(track.path);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [track?.id, track?.path, track?.embedded_art_base64, isThumbnail, maxSize, thumbKey]);

  return art;
}
