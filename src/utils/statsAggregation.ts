import { ListeningEvent } from './stats';

export interface TopItem {
  name: string;
  count: number;
  listened_ms: number;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

export function getTotalListeningTime(events: ListeningEvent[]): number {
  return events.reduce((acc, e) => acc + (e.duration_ms || 0), 0);
}

export function getTopArtists(events: ListeningEvent[], limit: number = 10): TopItem[] {
  const map: Record<string, TopItem> = {};
  events.forEach((e) => {
    if (e.artist_name) {
      if (!map[e.artist_name]) map[e.artist_name] = { name: e.artist_name, count: 0, listened_ms: 0 };
      map[e.artist_name].count += 1;
      map[e.artist_name].listened_ms += (e.duration_ms || 0);
    }
  });
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function getTopSongs(events: ListeningEvent[], limit: number = 10): TopItem[] {
  const map: Record<string, TopItem> = {};
  events.forEach((e) => {
    if (e.song_title) {
      const key = `${e.song_title} - ${e.artist_name}`;
      if (!map[key]) map[key] = { name: key, count: 0, listened_ms: 0 };
      map[key].count += 1;
      map[key].listened_ms += (e.duration_ms || 0);
    }
  });
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function getTopGenres(events: ListeningEvent[], limit: number = 5): TopItem[] {
  const map: Record<string, TopItem> = {};
  events.forEach((e) => {
    if (e.genre) {
      if (!map[e.genre]) map[e.genre] = { name: e.genre, count: 0, listened_ms: 0 };
      map[e.genre].count += 1;
      map[e.genre].listened_ms += (e.duration_ms || 0);
    }
  });
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function getListeningHabits(events: ListeningEvent[]): number[] {
  // Returns an array of 24 numbers representing plays per hour of the day
  const hours = new Array(24).fill(0);
  events.forEach((e) => {
    const date = new Date(e.played_at + 'Z');
    const hour = date.getHours();
    if (!isNaN(hour) && hour >= 0 && hour < 24) {
      hours[hour]++;
    }
  });
  return hours;
}

export function getListeningTimeByPeriod(events: ListeningEvent[], period: 'day' | 'week' | 'month'): { label: string, ms: number }[] {
  const map: Record<string, number> = {};
  events.forEach(e => {
    const d = new Date(e.played_at + 'Z');
    if (isNaN(d.getTime())) return;
    let key = '';
    
    if (period === 'day') {
      // YYYY-MM-DD
      key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    } else if (period === 'month') {
      key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
    } else if (period === 'week') {
      // Get week start (Sunday)
      const dateCopy = new Date(d);
      dateCopy.setDate(d.getDate() - d.getDay());
      key = `${dateCopy.getFullYear()}-${(dateCopy.getMonth()+1).toString().padStart(2, '0')}-${dateCopy.getDate().toString().padStart(2, '0')}`;
    }
    
    map[key] = (map[key] || 0) + (e.duration_ms || 0);
  });
  
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, ms]) => ({ label, ms }));
}

export function generateMockListeningEvents(
  libraryTracks: { title?: string | null; artist?: string | null; album?: string | null; genre?: string | null }[] = []
): ListeningEvent[] {
  const now = Date.now();
  const sampleArtists = [
    { artist: 'Daft Punk', song: 'Get Lucky', album: 'Random Access Memories', genre: 'Electronic' },
    { artist: 'Porter Robinson', song: 'Shelter', album: 'Worlds', genre: 'Synthwave' },
    { artist: 'Tycho', song: 'Awake', album: 'Awake', genre: 'Ambient' },
    { artist: 'CHVRCHES', song: 'The Mother We Share', album: 'The Bones of What You Believe', genre: 'Synthpop' },
    { artist: 'Hans Zimmer', song: 'Time', album: 'Inception OST', genre: 'Soundtrack' },
    { artist: 'Kendrick Lamar', song: 'DNA.', album: 'DAMN.', genre: 'Hip-Hop' },
    { artist: 'Fleetwood Mac', song: 'Dreams', album: 'Rumours', genre: 'Rock' },
    { artist: 'Kavinsky', song: 'Nightcall', album: 'OutRun', genre: 'Synthwave' },
    { artist: 'M83', song: 'Midnight City', album: "Hurry Up, We're Dreaming", genre: 'Electronic' },
  ];

  const pool = libraryTracks && libraryTracks.length >= 3
    ? libraryTracks.map((t) => ({
        artist: t.artist || 'Unknown Artist',
        song: t.title || 'Untitled Track',
        album: t.album || 'Unknown Album',
        genre: t.genre || 'Electronic',
      }))
    : sampleArtists;

  const mock: ListeningEvent[] = [];
  for (let i = 0; i < 120; i++) {
    const item = pool[i % pool.length];
    const dayOffset = Math.floor(Math.random() * 28);
    const hour = Math.random() < 0.75 
      ? 14 + Math.floor(Math.random() * 9) 
      : 8 + Math.floor(Math.random() * 6);
    const minute = Math.floor(Math.random() * 60);
    const eventDate = new Date(now - dayOffset * 86400000);
    eventDate.setHours(hour, minute, Math.floor(Math.random() * 60));

    const yyyy = eventDate.getFullYear();
    const mm = String(eventDate.getMonth() + 1).padStart(2, '0');
    const dd = String(eventDate.getDate()).padStart(2, '0');
    const hh = String(eventDate.getHours()).padStart(2, '0');
    const min = String(eventDate.getMinutes()).padStart(2, '0');
    const ss = String(eventDate.getSeconds()).padStart(2, '0');

    mock.push({
      id: i + 1,
      song_title: item.song,
      artist_name: item.artist,
      album_name: item.album || null,
      genre: item.genre || 'Electronic',
      duration_ms: Math.floor(180000 + Math.random() * 140000),
      played_at: `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`,
    });
  }

  return mock.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
}
