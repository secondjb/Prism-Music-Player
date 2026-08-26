import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackArt } from '../utils/useTrackArt';
import { X, Music, Info, Globe, Disc, ShieldAlert, ExternalLink, HardDrive, FileText, Activity } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'local' | 'online'>('local');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl glass-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Track Metadata & Info</h3>
              <p className="text-xs text-zinc-400 truncate max-w-xs">{infoModalTrack.title}</p>
            </div>
          </div>
          <button
            onClick={() => setInfoModalTrack(null)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Hero Banner */}
        <div className="flex items-center gap-5 px-6 py-5 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-transparent border-b border-white/5">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0 shadow-lg relative">
            {highResArt || trackArt ? (
              <img
                src={highResArt || trackArt!}
                alt={infoModalTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-900/40">
                <Music className="w-10 h-10 text-indigo-400" />
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-xl font-bold text-white truncate">{infoModalTrack.title}</h2>
            <p className="text-sm font-semibold text-indigo-300 truncate mt-0.5">{infoModalTrack.artist}</p>
            <p className="text-xs text-zinc-400 truncate mt-1">{infoModalTrack.album || 'Unknown Album'}</p>

            <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-zinc-400">
              {infoModalTrack.bit_rate_kbps && (
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                  {infoModalTrack.bit_rate_kbps} kbps
                </span>
              )}
              {infoModalTrack.sample_rate && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  {(infoModalTrack.sample_rate / 1000).toFixed(1)} kHz
                </span>
              )}
              {infoModalTrack.bit_depth && (
                <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10">
                  {infoModalTrack.bit_depth}-bit
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/5 px-6">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'local'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Local Technical Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('online')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'online'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Public API Info (iTunes)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'local' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Music className="w-3.5 h-3.5" /> Track Info
                </h4>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Title:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">{infoModalTrack.title}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Artist:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">{infoModalTrack.artist}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Album:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">{infoModalTrack.album || 'N/A'}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Audio Quality & Specs
                </h4>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Bitrate:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {infoModalTrack.bit_rate_kbps ? `${infoModalTrack.bit_rate_kbps} kbps` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Sample Rate:</span>
                  <span className="font-mono font-bold text-purple-300">
                    {infoModalTrack.sample_rate ? `${infoModalTrack.sample_rate} Hz` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Bit Depth:</span>
                  <span className="font-mono text-white">
                    {infoModalTrack.bit_depth ? `${infoModalTrack.bit_depth}-bit` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Channels:</span>
                  <span className="font-mono text-white">
                    {infoModalTrack.channels ? `${infoModalTrack.channels} ch` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Duration:</span>
                  <span className="font-mono text-white">{formatDuration(infoModalTrack.duration_secs)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">ReplayGain:</span>
                  <span className="font-mono text-white">
                    {typeof infoModalTrack.replay_gain_db === 'number'
                      ? `${infoModalTrack.replay_gain_db > 0 ? '+' : ''}${infoModalTrack.replay_gain_db.toFixed(2)} dB`
                      : 'None'}
                  </span>
                </div>
              </div>

              <div className="md:col-span-2 p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> File Path
                </h4>
                <p className="text-xs font-mono text-zinc-300 bg-black/40 p-2.5 rounded-lg break-all border border-white/5 select-all">
                  {infoModalTrack.path}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isLoadingOnline ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Fetching online metadata from iTunes...</span>
                </div>
              ) : onlineError ? (
                <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                  <ShieldAlert className="w-8 h-8 text-amber-400" />
                  <span>{onlineError}</span>
                </div>
              ) : onlineData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                      <Disc className="w-3.5 h-3.5" /> Release Metadata
                    </h4>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">iTunes Title:</span>
                      <span className="font-semibold text-white truncate max-w-[170px]">{onlineData.trackName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Artist:</span>
                      <span className="font-semibold text-white truncate max-w-[170px]">{onlineData.artistName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Collection:</span>
                      <span className="font-semibold text-white truncate max-w-[170px]">
                        {onlineData.collectionName || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Release Date:</span>
                      <span className="font-semibold text-white">
                        {onlineData.releaseDate ? new Date(onlineData.releaseDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Primary Genre:</span>
                      <span className="font-semibold text-indigo-300">{onlineData.primaryGenreName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Content Rating:</span>
                      <span
                        className={`font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                          onlineData.trackExplicitness === 'explicit'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {onlineData.trackExplicitness || 'Clean'}
                      </span>
                    </div>
                  </div>

                  {highResArt && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center gap-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider self-start">
                        High-Res iTunes Cover
                      </h4>
                      <img src={highResArt} alt="High Res Artwork" className="w-36 h-36 rounded-xl shadow-lg object-cover" />
                      {onlineData.trackViewUrl && (
                        <a
                          href={onlineData.trackViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
                        >
                          <span>Open on Apple Music</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
