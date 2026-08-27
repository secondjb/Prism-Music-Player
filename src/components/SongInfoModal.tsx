import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { X, Music, Info, Globe, ShieldAlert, ExternalLink, HardDrive, FileText } from 'lucide-react';

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

  const [onlineData, setOnlineData] = useState<ITunesResult | null>(null);
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const trackArt = useTrackArt(infoModalTrack);

  useEffect(() => {
    if (!infoModalTrack) {
      setOnlineData(null);
      setOnlineError(null);
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
            <p className="text-2xl font-bold text-indigo-400 mt-1">{infoModalTrack.artist}</p>
            <p className="text-lg text-zinc-400 mt-2">{infoModalTrack.album || 'Unknown Album'}</p>
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
                <span className="text-xl font-medium text-white">{infoModalTrack.genre || 'Not set in file'}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Local Release Year / Date</span>
                <span className="text-xl font-mono text-white">
                  {infoModalTrack.date || (infoModalTrack.year ? String(infoModalTrack.year) : 'Not set in file')}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Musical Key</span>
                <span className="text-xl font-mono text-indigo-300 font-bold">{infoModalTrack.key || 'Not tagged'}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">BPM (Beats Per Minute)</span>
                <span className="text-xl font-mono text-purple-300 font-bold">
                  {infoModalTrack.bpm ? `${infoModalTrack.bpm} BPM` : 'Not tagged'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Duration</span>
                <span className="text-xl font-mono text-white">{formatDuration(infoModalTrack.duration_secs)}</span>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">ReplayGain</span>
                <span className="text-xl font-mono text-white">
                  {typeof infoModalTrack.replay_gain_db === 'number'
                    ? `${infoModalTrack.replay_gain_db > 0 ? '+' : ''}${infoModalTrack.replay_gain_db.toFixed(2)} dB`
                    : 'None'}
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
