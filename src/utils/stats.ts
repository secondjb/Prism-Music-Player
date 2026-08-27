import { invoke } from '@tauri-apps/api/core';

export interface ListeningEvent {
  id: number;
  song_title: string;
  artist_name: string;
  album_name: string | null;
  genre: string | null;
  duration_ms: number;
  played_at: string;
}

export async function logListeningEvent(
  songTitle: string,
  artistName: string,
  albumName: string | null,
  genre: string | null,
  durationMs: number
): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  try {
    await invoke('log_listening_event', {
      songTitle,
      artistName,
      albumName,
      genre,
      durationMs,
    });
  } catch (error) {
    console.error('Failed to log listening event:', error);
  }
}

export async function fetchListeningEvents(): Promise<ListeningEvent[]> {
  if (!window.__TAURI_INTERNALS__) return [];
  try {
    const events: ListeningEvent[] = await invoke('fetch_listening_events');
    return events;
  } catch (error) {
    console.error('Failed to fetch listening events:', error);
    return [];
  }
}

export async function deleteListeningHistory(): Promise<void> {
  if (!window.__TAURI_INTERNALS__) return;
  try {
    await invoke('delete_listening_history');
  } catch (error) {
    console.error('Failed to delete listening history:', error);
  }
}
