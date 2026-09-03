import React, { useEffect, useState, useMemo } from 'react';
import { fetchListeningEvents, ListeningEvent } from '../utils/stats';
import { 
  getTopArtists, 
  getTopSongs, 
  getTopGenres, 
  getListeningHabits, 
  getTotalListeningTime,
  getListeningTimeByPeriod,
  formatDuration,
  generateMockListeningEvents,
} from '../utils/statsAggregation';
import { usePlayerStore } from '../store/usePlayerStore';
import { BarChart2, AlertCircle, Clock, Sparkles } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const useThemeColors = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const [colors, setColors] = useState({
    stop1: '#6366F1',
    stop2: '#8B5CF6',
    stop3: '#EC4899',
    stop4: '#D946EF',
    stop5: '#3B82F6',
  });

  useEffect(() => {
    const updateColors = () => {
      const style = getComputedStyle(document.documentElement);
      setColors({
        stop1: style.getPropertyValue('--color-stop-1').trim() || '#6366F1',
        stop2: style.getPropertyValue('--color-stop-2').trim() || '#8B5CF6',
        stop3: style.getPropertyValue('--color-stop-3').trim() || '#EC4899',
        stop4: style.getPropertyValue('--color-stop-4').trim() || '#D946EF',
        stop5: style.getPropertyValue('--color-stop-5').trim() || '#3B82F6',
      });
    };

    updateColors();
    const timer = setTimeout(updateColors, 250);
    return () => clearTimeout(timer);
  }, [currentTrack?.id]);

  return colors;
};

