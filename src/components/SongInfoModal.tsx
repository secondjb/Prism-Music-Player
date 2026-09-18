import React, { useEffect, useState, useMemo } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { Track } from '../types/player';
import { X, Music, Info, Globe, ShieldAlert, ExternalLink, HardDrive, FileText, Link2, ArrowLeftRight, Plus, Trash2, Search } from 'lucide-react';

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
  const linkTracks = usePlayerStore((s) => s.linkTracks);
  const removeLink = usePlayerStore((s) => s.removeLink);
  const reverseLinkOrder = usePlayerStore((s) => s.reverseLinkOrder);
  const tracks = usePlayerStore((s) => s.tracks);

  const [onlineData, setOnlineData] = useState<ITunesResult | null>(null);
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // Embedded Song Linking Search & Add state
  const [searchQuery, setSearchQuery] = useState('');
  const [linkDirection, setLinkDirection] = useState<'after' | 'before'>('after');
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);

  const trackArt = useTrackArt(infoModalTrack);

  useEffect(() => {
    if (!infoModalTrack) {
      setOnlineData(null);
      setOnlineError(null);
      setSearchQuery('');
      setLinkSuccessMsg(null);
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

  const tracksPlayingAfter = useMemo(() => {
    if (!infoModalTrack) return [];
    const nextIds = linkedTracks[infoModalTrack.id] || [];
    return nextIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
  }, [infoModalTrack, linkedTracks, tracks]);

  const tracksPlayingBefore = useMemo(() => {
    if (!infoModalTrack) return [];
    const prevIds = Object.keys(linkedTracks).filter((srcId) => linkedTracks[srcId]?.includes(infoModalTrack.id));
    return prevIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
  }, [infoModalTrack, linkedTracks, tracks]);

  if (!infoModalTrack) return null;

  const highResArt = onlineData?.artworkUrl100
    ? onlineData.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
    : null;

  const displayArt = trackArt || highResArt; // Prioritize local PC art first

  return (
    <div className="w-full h-full overflow-y-auto animate-fade-in text-zinc-100 flex flex-col custom-scrollbar pr-2">
      {/* Top Header */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Track Metadata & Info</h3>
            <p className="text-sm text-zinc-400 truncate max-w-xl">{infoModalTrack.title}</p>
          </div>
        </div>
        <button
          onClick={() => setInfoModalTrack(null)}
          className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto py-8 flex flex-col lg:flex-row gap-12 items-start">
        {/* Left Side: Huge Cover Art & Basic Info */}
        <div className="w-full lg:w-[450px] shrink-0 flex flex-col gap-6">
          <div className="w-full aspect-square rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl relative">
            {displayArt ? (
              <img
                src={displayArt}
                alt={infoModalTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-900/20">
                <Music className="w-32 h-32 text-indigo-400/50" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-4xl font-black text-white drop-shadow-sm">{infoModalTrack.title}</h2>
            <p 
              className="text-2xl font-bold text-indigo-400 mt-1 cursor-pointer hover:underline"
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
              className="text-lg text-zinc-400 mt-2 cursor-pointer hover:underline hover:text-indigo-400"
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

          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm font-mono text-zinc-300">
            {infoModalTrack.bit_rate_kbps && (
              <span className="px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold">
                {infoModalTrack.bit_rate_kbps} kbps
              </span>
            )}
            {infoModalTrack.sample_rate && (
              <span className="px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold">
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
        <div className="flex-1 w-full flex flex-col gap-8">
          {/* Local Audio File Specs */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-indigo-400 border-b border-white/10 pb-3">
              <HardDrive className="w-6 h-6" />
              <h3 className="text-lg font-bold">Local File Technical Specs & ID3 Tags</h3>
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
                <span className="text-xl font-mono text-indigo-300 font-bold">{infoModalTrack.key || 'N/A'}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">BPM (Beats Per Minute)</span>
                <span className="text-xl font-mono text-purple-300 font-bold">
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
                  <h3 className="text-lg font-bold text-white">Linked Songs & Segue Sequences</h3>
                  <p className="text-xs text-zinc-400">
                    Continuous multi-track suites that queue together when shuffling and transition gaplessly
                  </p>
                </div>
              </div>
            </div>

            {/* Embedded Song Search & Link Creation Box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  Search & Link Another Track
                </span>
                
                {/* Direction Toggle */}
                <div className="flex items-center p-0.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setLinkDirection('after')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      linkDirection === 'after'
                        ? 'text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    style={linkDirection === 'after' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                  >
                    Play After
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkDirection('before')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      linkDirection === 'before'
                        ? 'text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    style={linkDirection === 'before' ? { backgroundColor: 'var(--color-stop-1, #6366f1)' } : undefined}
                  >
                    Play Before
                  </button>
                </div>
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
                  placeholder="Type song title, artist, or album to search & link..."
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
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-in fade-in">
                  {linkSuccessMsg}
                </div>
              )}

              {/* Real-time Matching Search Results */}
              {searchQuery.trim() && (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1 pt-1">
                  {candidateTracks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">
                      No tracks found matching "{searchQuery}"
                    </div>
                  ) : (
                    candidateTracks.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="p-2.5 rounded-xl bg-black/30 border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <LinkedTrackThumbnail track={candidate} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-white truncate">{candidate.title}</span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {candidate.artist} {candidate.album ? `• ${candidate.album}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono text-zinc-500">{formatDuration(candidate.duration_secs)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (linkDirection === 'after') {
                                linkTracks(infoModalTrack.id, candidate.id);
                                setLinkSuccessMsg(`Linked: "${infoModalTrack.title}" will now play into "${candidate.title}".`);
                              } else {
                                linkTracks(candidate.id, infoModalTrack.id);
                                setLinkSuccessMsg(`Linked: "${candidate.title}" will now play into "${infoModalTrack.title}".`);
                              }
                              setSearchQuery('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                            style={{ backgroundColor: 'var(--color-stop-1, #6366f1)' }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Link ({linkDirection === 'after' ? 'After' : 'Before'})</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Currently Linked Songs List */}
            {tracksPlayingBefore.length === 0 && tracksPlayingAfter.length === 0 ? (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-1.5 text-center text-zinc-400">
                <Link2 className="w-6 h-6 text-zinc-600 mb-0.5" />
                <span className="text-xs font-medium text-zinc-300">No songs currently linked to this track</span>
                <span className="text-[11px] text-zinc-500 max-w-sm">
                  Use the search box above to link tracks so they queue together when shuffling and play gaplessly.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Songs playing before this track */}
                {tracksPlayingBefore.map((prevTrack) => (
                  <div
                    key={`prev-${prevTrack.id}`}
                    className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                      onClick={() => setInfoModalTrack(prevTrack)}
                      title="Click to view details for this track"
                    >
                      <LinkedTrackThumbnail track={prevTrack} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Plays Before
                          </span>
                          <span className="text-sm font-bold text-white truncate group-hover:underline group-hover:text-indigo-300 transition-colors">
                            {prevTrack.title}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 truncate mt-0.5">
                          {prevTrack.artist} {prevTrack.album ? `• ${prevTrack.album}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => reverseLinkOrder(prevTrack.id, infoModalTrack.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Reverse order (play this track before linked track)"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(prevTrack.id, infoModalTrack.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Songs playing after this track */}
                {tracksPlayingAfter.map((nextTrack, idx) => (
                  <div
                    key={`next-${nextTrack.id}`}
                    className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                      onClick={() => setInfoModalTrack(nextTrack)}
                      title="Click to view details for this track"
                    >
                      <LinkedTrackThumbnail track={nextTrack} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
                              borderColor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                              color: 'var(--color-stop-1, #6366f1)',
                            }}
                          >
                            Plays After (#{idx + 1})
                          </span>
                          <span className="text-sm font-bold text-white truncate group-hover:underline group-hover:text-indigo-300 transition-colors">
                            {nextTrack.title}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 truncate mt-0.5">
                          {nextTrack.artist} {nextTrack.album ? `• ${nextTrack.album}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => reverseLinkOrder(infoModalTrack.id, nextTrack.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Reverse order (play linked track before this track)"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLink(infoModalTrack.id, nextTrack.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>


          {/* iTunes API Info */}
          <section className="flex flex-col gap-4 mt-4">
            <div className="flex items-center gap-3 text-purple-400 border-b border-white/10 pb-3">
              <Globe className="w-6 h-6" />
              <h3 className="text-lg font-bold">Public Release API Info (iTunes)</h3>
            </div>

            {isLoadingOnline ? (
              <div className="flex items-center gap-4 text-zinc-400 p-8">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold transition-colors border border-purple-500/30"
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
