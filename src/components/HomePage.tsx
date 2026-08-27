import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackList } from './TrackList';

export const HomePage: React.FC = () => {
  const tracks = usePlayerStore((s) => s.tracks);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32">
      <h1 className="text-2xl font-bold p-4 mt-2">Good afternoon</h1>
      <div className="px-4">
        <TrackList tracks={tracks} />
      </div>
    </div>
  );
};
