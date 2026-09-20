import React, { useEffect, useState, useMemo } from 'react';
import { usePlayerStore, getLinkedChainTracks } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import {
  X,
  Music,
  Info,
  Globe,
  ShieldAlert,
  ExternalLink,
  HardDrive,
  FileText,
  Link2,
  ArrowLeftRight,
  Plus,
  Trash2,
  Search,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Play,
  Unlink,
  Check,
} from 'lucide-react';

const LinkedTrackThumbnail: React.FC<{ track: Track }> = ({ track }) => {
  const art = useTrackArt(track);
  if (art) {
    return <img src={art} alt={track.title} className="w-10 h-10 rounded-xl object-cover shrink-0" />;
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
      <Music className="w-4 h-4" />
    </div>
  );
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface ITunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackExplicitness?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
}

export const SongInfoModal: React.FC = () => {
  const infoModalTrack = usePlayerStore((s) => s.infoModalTrack);
  const setInfoModalTrack = usePlayerStore((s) => s.setInfoModalTrack);
  const linkedTracks = usePlayerStore((s) => s.linkedTracks);
  const reorderLinkedChain = usePlayerStore((s) => s.reorderLinkedChain);
  const addTrackToChain = usePlayerStore((s) => s.addTrackToChain);
  const removeTrackFromChain = usePlayerStore((s) => s.removeTrackFromChain);
  const reverseChain = usePlayerStore((s) => s.reverseChain);
  const unlinkChain = usePlayerStore((s) => s.unlinkChain);
  const playLinkedSuite = usePlayerStore((s) => s.playLinkedSuite);
  const tracks = usePlayerStore((s) => s.tracks);

  const [onlineData, setOnlineData] = useState<ITunesResult | null>(null);
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // Embedded Song Linking Search & Add state
  const [searchQuery, setSearchQuery] = useState('');
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);

  // Drag-and-drop state for linked sequence
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const trackArt = useTrackArt(infoModalTrack);

  useEffect(() => {
    if (!infoModalTrack) {
      setOnlineData(null);
      setOnlineError(null);
      setSearchQuery('');
      setLinkSuccessMsg(null);
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const fetchOnlineMetadata = async () => {
      setIsLoadingOnline(true);
      setOnlineError(null);
      try {
        const query = `${infoModalTrack.artist} ${infoModalTrack.title}`;
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
        if (!res.ok) throw new Error('Failed to fetch from iTunes API');
        const json = await res.json();
        if (json.results && json.results.length > 0) {
          setOnlineData(json.results[0]);
        } else {
          setOnlineData(null);
          setOnlineError('No matching track found on iTunes database.');
        }
      } catch (err: any) {
        setOnlineError('Network error or API unavailable.');
      } finally {
        setIsLoadingOnline(false);
      }
    };

    fetchOnlineMetadata();
  }, [infoModalTrack]);

  const candidateTracks = useMemo(() => {
    if (!infoModalTrack || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return tracks
      .filter((t) => t.id !== infoModalTrack.id)
      .filter((t) => {
        return (
          t.title.toLowerCase().includes(q) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [tracks, infoModalTrack, searchQuery]);

  // Full ordered chain of tracks in this suite
  const linkedChain = useMemo(() => {
    if (!infoModalTrack) return [];
    return getLinkedChainTracks(infoModalTrack.id, linkedTracks, tracks);
  }, [infoModalTrack, linkedTracks, tracks]);

  const isSuiteLinked = linkedChain.length > 1;

  const totalSuiteDuration = useMemo(() => {
    return linkedChain.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
  }, [linkedChain]);

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

  if (!infoModalTrack) return null;

  const highResArt = onlineData?.artworkUrl100
    ? onlineData.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
    : null;

  const displayArt = trackArt || highResArt; // Prioritize local PC art first

  return (
    <div className="w-full h-full overflow-y-auto animate-fade-in text-zinc-100 flex flex-col custom-scrollbar pr-2">
      {/* Top Header */}
      <div className="flex items-center justify-between py-2 shrink-0 border-b border-white/10 pb-4 mb-2">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl border flex items-center justify-center shadow-lg shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Track Metadata & Info</h3>
            <p className="text-xs text-zinc-400 truncate max-w-xl">{infoModalTrack.title}</p>
          </div>
        </div>
        <button
          onClick={() => setInfoModalTrack(null)}
          className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Back / Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto py-6 flex flex-col lg:flex-row gap-10 items-start">
        {/* Left Side: Huge Cover Art & Basic Info */}
        <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6">
          <div className="w-full aspect-square rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl relative">
            {displayArt ? (
              <img
                src={displayArt}
                alt={infoModalTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)' }}
              >
                <Music className="w-32 h-32" style={{ color: 'var(--color-stop-1, #6366f1)', opacity: 0.5 }} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-3xl lg:text-4xl font-black text-white drop-shadow-sm truncate">{infoModalTrack.title}</h2>
            <p 
              className="text-xl lg:text-2xl font-bold mt-1 cursor-pointer hover:underline truncate"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
              onClick={() => {
                if (infoModalTrack.artist && infoModalTrack.artist !== 'Unknown Artist') {
                  usePlayerStore.getState().navigateToArtist(infoModalTrack.artist);
                  setInfoModalTrack(null);
                }
              }}
            >
              {infoModalTrack.artist}
            </p>
            <p 
              className="text-base text-zinc-400 mt-1 cursor-pointer hover:underline hover:text-white truncate"
              onClick={() => {
                if (infoModalTrack.album && infoModalTrack.album !== 'Unknown Album') {
                  usePlayerStore.getState().navigateToAlbum(infoModalTrack.album);
                  setInfoModalTrack(null);
                }
              }}
            >
              {infoModalTrack.album || 'Unknown Album'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-mono text-zinc-300">
            {infoModalTrack.bit_rate_kbps && (
              <span
                className="px-3 py-1 rounded-lg border font-bold"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                  color: 'var(--color-stop-1, #6366f1)',
                }}
              >
                {infoModalTrack.bit_rate_kbps} kbps
              </span>
            )}
            {infoModalTrack.sample_rate && (
              <span
                className="px-3 py-1 rounded-lg border font-bold"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 20%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-stop-3, #ec4899) 40%, transparent)',
                  color: 'var(--color-stop-3, #ec4899)',
                }}
              >
                {(infoModalTrack.sample_rate / 1000).toFixed(1)} kHz
              </span>
            )}
            {infoModalTrack.bit_depth && (
              <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10">
                {infoModalTrack.bit_depth}-bit
              </span>
            )}
            {infoModalTrack.channels && (
              <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10">
                {infoModalTrack.channels} ch
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Metadata Grid */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-8">
          {/* Local Audio File Specs */}
          <section className="flex flex-col gap-4">
            <div
              className="flex items-center gap-3 border-b border-white/10 pb-3"
              style={{ color: 'var(--color-stop-1, #6366f1)' }}
            >
              <HardDrive className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Local File Technical Specs & ID3 Tags</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Local Genre</span>
                <span className="text-xl font-medium text-white">{infoModalTrack.genre || 'N/A'}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Local Release Year / Date</span>
                <span className="text-xl font-mono text-white">
                  {infoModalTrack.date || (infoModalTrack.year ? String(infoModalTrack.year) : 'N/A')}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Musical Key</span>
                <span className="text-xl font-mono font-bold" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                  {infoModalTrack.key || 'N/A'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">BPM (Beats Per Minute)</span>
                <span className="text-xl font-mono font-bold" style={{ color: 'var(--color-stop-3, #ec4899)' }}>
                  {infoModalTrack.bpm ? `${infoModalTrack.bpm} BPM` : 'N/A'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Duration</span>
                <span className="text-xl font-mono text-white">{formatDuration(infoModalTrack.duration_secs)}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">ReplayGain (Track / Album)</span>
                <span className="text-xl font-mono text-white">
                  {typeof infoModalTrack.replay_gain_db === 'number'
                    ? `${infoModalTrack.replay_gain_db > 0 ? '+' : ''}${infoModalTrack.replay_gain_db.toFixed(2)} dB`
                    : (typeof infoModalTrack.replay_gain_album_db === 'number' ? 'None (Track)' : 'None')}
                  {typeof infoModalTrack.replay_gain_album_db === 'number' && (
                    <span className="text-sm text-zinc-400 ml-2 font-normal">
                      [Album: {infoModalTrack.replay_gain_album_db > 0 ? '+' : ''}${infoModalTrack.replay_gain_album_db.toFixed(2)} dB]
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> Full File Path
              </span>
              <p className="text-sm font-mono text-zinc-300 bg-black/40 p-4 rounded-xl break-all border border-white/5 select-all">
                {infoModalTrack.path}
              </p>
            </div>
          </section>

          {/* Linked Songs & Segue Sequences */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3" style={{ color: 'var(--color-stop-1, #6366f1)' }}>
                <Link2 className="w-6 h-6" />
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-white">Linked Song Suite / Multi-Track Sequence</h3>
                    {isSuiteLinked && (
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-sm"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                          color: 'var(--color-stop-1, #6366f1)',
                        }}
                      >
                        {linkedChain.length} Tracks • {formatDuration(totalSuiteDuration)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Chains can be as long as you want. Drag handles to reorder sequence, queue together when shuffling, and play gaplessly.
                  </p>
                </div>
              </div>

              {isSuiteLinked && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => playLinkedSuite(infoModalTrack.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                    title="Play this linked suite from the beginning"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Suite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => reverseChain(infoModalTrack.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                    title="Reverse the entire suite order"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Reverse Suite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => unlinkChain(infoModalTrack.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
                    title="Unlink all tracks in this suite"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Unlink All</span>
                  </button>
                </div>
              )}
            </div>

            {/* Current Suite Ordered List with Drag Handles */}
            {isSuiteLinked ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Sequential Playback Order (Drag handles or use arrows to rearrange)
                </span>

                <div className="flex flex-col gap-2">
                  {linkedChain.map((chainTrack, idx) => {
                    const isViewing = chainTrack.id === infoModalTrack.id;
                    const isDragging = draggedIndex === idx;
                    const isOver = dragOverIndex === idx;

                    return (
                      <div
                        key={chainTrack.id}
                        draggable
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
                        className={`group relative p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                          isViewing
                            ? 'bg-white/10 border-2'
                            : 'bg-white/5 border hover:bg-white/[0.08]'
                        } ${
                          isDragging
                            ? 'opacity-40 scale-95 border-dashed border-indigo-400'
                            : isOver
                            ? 'border-indigo-400 ring-2 ring-indigo-400/40'
                            : isViewing
                            ? 'border-indigo-500/60 shadow-lg'
                            : 'border-white/10'
                        }`}
                      >
                        {/* Drag Handle & Step Order */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div
                            className="p-1 rounded-md text-zinc-500 group-hover:text-zinc-300 cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors"
                            title="Drag to reorder in sequence"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <span
                            className="text-xs font-mono font-bold w-6 h-6 rounded-lg flex items-center justify-center border shrink-0"
                            style={
                              isViewing
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

                        {/* Track Info */}
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer overflow-hidden"
                          onClick={() => setInfoModalTrack(chainTrack)}
                          title="Click to switch details view to this track"
                        >
                          <LinkedTrackThumbnail track={chainTrack} />
                          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`text-sm font-bold truncate ${
                                  isViewing
                                    ? 'text-indigo-300'
                                    : 'text-white group-hover:underline group-hover:text-zinc-200'
                                }`}
                              >
                                {chainTrack.title}
                              </span>
                              {isViewing && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0"
                                  style={{
                                    backgroundColor:
                                      'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                                    borderColor:
                                      'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                                    color: 'var(--color-stop-1, #6366f1)',
                                  }}
                                >
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-400 truncate mt-0.5">
                              {chainTrack.artist} {chainTrack.album ? `• ${chainTrack.album}` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Controls: Up/Down Buttons, Duration, and Remove */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-mono text-zinc-400 mr-2 hidden sm:inline">
                            {formatDuration(chainTrack.duration_secs)}
                          </span>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(idx, idx - 1)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === linkedChain.length - 1}
                            onClick={() => handleMoveItem(idx, idx + 1)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeTrackFromChain(chainTrack.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1 cursor-pointer"
                            title="Remove this track from the suite"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1.5 text-center text-zinc-400">
                <Link2 className="w-6 h-6 text-zinc-600 mb-0.5" />
                <span className="text-xs font-medium text-zinc-300">
                  No songs currently linked to this track
                </span>
                <span className="text-[11px] text-zinc-500 max-w-md">
                  Use the search box below to build a multi-song suite. You can link as many songs as you want and drag them to reorder.
                </span>
              </div>
            )}

            {/* Embedded Song Search & Add to Suite Box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 mt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  Search & Add Songs to Suite
                </span>
              </div>

              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setLinkSuccessMsg(null);
                  }}
                  placeholder="Type song title, artist, or album to search and add to this suite..."
                  className="w-full pl-10 pr-10 py-2.5 bg-black/40 rounded-xl border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-zinc-400 hover:text-white p-1 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {linkSuccessMsg && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-in fade-in flex items-center gap-2">
                  <Check className="w-3.5 h-3.5" />
                  <span>{linkSuccessMsg}</span>
                </div>
              )}

              {/* Real-time Matching Search Results */}
              {searchQuery.trim() && (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1 pt-1 max-w-full">
                  {candidateTracks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">
                      No tracks found matching "{searchQuery}"
                    </div>
                  ) : (
                    candidateTracks.map((candidate) => {
                      const isInChain = linkedChain.some((t) => t.id === candidate.id);

                      return (
                        <div
                          key={candidate.id}
                          className="p-2.5 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 transition-colors max-w-full min-w-0"
                        >
                          <div
                            className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden cursor-pointer group/cand"
                            onClick={() => setInfoModalTrack(candidate)}
                            title="Click to view details for this track"
                          >
                            <LinkedTrackThumbnail track={candidate} />
                            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                              <span className="text-xs font-bold text-white truncate block w-full group-hover/cand:underline group-hover/cand:text-indigo-300">
                                {candidate.title}
                              </span>
                              <span className="text-[11px] text-zinc-400 truncate block w-full">
                                {candidate.artist} {candidate.album ? `• ${candidate.album}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                              {formatDuration(candidate.duration_secs)}
                            </span>

                            {isInChain ? (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>In Suite</span>
                              </span>
                            ) : isSuiteLinked ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addTrackToChain(infoModalTrack.id, candidate.id, 'start');
                                    setLinkSuccessMsg(`Added "${candidate.title}" to the beginning of the suite.`);
                                    setSearchQuery('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                                  title="Add as first track in suite (#1)"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Start</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addTrackToChain(infoModalTrack.id, candidate.id, 'end');
                                    setLinkSuccessMsg(`Added "${candidate.title}" to the end of the suite.`);
                                    setSearchQuery('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                                  style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                                  title="Add as next track in suite"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Add to End</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addTrackToChain(infoModalTrack.id, candidate.id, 'before');
                                    setLinkSuccessMsg(`Linked: "${candidate.title}" will play before "${infoModalTrack.title}".`);
                                    setSearchQuery('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Play Before</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addTrackToChain(infoModalTrack.id, candidate.id, 'after');
                                    setLinkSuccessMsg(`Linked: "${infoModalTrack.title}" will play into "${candidate.title}".`);
                                    setSearchQuery('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                                  style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Play After</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </section>


          {/* iTunes API Info */}
          <section className="flex flex-col gap-4 mt-4">
            <div
              className="flex items-center gap-3 border-b border-white/10 pb-3"
              style={{ color: 'var(--color-stop-3, #ec4899)' }}
            >
              <Globe className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Public Release API Info (iTunes)</h3>
            </div>

            {isLoadingOnline ? (
              <div className="flex items-center gap-4 text-zinc-400 p-8">
                <div
                  className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-stop-1, #6366f1)', borderTopColor: 'transparent' }}
                />
                <span>Fetching online metadata...</span>
              </div>
            ) : onlineError ? (
              <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-4">
                <ShieldAlert className="w-8 h-8 shrink-0" />
                <span className="font-medium">{onlineError}</span>
              </div>
            ) : onlineData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Official Release Date</span>
                  <span className="text-lg text-white font-medium">
                    {onlineData.releaseDate ? new Date(onlineData.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                  </span>
                </div>
                
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Primary Genre</span>
                  <span className="text-lg text-white font-medium">{onlineData.primaryGenreName || 'Unknown'}</span>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Content Rating</span>
                  <div className="mt-1 flex">
                    <span
                      className={`font-bold uppercase text-xs px-3 py-1 rounded-lg ${
                        onlineData.trackExplicitness === 'explicit'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {onlineData.trackExplicitness || 'Clean'}
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Collection / Album</span>
                  <span className="text-lg text-white font-medium truncate">{onlineData.collectionName || 'Unknown'}</span>
                </div>

                {onlineData.trackViewUrl && (
                  <div className="sm:col-span-2 pt-2">
                    <a
                      href={onlineData.trackViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border shadow-md hover:brightness-110"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 45%, transparent)',
                        color: 'white',
                      }}
                    >
                      <span>Open on Apple Music</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-zinc-500 italic">No online data found.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
