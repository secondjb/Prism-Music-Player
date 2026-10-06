import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { motion } from 'framer-motion';
import {
  Mic2,
  Settings2,
  X,
  Languages,
  Globe,
  Maximize2,
  Minimize2,
  PictureInPicture2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Track } from '../../types/player';

export interface LyricsHeaderProps {
  controlsVisible: boolean;
  isUnsynced: boolean;
  isWordSynced: boolean;
  inferWordSyncedLyrics: boolean;
  showAudioSpecs: boolean;
  currentTrack: Track | null;
  isRomanizationEnabled: boolean;
  toggleRomanization: () => void;
  isTranslationEnabled: boolean;
  toggleTranslation: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean | ((prev: boolean) => boolean)) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  handleClose: () => void;
}

export const LyricsHeader: React.FC<LyricsHeaderProps> = ({
  controlsVisible,
  isUnsynced,
  isWordSynced,
  inferWordSyncedLyrics,
  showAudioSpecs,
  currentTrack,
  isRomanizationEnabled,
  toggleRomanization,
  isTranslationEnabled,
  toggleTranslation,
  showSettings,
  setShowSettings,
  isFullscreen,
  toggleFullscreen,
  handleClose,
}) => {
  return (
    <motion.div
      animate={{
        opacity: controlsVisible ? 1 : 0,
        y: controlsVisible ? 0 : -20,
      }}
      transition={{ duration: 0.3 }}
      className={`flex items-center justify-between z-10 ${
        controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'color-mix(in srgb, var(--color-stop-1, #6366f1) 20%, transparent)',
            color: 'var(--color-stop-1, #6366f1)',
            border: '1px solid color-mix(in srgb, var(--color-stop-1, #6366f1) 40%, transparent)',
          }}
        >
          <Mic2 className="w-5 h-5" />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: 'white',
              fontSize: '1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={
              isUnsynced
                ? 'Plain unsynced lyrics'
                : isWordSynced
                ? 'Native word-by-word timestamps from LRC file'
                : inferWordSyncedLyrics
                ? 'Line-synced lyrics (word timing is inferred)'
                : 'Line-synced lyrics'
            }
          >
            {isUnsynced
              ? 'Unsynced Lyrics'
              : isWordSynced
              ? 'Word Synced Lyrics'
              : 'Synced Lyrics'}
          </Typography>
        </Box>

        {showAudioSpecs && currentTrack && (
          <Box
            sx={{
              ml: 1.5,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'rgb(161 161 170)',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              px: 1.5,
              py: 0.5,
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          >
            {currentTrack.bit_rate_kbps ? `${currentTrack.bit_rate_kbps} kb/s • ` : ''}
            {(currentTrack.sample_rate / 1000).toFixed(1)} kHz
          </Box>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {/* Romanization Toggle */}
        <Tooltip title={isRomanizationEnabled ? 'Romanization Enabled' : 'Romanization Disabled'}>
          <IconButton
            onClick={toggleRomanization}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isRomanizationEnabled ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
              bgcolor: isRomanizationEnabled ? 'var(--color-stop-1, #6366f1)' : 'transparent',
              color: isRomanizationEnabled ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
              boxShadow: isRomanizationEnabled ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
              '&:hover': {
                bgcolor: isRomanizationEnabled ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            <Languages className="w-5 h-5" />
          </IconButton>
        </Tooltip>

        {/* Translation Toggle */}
        <Tooltip title={isTranslationEnabled ? 'Translation Enabled' : 'Translation Disabled'}>
          <IconButton
            onClick={toggleTranslation}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isTranslationEnabled ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
              bgcolor: isTranslationEnabled ? 'var(--color-stop-1, #6366f1)' : 'transparent',
              color: isTranslationEnabled ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
              boxShadow: isTranslationEnabled ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
              '&:hover': {
                bgcolor: isTranslationEnabled ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            <Globe className="w-5 h-5" />
          </IconButton>
        </Tooltip>

        {/* Settings Toggle */}
        <Tooltip title="Lyrics & Visual Settings">
          <IconButton
            onClick={() => setShowSettings((prev) => !prev)}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: showSettings ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
              bgcolor: showSettings ? 'var(--color-stop-1, #6366f1)' : 'transparent',
              color: showSettings ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
              boxShadow: showSettings ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
              '&:hover': {
                bgcolor: showSettings ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            <Settings2 className="w-5 h-5" />
          </IconButton>
        </Tooltip>

        {/* Pop Out Mini Player Toggle */}
        <Tooltip title="Pop Out Lyrics (Mini Player)">
          <IconButton
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                invoke('open_lyrics_popout').catch(() => {});
              }
            }}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgb(161 161 170)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            <PictureInPicture2 className="w-5 h-5" />
          </IconButton>
        </Tooltip>

        {/* Fullscreen Toggle */}
        <Tooltip title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}>
          <IconButton
            onClick={toggleFullscreen}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isFullscreen ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
              bgcolor: isFullscreen ? 'var(--color-stop-1, #6366f1)' : 'transparent',
              color: isFullscreen ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
              boxShadow: isFullscreen ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
              '&:hover': {
                bgcolor: isFullscreen ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </IconButton>
        </Tooltip>

        {/* Close Button */}
        <Tooltip title="Close Lyrics View">
          <IconButton
            onClick={handleClose}
            sx={{
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgb(161 161 170)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
            }}
          >
            <X className="w-5 h-5" />
          </IconButton>
        </Tooltip>
      </Stack>
    </motion.div>
  );
};
