import React from 'react';
import { Home, Search, Library } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export const MobileBottomNav: React.FC = () => {
  const activeTab = usePlayerStore((s) => s.activeTab);
  const setActiveTab = usePlayerStore((s) => s.setActiveTab);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-lg border-t border-zinc-900 flex justify-around items-center z-50">
      <button
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center justify-center w-20 h-full ${
          activeTab === 'home' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Home size={24} className="mb-1" />
        <span className="text-[10px] font-medium">Home</span>
      </button>
      
      <button
        onClick={() => setActiveTab('search')}
        className={`flex flex-col items-center justify-center w-20 h-full ${
          activeTab === 'search' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Search size={24} className="mb-1" />
        <span className="text-[10px] font-medium">Search</span>
      </button>

      <button
        onClick={() => setActiveTab('library')}
        className={`flex flex-col items-center justify-center w-20 h-full ${
          activeTab === 'library' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Library size={24} className="mb-1" />
        <span className="text-[10px] font-medium">Your Library</span>
      </button>
    </div>
  );
};
