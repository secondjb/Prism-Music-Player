import React from 'react';
import { Search } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackList } from './TrackList';

const CATEGORIES = [
  { id: '1', name: 'Pop', color: 'bg-pink-500' },
  { id: '2', name: 'Hip-Hop', color: 'bg-orange-500' },
  { id: '3', name: 'Podcasts', color: 'bg-green-600' },
  { id: '4', name: 'Rock', color: 'bg-red-600' },
  { id: '5', name: 'Jazz', color: 'bg-blue-600' },
  { id: '6', name: 'Classical', color: 'bg-purple-600' },
  { id: '7', name: 'Electronic', color: 'bg-teal-500' },
  { id: '8', name: 'R&B', color: 'bg-indigo-600' },
];

export const SearchPage: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const tracks = usePlayerStore((s) => s.tracks);

  const filteredTracks = tracks.filter((t) => {
    return (
      searchQuery &&
      (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32">
      <div className="sticky top-0 z-10 bg-black/95 p-4 pt-6">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            placeholder="What do you want to listen to?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-black rounded-sm py-3 pl-10 pr-4 font-medium focus:outline-none"
          />
        </div>
      </div>

      <div className="px-4 mt-2">
        {searchQuery ? (
          <div>
            <h2 className="text-lg font-bold mb-4">Top Results</h2>
            <TrackList tracks={filteredTracks} />
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-bold mb-4">Browse All</h2>
            <div className="grid grid-cols-2 gap-4">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className={`${cat.color} rounded-md p-3 h-24 relative overflow-hidden`}
                >
                  <span className="font-bold text-white text-sm">{cat.name}</span>
                  {/* Fake angled image block */}
                  <div className="absolute -bottom-2 -right-4 w-16 h-16 bg-black/20 rotate-[25deg] rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
