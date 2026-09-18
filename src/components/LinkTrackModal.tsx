import React, { useState, useMemo } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Track } from '../types/player';
import { X, Search, Link2, Music, Check, ArrowRight } from 'lucide-react';
import { useTrackArt } from '../utils/useTrackArt';

const TrackRowArt: React.FC<{ track: Track }> = ({ track }) => {
  const art = useTrackArt(track);
  if (art) {
    return <img src={art} alt={track.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
      <Music className="w-4 h-4" />
    </div>
  );
};

const formatDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const LinkTrackModal: React.FC = () => {
  const linkModalTrack = usePlayerStore((s) => s.linkModalTrack);
  const setLinkModalTrack = usePlayerStore((s) => s.setLinkModalTrack);
  const tracks = usePlayerStore((s) => s.tracks);
  const linkedTracks = usePlayerStore((s) => s.linkedTracks);
  const linkTracks = usePlayerStore((s) => s.linkTracks);

  const [query, setQuery] = useState('');
  const [linkDirection, setLinkDirection] = useState<'after' | 'before'>('after');

  const availableTracks = useMemo(() => {
    if (!linkModalTrack) return [];
    const currentId = linkModalTrack.id;
    const q = query.trim().toLowerCase();

    return tracks
      .filter((t) => t.id !== currentId)
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
        );
      });
  }, [tracks, linkModalTrack, query]);

  if (!linkModalTrack) return null;

  const currentLinkedAfter = linkedTracks[linkModalTrack.id] || [];

  const handleSelectTrack = (targetTrack: Track) => {
    if (linkDirection === 'after') {
      linkTracks(linkModalTrack.id, targetTrack.id);
    } else {
      linkTracks(targetTrack.id, linkModalTrack.id);
    }
    setLinkModalTrack(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
      onClick={() => setLinkModalTrack(null)}
    >
      <div
        className="w-full max-w-lg bg-zinc-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] animate-in zoom-in-95 duration-150 text-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl text-white shadow-md"
              style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
            >
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Link Song Pair / Suite</h3>
              <p className="text-xs text-zinc-400">
                Queues together in shuffle and plays gaplessly in sequence
              </p>
            </div>
          </div>
          <button
            onClick={() => setLinkModalTrack(null)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Anchor Track Info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <TrackRowArt track={linkModalTrack} />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-bold text-white truncate">{linkModalTrack.title}</span>
            <span className="text-xs text-zinc-400 truncate">{linkModalTrack.artist}</span>
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            Anchor Track
          </span>
        </div>

        {/* Direction Switcher */}
        <div className="flex items-center justify-between gap-2 p-1 bg-black/40 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setLinkDirection('after')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              linkDirection === 'after'
                ? 'text-white shadow-md font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
            style={
              linkDirection === 'after'
                ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                : undefined
            }
          >
            <span>Play Next</span>
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="text-zinc-200">(After current)</span>
          </button>
          <button
            type="button"
            onClick={() => setLinkDirection('before')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              linkDirection === 'before'
                ? 'text-white shadow-md font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
            style={
              linkDirection === 'before'
                ? { backgroundColor: 'var(--color-stop-1, #6366f1)' }
                : undefined
            }
          >
            <span>Play First</span>
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="text-zinc-200">(Before current)</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks in your library..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto max-h-64 custom-scrollbar flex flex-col gap-1 pr-1">
          {availableTracks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs italic">
              {query ? 'No matching tracks found' : 'No other tracks in library'}
            </div>
          ) : (
            availableTracks.slice(0, 50).map((track) => {
              const isAlreadyLinked = currentLinkedAfter.includes(track.id);

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSelectTrack(track)}
                  className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-white/10 text-left group cursor-pointer w-full"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <TrackRowArt track={track} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {formatDuration(track.duration_secs)}
                    </span>
                    {isAlreadyLinked ? (
                      <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all text-white shadow-sm"
                        style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                      >
                        Link
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
