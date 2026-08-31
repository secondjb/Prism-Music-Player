import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackList } from './TrackList';

export const HomePage: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-2 pb-2 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Good afternoon</h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">{tracks.length} tracks in library</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-1 sm:px-2 pb-20">
        <TrackList tracks={tracks} />
      </div>
    </div>
  );
};

