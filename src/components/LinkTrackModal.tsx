import React, { useState, useMemo } from 'react';
import { usePlayerStore, getLinkedChainTracks } from '../store/usePlayerStore';
import { Track } from '../types/player';
import {
  X,
  Search,
  Link2,
  Music,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Play,
  Trash2,
  ArrowLeftRight,
  Plus,
} from 'lucide-react';
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
  const reorderLinkedChain = usePlayerStore((s) => s.reorderLinkedChain);
  const addTrackToChain = usePlayerStore((s) => s.addTrackToChain);
  const removeTrackFromChain = usePlayerStore((s) => s.removeTrackFromChain);
  const reverseChain = usePlayerStore((s) => s.reverseChain);
  const playLinkedSuite = usePlayerStore((s) => s.playLinkedSuite);

  const [query, setQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Active suite chain
  const linkedChain = useMemo(() => {
    if (!linkModalTrack) return [];
    return getLinkedChainTracks(linkModalTrack.id, linkedTracks, tracks);
  }, [linkModalTrack, linkedTracks, tracks]);

  const isSuiteLinked = linkedChain.length > 1;

  const totalSuiteDuration = useMemo(() => {
    return linkedChain.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
  }, [linkedChain]);

  const availableTracks = useMemo(() => {
    if (!linkModalTrack) return [];
    const chainIds = new Set(linkedChain.map((t) => t.id));
    const q = query.trim().toLowerCase();

    return tracks
      .filter((t) => !chainIds.has(t.id))
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
        );
      });
  }, [tracks, linkModalTrack, linkedChain, query]);

  if (!linkModalTrack) return null;

  const handleMoveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= linkedChain.length) return;
    const updated = [...linkedChain];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    reorderLinkedChain(updated.map((t) => t.id));
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    handleMoveItem(draggedIndex, targetIdx);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
      onClick={() => setLinkModalTrack(null)}
    >
      <div
        className="w-full max-w-xl bg-zinc-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] animate-in zoom-in-95 duration-150 text-white"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow:
            '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
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
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Linked Song Suite</h3>
                {isSuiteLinked && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                      borderColor:
                        'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                      color: 'var(--color-stop-1, #6366f1)',
                    }}
                  >
                    {linkedChain.length} Tracks • {formatDuration(totalSuiteDuration)}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Drag handles to reorder sequence, queue together when shuffling, and play gaplessly
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

        {/* Suite Controls if Linked */}
        {isSuiteLinked && (
          <div className="flex items-center justify-between gap-2 p-1.5 bg-black/40 rounded-xl border border-white/10 text-xs">
            <span className="text-[11px] font-medium text-zinc-400 pl-2">
              Suite playback sequence (top to bottom):
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => playLinkedSuite(linkModalTrack.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-white transition-all shadow-sm cursor-pointer"
                style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play Suite</span>
              </button>
              <button
                type="button"
                onClick={() => reverseChain(linkModalTrack.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Reverse</span>
              </button>
            </div>
          </div>
        )}

        {/* Current Linked Sequence with Drag Handles */}
        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
          {linkedChain.map((chainTrack, idx) => {
            const isAnchor = chainTrack.id === linkModalTrack.id;
            const isDragging = draggedIndex === idx;
            const isOver = dragOverIndex === idx;

            return (
              <div
                key={chainTrack.id}
                draggable={isSuiteLinked}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(idx));
                  setDraggedIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`group p-2.5 rounded-xl flex items-center justify-between gap-3 transition-all ${
                  isAnchor
                    ? 'bg-white/10 border-2'
                    : 'bg-white/5 border hover:bg-white/[0.08]'
                } ${
                  isDragging
                    ? 'opacity-40 scale-95 border-dashed'
                    : ''
                }`}
                style={{
                  borderColor: isAnchor
                    ? 'var(--color-stop-1, #6366f1)'
                    : isOver || isDragging
                    ? 'var(--color-stop-1, #6366f1)'
                    : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isAnchor
                    ? '0 0 14px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)'
                    : isOver
                    ? '0 0 10px color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)'
                    : undefined,
                }}
              >
                <div className="flex items-center gap-2 shrink-0">
                  {isSuiteLinked && (
                    <div
                      className="p-1 rounded-md text-zinc-500 group-hover:text-zinc-300 cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}
                  <span
                    className="text-xs font-mono font-bold w-5 h-5 rounded flex items-center justify-center border shrink-0"
                    style={
                      isAnchor
                        ? {
                            backgroundColor: 'var(--color-stop-1, #6366f1)',
                            borderColor: 'var(--color-stop-1, #6366f1)',
                            color: '#fff',
                          }
                        : {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#cbd5e1',
                          }
                    }
                  >
                    {idx + 1}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                  <TrackRowArt track={chainTrack} />
                  <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                    <span className="text-xs font-bold text-white truncate">{chainTrack.title}</span>
                    <span className="text-[11px] text-zinc-400 truncate">
                      {chainTrack.artist} {chainTrack.album ? `• ${chainTrack.album}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-mono text-zinc-500 mr-1">
                    {formatDuration(chainTrack.duration_secs)}
                  </span>
                  {isSuiteLinked && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveItem(idx, idx - 1)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === linkedChain.length - 1}
                        onClick={() => handleMoveItem(idx, idx + 1)}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTrackFromChain(chainTrack.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
                        title="Remove track from suite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Search Input for adding more songs to the suite */}
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
            Add Another Song to Suite
          </span>
          <div className="relative w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search library tracks to add..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
              style={{
                borderColor: query.trim()
                  ? 'var(--color-stop-1, #6366f1)'
                  : 'rgba(255, 255, 255, 0.1)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-stop-1, #6366f1)';
                e.currentTarget.style.boxShadow =
                  '0 0 12px color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = query.trim()
                  ? 'var(--color-stop-1, #6366f1)'
                  : 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.boxShadow = '';
              }}
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
        </div>

        {/* Matching Track List */}
        <div className="flex-1 overflow-y-auto max-h-52 custom-scrollbar flex flex-col gap-1 pr-1">
          {availableTracks.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs italic">
              {query ? 'No matching tracks found' : 'Type above to search library'}
            </div>
          ) : (
            availableTracks.slice(0, 30).map((track) => {
              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2 rounded-xl transition-colors hover:bg-white/10 text-left group w-full"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <TrackRowArt track={track} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white truncate group-hover:underline transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {formatDuration(track.duration_secs)}
                    </span>

                    {isSuiteLinked ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            addTrackToChain(linkModalTrack.id, track.id, 'start');
                            setQuery('');
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer"
                          title="Add to beginning of suite (#1)"
                        >
                          + Start
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addTrackToChain(linkModalTrack.id, track.id, 'end');
                            setQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                          style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                          title="Add to end of suite"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ End</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            addTrackToChain(linkModalTrack.id, track.id, 'before');
                            setQuery('');
                          }}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer"
                        >
                          Play Before
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addTrackToChain(linkModalTrack.id, track.id, 'after');
                            setQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                          style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                        >
                          Play After
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