export const StatsView: React.FC = () => {
  const [events, setEvents] = useState<ListeningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('day');
  
  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  const showDemoStats = usePlayerStore((s) => s.showDemoStats);
  const toggleShowDemoStats = usePlayerStore((s) => s.toggleShowDemoStats);
  const libraryTracks = usePlayerStore((s) => s.tracks);
  const setTab = usePlayerStore((s) => s.setActiveTab);
  const themeColors = useThemeColors();

  useEffect(() => {
    async function loadData() {
      if (showDemoStats) {
        setEvents(generateMockListeningEvents(libraryTracks));
      } else if (isStatsCollectionEnabled) {
        const data = await fetchListeningEvents();
        if (data.length === 0) {
          setEvents(generateMockListeningEvents(libraryTracks));
        } else {
          setEvents(data);
        }
      } else {
        setEvents([]);
      }
      setLoading(false);
    }
    loadData();
  }, [isStatsCollectionEnabled, showDemoStats, libraryTracks]);

  const stats = useMemo(() => {
    return {
      topArtists: getTopArtists(events, 5),
      topSongs: getTopSongs(events, 5),
      topGenres: getTopGenres(events, 5),
      listeningHabits: getListeningHabits(events),
      totalListeningTime: getTotalListeningTime(events),
      timeByPeriod: getListeningTimeByPeriod(events, timePeriod)
    };
  }, [events, timePeriod]);

  if (!isStatsCollectionEnabled && !showDemoStats) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-zinc-500 mb-2" />
        <h2 className="text-xl font-bold text-white">Statistics Disabled</h2>
        <p className="text-sm text-zinc-400 max-w-sm">
          Listening statistics are currently disabled. You can enable them in settings or preview with demo data.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setTab('settings')}
            style={{
              background: `linear-gradient(135deg, ${themeColors.stop1}, ${themeColors.stop3})`
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Go to Settings
          </button>
          <button
            onClick={toggleShowDemoStats}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-transform hover:scale-105 active:scale-95"
          >
            Preview Demo Stats
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse text-zinc-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
          <span>Loading stats...</span>
        </div>
      </div>
    );
  }

  const hoursLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  const habitsData = {
    labels: hoursLabels,
    datasets: [
      {
        label: 'Plays',
        data: stats.listeningHabits,
        backgroundColor: themeColors.stop1,
        borderColor: themeColors.stop2,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const habitsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { display: false },
      },
    },
  };

  const genresData = {
    labels: stats.topGenres.map((g) => g.name || 'Unknown'),
    datasets: [
      {
        data: stats.topGenres.map((g) => g.count),
        backgroundColor: [
          themeColors.stop1,
          themeColors.stop2,
          themeColors.stop3,
          themeColors.stop4,
          themeColors.stop5,
        ],
        borderWidth: 0,
      },
    ],
  };

  const genresOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: 'rgba(255, 255, 255, 0.7)' },
      },
    },
    cutout: '70%',
  };
  
  // Slice to max 14 entries for chart
  const periodData = stats.timeByPeriod.slice(-14);
  const timeChartData = {
    labels: periodData.map(p => p.label),
    datasets: [
      {
        label: 'Listening Time (Hours)',
        data: periodData.map(p => (p.ms / (1000 * 60 * 60)).toFixed(2)),
        borderColor: themeColors.stop1,
        backgroundColor: `${themeColors.stop1}33`, // 20% opacity hex
        pointBackgroundColor: themeColors.stop3,
        pointBorderColor: '#ffffff',
        fill: true,
        tension: 0.4,
      }
    ]
  };
  
  const timeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 pb-36 overflow-y-auto custom-scrollbar pr-2 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-5">
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-300"
          style={{
            backgroundColor: `${themeColors.stop1}20`,
            borderColor: `${themeColors.stop1}50`,
            color: themeColors.stop1
          }}
        >
          <BarChart2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Listening Dashboard</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Your personal music listening statistics.</p>
        </div>
      </div>

      {showDemoStats && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span><strong>Showcase Demo Mode Active:</strong> Displaying simulated analytics data for screenshots and testing.</span>
          </div>
          <button
            onClick={toggleShowDemoStats}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors text-[11px]"
          >
            Turn Off Demo
          </button>
        </div>
      )}
      
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Time Card */}
        <div 
          className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col justify-center transition-all duration-300 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${themeColors.stop1}15 0%, ${themeColors.stop2}08 100%)`,
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5" style={{ color: themeColors.stop1 }} />
            <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Total Time Listened</span>
          </div>
          <span 
            className="text-4xl font-black font-mono tracking-tight bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(to right, #ffffff, ${themeColors.stop1})`
            }}
          >
            {formatDuration(stats.totalListeningTime)}
          </span>
          <span className="text-xs text-zinc-400 mt-2 font-mono">{events.length} total plays logged</span>
        </div>
        
        {/* Period Line Chart Card with Song-Themed Selector */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Listening History</h3>
            
            {/* Themed Day / Week / Month Selector */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shadow-inner">
              {(['day', 'week', 'month'] as const).map((p) => {
                const isSelected = timePeriod === p;
                return (
                  <button
                    key={p}
                    onClick={() => setTimePeriod(p)}
                    style={
                      isSelected
                        ? {
                            background: `linear-gradient(135deg, ${themeColors.stop1}, ${themeColors.stop3})`,
                            color: '#ffffff',
                            boxShadow: `0 2px 8px ${themeColors.stop1}50`
                          }
                        : {}
                    }
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all duration-200 ${
                      isSelected ? '' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="h-32 w-full relative">
            {periodData.length === 0 ? (
              <p className="text-sm text-zinc-500">Not enough data recorded yet.</p>
            ) : (
              <Line data={timeChartData} options={timeChartOptions} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Songs</h3>
          {stats.topSongs.length === 0 ? (
            <p className="text-sm text-zinc-500">Not enough data.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.topSongs.map((song, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <span 
                      className="text-xs font-bold w-4"
                      style={{ color: i === 0 ? themeColors.stop1 : i === 1 ? themeColors.stop2 : themeColors.stop3 }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-zinc-200 truncate">{song.name}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs font-bold text-white">{formatDuration(song.listened_ms)}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{song.count} plays</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Artists */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Artists</h3>
          {stats.topArtists.length === 0 ? (
            <p className="text-sm text-zinc-500">Not enough data.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.topArtists.map((artist, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <span 
                      className="text-xs font-bold w-4"
                      style={{ color: i === 0 ? themeColors.stop2 : i === 1 ? themeColors.stop3 : themeColors.stop4 }}
                    >
                      {i + 1}
                    </span>
                    <span 
                      className="text-sm font-medium text-zinc-200 truncate cursor-pointer hover:underline hover:text-indigo-400"
                      onClick={() => {
                        if (artist.name && artist.name !== 'Unknown Artist') {
                          usePlayerStore.getState().navigateToArtist(artist.name);
                        }
                      }}
                    >
                      {artist.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs font-bold text-white">{formatDuration(artist.listened_ms)}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{artist.count} plays</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listening Habits */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col gap-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Listening Activity (Time of Day)</h3>
          <div className="h-64 w-full relative">
            {stats.listeningHabits.every(x => x === 0) ? (
              <p className="text-sm text-zinc-500">Not enough data.</p>
            ) : (
              <Bar data={habitsData} options={habitsOptions} />
            )}
          </div>
        </div>

        {/* Top Genres */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col gap-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Genres</h3>
          {stats.topGenres.length === 0 ? (
            <p className="text-sm text-zinc-500">Not enough data.</p>
          ) : (
            <div className="h-64 w-full relative flex items-center justify-center">
              <Doughnut data={genresData} options={genresOptions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
