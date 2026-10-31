import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check, Music2, Sparkles, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { searchAllLyricSources, LyricSearchResultItem } from '../../utils/lrclibFetcher';
import { Track } from '../../types/player';

export interface LyricsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  onApplyLyrics: (lyrics: string, sourceName?: string) => void;
}

export const LyricsSearchModal: React.FC<LyricsSearchModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  onApplyLyrics,
}) => {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<LyricSearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync inputs when opened
  useEffect(() => {
    if (isOpen && currentTrack) {
      setSearchTitle(currentTrack.title || '');
      setSearchArtist(currentTrack.artist || '');
      setResults([]);
      setHasSearched(false);
      setExpandedIndex(null);
      setAppliedIndex(null);
      // Auto-trigger search on initial open
      performSearch(currentTrack.title || '', currentTrack.artist || '');
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen, currentTrack?.id]);

  const performSearch = async (title: string, artist: string) => {
    if (!title.trim()) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setHasSearched(true);
    setExpandedIndex(null);

    try {
      const discovered = await searchAllLyricSources(
        title.trim(),
        artist.trim(),
        currentTrack?.album,
        currentTrack?.duration_secs,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setResults(discovered);
      }
    } catch {
      if (!controller.signal.aborted) {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchTitle, searchArtist);
  };

  const handleApply = (item: LyricSearchResultItem, index: number) => {
    setAppliedIndex(index);
    onApplyLyrics(item.lyrics, item.provider);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'rgba(18, 18, 24, 0.96)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            color: 'white',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          pt: 2.5,
          pb: 1.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
              color: 'var(--color-stop-1, #6366f1)',
            }}
          >
            <Search className="w-5 h-5" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
              Search Online Lyrics
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '0.75rem' }}>
              Queries Apple Music, Kugou, BetterLyrics, Unison & NetEase
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'rgb(161 161 170)',
            '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' },
          }}
        >
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {/* Search Input Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2.5 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Song Title"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                placeholder="e.g. Yellow"
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&.Mui-focused fieldset': { borderColor: 'var(--color-stop-1, #6366f1)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgb(161 161 170)', fontSize: '0.85rem' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-stop-1, #6366f1)' },
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Artist Name"
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                placeholder="e.g. Coldplay"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&.Mui-focused fieldset': { borderColor: 'var(--color-stop-1, #6366f1)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgb(161 161 170)', fontSize: '0.85rem' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--color-stop-1, #6366f1)' },
                }}
              />
            </Stack>

            <Button
              type="submit"
              variant="contained"
              disabled={isSearching || !searchTitle.trim()}
              startIcon={
                isSearching ? (
                  <CircularProgress size={16} sx={{ color: 'inherit' }} />
                ) : (
                  <Search className="w-4 h-4" />
                )
              }
              sx={{
                py: 1,
                borderRadius: '12px',
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.875rem',
                bgcolor: 'var(--color-stop-1, #6366f1)',
                color: 'var(--color-stop-1-text, #ffffff)',
                '&:hover': { filter: 'brightness(1.1)', bgcolor: 'var(--color-stop-1, #6366f1)' },
                '&:disabled': { opacity: 0.5, bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'rgb(161 161 170)' },
              }}
            >
              {isSearching ? 'Searching Providers...' : 'Search Sources'}
            </Button>
          </Stack>
        </Box>

        {/* Results Area */}
        <Box sx={{ minHeight: 220, maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
          {isSearching && results.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                gap: 1.5,
                color: 'rgb(161 161 170)',
              }}
            >
              <CircularProgress size={32} sx={{ color: 'var(--color-stop-1, #6366f1)' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Querying Apple Music, Kugou, BetterLyrics, Unison & NetEase...
              </Typography>
            </Box>
          ) : results.length > 0 ? (
            <Stack spacing={1.5}>
              <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Found {results.length} Lyric Source{results.length === 1 ? '' : 's'}
              </Typography>
              {results.map((item, idx) => {
                const isExpanded = expandedIndex === idx;
                const isApplied = appliedIndex === idx;

                return (
                  <Box
                    key={`${item.provider}-${idx}`}
                    sx={{
                      p: 1.75,
                      borderRadius: '14px',
                      bgcolor: isApplied ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid',
                      borderColor: isApplied
                        ? '#10b981'
                        : 'rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isApplied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.07)',
                        borderColor: isApplied ? '#10b981' : 'rgba(255, 255, 255, 0.18)',
                      },
                    }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 0.75 }}>
                          <Chip
                            label={item.provider}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 25%, transparent)',
                              color: 'white',
                              border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
                            }}
                          />
                          {item.hasWordSync && (
                            <Chip
                              icon={<Sparkles className="w-3 h-3" />}
                              label="Word Synced"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: 'rgba(16, 185, 129, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                '& .MuiChip-icon': { color: '#34d399', ml: 0.5 },
                              }}
                            />
                          )}
                          {item.isSynced && !item.hasWordSync && (
                            <Chip
                              label="Line Synced"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                              }}
                            />
                          )}
                          {item.hasTranslation && (
                            <Chip
                              icon={<Globe className="w-3 h-3" />}
                              label="Translation"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                '& .MuiChip-icon': { color: '#c084fc', ml: 0.5 },
                              }}
                            />
                          )}
                        </Stack>

                        {item.sampleLine && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'rgb(212 212 216)',
                              fontSize: '0.8rem',
                              fontStyle: 'italic',
                              lineHeight: 1.4,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 380,
                            }}
                          >
                            "{item.sampleLine}"
                          </Typography>
                        )}
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', shrink: 0 }}>
                        <Button
                          size="small"
                          onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                          sx={{
                            minWidth: 0,
                            p: 0.75,
                            borderRadius: '8px',
                            color: 'rgb(161 161 170)',
                            '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.08)' },
                          }}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>

                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleApply(item, idx)}
                          startIcon={isApplied ? <Check className="w-3.5 h-3.5" /> : undefined}
                          sx={{
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.775rem',
                            py: 0.5,
                            px: 1.5,
                            bgcolor: isApplied ? '#10b981' : 'var(--color-stop-1, #6366f1)',
                            color: 'white',
                            '&:hover': {
                              filter: 'brightness(1.1)',
                              bgcolor: isApplied ? '#10b981' : 'var(--color-stop-1, #6366f1)',
                            },
                          }}
                        >
                          {isApplied ? 'Applied!' : 'Apply'}
                        </Button>
                      </Stack>
                    </Stack>

                    {/* Expandable Preview */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Box
                            sx={{
                              mt: 1.5,
                              pt: 1.5,
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              maxHeight: 180,
                              overflowY: 'auto',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: 'rgb(212 212 216)',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              bgcolor: 'rgba(0, 0, 0, 0.25)',
                              p: 1.5,
                              borderRadius: '8px',
                            }}
                          >
                            {item.lyrics.slice(0, 1000)}
                            {item.lyrics.length > 1000 ? '\n... (truncated for preview)' : ''}
                          </Box>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                );
              })}
            </Stack>
          ) : hasSearched ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                textAlign: 'center',
                color: 'rgb(161 161 170)',
                gap: 1.25,
              }}
            >
              <Music2 className="w-10 h-10 text-zinc-600" />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                No lyrics matched this query
              </Typography>
              <Typography variant="caption" sx={{ maxWidth: 360, lineHeight: 1.5 }}>
                Try simplifying the song title (e.g. remove "feat.", remaster tags, or punctuation) or search with title only.
              </Typography>
            </Box>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
