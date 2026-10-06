import React, { useEffect, useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { BarChart2, AlertCircle, Sparkles } from 'lucide-react';
import { fetchListeningEvents, ListeningEvent } from '../utils/stats';
import {
  getTopArtists,
  getTopSongs,
  getTopGenres,
  getListeningHabits,
  getTotalListeningTime,
  getListeningTimeByPeriod,
  generateMockListeningEvents,
} from '../utils/statsAggregation';
import { usePlayerStore } from '../store/usePlayerStore';
import { StatsSummaryCards } from './stats/StatsSummaryCards';
import { StatsCharts } from './stats/StatsCharts';
import { StatsLeaderboards } from './stats/StatsLeaderboards';
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
  LineElement,
} from 'chart.js';

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
  const [leaderboardMetric, setLeaderboardMetric] = useState<'time' | 'plays'>('time');

  const isStatsCollectionEnabled = usePlayerStore((s) => s.isStatsCollectionEnabled);
  const showDemoStats = usePlayerStore((s) => s.showDemoStats);
  const toggleShowDemoStats = usePlayerStore((s) => s.toggleShowDemoStats);
  const anonymizeStats = usePlayerStore((s) => s.anonymizeStats);
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
      topArtists: getTopArtists(events, 5, leaderboardMetric),
      topSongs: getTopSongs(events, 5, leaderboardMetric),
      topGenres: getTopGenres(events, 5, leaderboardMetric),
      listeningHabits: getListeningHabits(events),
      totalListeningTime: getTotalListeningTime(events),
      timeByPeriod: getListeningTimeByPeriod(events, timePeriod),
    };
  }, [events, timePeriod, leaderboardMetric]);

  const displayStats = useMemo(() => {
    if (!anonymizeStats) return stats;
    return {
      ...stats,
      topSongs: stats.topSongs.map((s, i) => ({ ...s, name: `Song ${i + 1}` })),
      topArtists: stats.topArtists.map((a, i) => ({ ...a, name: `Artist ${i + 1}` })),
      topGenres: stats.topGenres.map((g, i) => ({ ...g, name: `Genre ${i + 1}` })),
    };
  }, [stats, anonymizeStats]);

  if (!isStatsCollectionEnabled && !showDemoStats) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center', gap: 2 }}>
        <AlertCircle size={48} className="text-zinc-500 mb-2" />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff' }}>
          Statistics Disabled
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
          Listening statistics are currently disabled. You can enable them in settings or preview with demo data.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => setTab('settings')}
            sx={{
              bgcolor: 'var(--color-stop-1, #6366f1)',
              color: '#ffffff',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Go to Settings
          </Button>
          <Button
            variant="outlined"
            onClick={toggleShowDemoStats}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Preview Demo Stats
          </Button>
        </Stack>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
          <Sparkles size={18} style={{ color: 'var(--color-stop-1, #6366f1)' }} />
          <Typography variant="body2">Loading stats...</Typography>
        </Stack>
      </Box>
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
        borderWidth: 0,
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
    labels: displayStats.topGenres.map((g) => g.name || 'Unknown'),
    datasets: [
      {
        data: displayStats.topGenres.map((g) => g.count),
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

  const periodData = stats.timeByPeriod.slice(-14);
  const timeChartData = {
    labels: periodData.map((p) => p.label),
    datasets: [
      {
        label: 'Listening Time (Hours)',
        data: periodData.map((p) => (p.ms / (1000 * 60 * 60)).toFixed(2)),
        borderColor: themeColors.stop1,
        backgroundColor: `${themeColors.stop1}33`,
        pointBackgroundColor: themeColors.stop3,
        pointBorderColor: '#ffffff',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const timeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3.5,
        pb: 18,
        overflowY: 'auto',
        pr: 1,
        height: '100%',
      }}
      className="custom-scrollbar"
    >
      {/* Header */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', pb: 2.5, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${themeColors.stop1}20`,
            border: `1px solid ${themeColors.stop1}50`,
            color: themeColors.stop1,
          }}
        >
          <BarChart2 size={24} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Listening Dashboard
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Your personal music listening statistics.
          </Typography>
        </Box>
      </Stack>

      {/* Demo Banner */}
      {showDemoStats && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            borderRadius: '12px',
            bgcolor: `${themeColors.stop1}15`,
            border: `1px solid ${themeColors.stop1}40`,
            color: themeColors.stop1,
            fontSize: '12px',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Sparkles size={16} />
            <span>
              <strong>Showcase Demo Mode Active:</strong> Displaying simulated analytics data for screenshots and testing.
            </span>
          </Stack>
          <Button
            size="small"
            onClick={toggleShowDemoStats}
            sx={{
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              textTransform: 'none',
              fontSize: '11px',
              borderRadius: '8px',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
            }}
          >
            Turn Off Demo
          </Button>
        </Box>
      )}

      {/* 1. Summary Cards */}
      <StatsSummaryCards
        totalListeningTime={stats.totalListeningTime}
        totalPlays={events.length}
        themeColors={themeColors}
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        timeChartData={timeChartData}
        timeChartOptions={timeChartOptions}
      />

      {/* 2. Leaderboards */}
      <StatsLeaderboards
        topSongs={displayStats.topSongs}
        topArtists={displayStats.topArtists}
        leaderboardMetric={leaderboardMetric}
        onMetricChange={setLeaderboardMetric}
        themeColors={themeColors}
      />

      {/* 3. Breakdown Charts */}
      <StatsCharts
        genresData={genresData}
        genresOptions={genresOptions}
        habitsData={habitsData}
        habitsOptions={habitsOptions}
      />
    </Box>
  );
};
