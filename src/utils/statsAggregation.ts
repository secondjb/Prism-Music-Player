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
