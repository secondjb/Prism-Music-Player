import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2,
  X,
  Palette,
  Type as TypeIcon,
  Languages,
  Activity,
  Waves,
  Globe,
  RefreshCw,
  Save,
  Check,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { M3Selector } from '../M3Selector';
import { BACKGROUND_OPTIONS, FONT_OPTIONS, ANIMATION_OPTIONS } from './types';

export interface LyricsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundType: string;
  setBackgroundType: (val: any) => void;
  customBgPath: string | null;
  setCustomBgPath: (path: string | null) => void;
  customBgColor: string;
  setCustomBgColor: (color: string) => void;
  bgBlurAmount: number;
  setBgBlurAmount: (blur: number) => void;
  bgDimOpacity: number;
  setBgDimOpacity: (opacity: number) => void;
  lyricsLayoutMode: 'centered' | 'split';
  setLyricsLayoutMode: (mode: 'centered' | 'split') => void;
  lyricsAnimationStyle: string;
  setLyricsAnimationStyle: (style: any) => void;
  lyricsFontFamily: string;
  setLyricsFontFamily: (font: string) => void;
  lyricsFontSizePreset: string;
  setLyricsFontSizePreset: (preset: any) => void;
  activeFontSize: number;
  setLyricsFontSize: (size: number) => void;
  isWavySeekbarEnabled: boolean;
  toggleWavySeekbar: () => void;
  showAudioSpecs: boolean;
  toggleShowAudioSpecs: () => void;
  autoHideLyricsControls: boolean;
  toggleAutoHideLyricsControls: () => void;
  isRomanizationEnabled: boolean;
  romanizationMode: string;
  handleRomanizationChange: (state: 'off' | 'below' | 'replace') => void;
  isTranslationEnabled: boolean;
  translationMode: string;
  handleTranslationChange: (state: 'off' | 'below' | 'replace') => void;
  preferWordSyncedLyrics: boolean;
  togglePreferWordSyncedLyrics: () => void;
  inferWordSyncedLyrics: boolean;
  toggleInferWordSyncedLyrics: () => void;
  lrclibAutoFetch: boolean;
  setLrclibAutoFetch: (enabled: boolean) => void;
  preferOnlineLyrics: boolean;
  setPreferOnlineLyrics: (enabled: boolean) => void;
  autoEmbedLyrics: boolean;
  toggleAutoEmbedLyrics: () => void;
  handleManualRefresh: () => Promise<void>;
  handleEmbedLyrics: () => Promise<void>;
  isLoading: boolean;
  isEmbedding: boolean;
  embedSuccess: boolean;
  rawLrc: string;
}

export const LyricsSettingsModal: React.FC<LyricsSettingsModalProps> = ({
  isOpen,
  onClose,
  backgroundType,
  setBackgroundType,
  customBgPath,
  setCustomBgPath,
  customBgColor,
  setCustomBgColor,
  bgBlurAmount,
  setBgBlurAmount,
  bgDimOpacity,
  setBgDimOpacity,
  lyricsLayoutMode,
  setLyricsLayoutMode,
  lyricsAnimationStyle,
  setLyricsAnimationStyle,
  lyricsFontFamily,
  setLyricsFontFamily,
  lyricsFontSizePreset,
  setLyricsFontSizePreset,
  activeFontSize,
  setLyricsFontSize,
  isWavySeekbarEnabled,
  toggleWavySeekbar,
  showAudioSpecs,
  toggleShowAudioSpecs,
  autoHideLyricsControls,
  toggleAutoHideLyricsControls,
  isRomanizationEnabled,
  romanizationMode,
  handleRomanizationChange,
  isTranslationEnabled,
  translationMode,
  handleTranslationChange,
  preferWordSyncedLyrics,
  togglePreferWordSyncedLyrics,
  inferWordSyncedLyrics,
  toggleInferWordSyncedLyrics,
  lrclibAutoFetch,
  setLrclibAutoFetch,
  preferOnlineLyrics,
  setPreferOnlineLyrics,
  autoEmbedLyrics,
  toggleAutoEmbedLyrics,
  handleManualRefresh,
  handleEmbedLyrics,
  isLoading,
  isEmbedding,
  embedSuccess,
  rawLrc,
}) => {
  const [settingsTab, setSettingsTab] = useState<'atmosphere' | 'typography' | 'sync'>('atmosphere');

  const currentRomanizationState = !isRomanizationEnabled ? 'off' : romanizationMode;
  const currentTranslationState = !isTranslationEnabled ? 'off' : translationMode;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="absolute right-8 top-20 w-[350px] min-h-[480px] max-h-[82vh] overflow-y-auto custom-scrollbar glass-panel border border-white/15 rounded-2xl shadow-2xl p-4.5 z-50 flex flex-col gap-3.5 text-xs text-zinc-200"
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', pb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Settings2 className="w-4 h-4" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
              Lyrics & Visual Settings
            </Typography>
            <IconButton onClick={onClose} size="small" sx={{ color: 'rgb(161 161 170)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' } }}>
              <X className="w-4 h-4" />
            </IconButton>
          </Box>

          {/* Tab Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(0, 0, 0, 0.4)', p: 0.5, borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {(['atmosphere', 'typography', 'sync'] as const).map((tab) => {
              const isActive = settingsTab === tab;
              const labels = {
                atmosphere: { icon: <Palette className="w-3.5 h-3.5" />, label: 'Atmosphere' },
                typography: { icon: <TypeIcon className="w-3.5 h-3.5" />, label: 'Typography' },
                sync: { icon: <Languages className="w-3.5 h-3.5" />, label: 'Sync & Lang' },
              };
              return (
                <Box
                  key={tab}
                  component="button"
                  onClick={() => setSettingsTab(tab)}
                  sx={{
                    flex: 1,
                    height: 32,
                    px: 1,
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    cursor: 'pointer',
                    border: 'none',
                    bgcolor: isActive ? 'var(--color-stop-1, #6366f1)' : 'transparent',
                    color: isActive ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
                    boxShadow: isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)' : 'none',
                    '&:hover': {
                      color: isActive ? 'var(--color-stop-1-text, #ffffff)' : 'white',
                    },
                  }}
                >
                  {labels[tab].icon}
                  <span>{labels[tab].label}</span>
                </Box>
              );
            })}
          </Box>

          {/* TAB 1: ATMOSPHERE */}
          {settingsTab === 'atmosphere' && (
            <Stack spacing={2}>
              <M3Selector
                label="Background Theme"
                icon={<Palette className="w-3.5 h-3.5" />}
                value={backgroundType}
                onChange={(val) => setBackgroundType(val)}
                options={BACKGROUND_OPTIONS}
              />

              {/* Custom Photo Wallpaper */}
              {backgroundType === 'custom_photo' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgb(212 212 216)', fontWeight: 500 }}>Custom Photo</Typography>
                    <Box
                      component="button"
                      type="button"
                      onClick={async () => {
                        try {
                          const selected = await open({
                            multiple: false,
                            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
                          });
                          if (selected && typeof selected === 'string') {
                            const assetUrl = (window as any).__TAURI_INTERNALS__ ? convertFileSrc(selected) : selected;
                            setCustomBgPath(assetUrl);
                          }
                        } catch (e) {
                          console.warn('Pick background image error:', e);
                        }
                      }}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        bgcolor: 'var(--color-stop-1, #6366f1)',
                      }}
                    >
                      Choose Image...
                    </Box>
                  </Box>
                  {customBgPath && (
                    <Typography variant="caption" sx={{ color: 'rgb(113 113 122)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customBgPath}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Solid Color Tint */}
              {backgroundType === 'solid_color' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ color: 'rgb(212 212 216)', fontWeight: 500 }}>Color Tint</Typography>
                    <input
                      type="color"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 0 }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {['#09090b', '#0f172a', '#18181b', '#1e1b4b', '#311042', '#064e3b'].map((hex) => (
                      <Box
                        key={hex}
                        component="button"
                        type="button"
                        onClick={() => setCustomBgColor(hex)}
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: customBgColor.toLowerCase() === hex ? '2px solid white' : '1px solid rgba(255, 255, 255, 0.2)',
                          transform: customBgColor.toLowerCase() === hex ? 'scale(1.2)' : 'none',
                          bgcolor: hex,
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Blur & Dim Sliders */}
              {(backgroundType === 'album_art_blur' || backgroundType === 'custom_photo') && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgb(212 212 216)' }}>
                      <span>Blur Amount</span>
                      <span style={{ fontFamily: 'monospace' }}>{bgBlurAmount}px</span>
                    </Box>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={2}
                      value={bgBlurAmount}
                      onChange={(e) => setBgBlurAmount(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgb(212 212 216)' }}>
                      <span>Dim Tint Overlay</span>
                      <span style={{ fontFamily: 'monospace' }}>{Math.round(bgDimOpacity * 100)}%</span>
                    </Box>
                    <input
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={bgDimOpacity}
                      onChange={(e) => setBgDimOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </Box>
                </Box>
              )}

              {/* Lyrics Layout Mode */}
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'rgb(212 212 216)', fontWeight: 600 }}>Screen Layout</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {(['centered', 'split'] as const).map((mode) => {
                    const isSel = lyricsLayoutMode === mode;
                    return (
                      <Box
                        key={mode}
                        component="button"
                        onClick={() => setLyricsLayoutMode(mode)}
                        sx={{
                          py: 1,
                          px: 1.5,
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: isSel ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                          bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSel ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                          },
                        }}
                      >
                        {mode === 'centered' ? 'Centered Focus' : 'Side-by-Side Split'}
                      </Box>
                    );
                  })}
                </Box>
              </Stack>
            </Stack>
          )}

          {/* TAB 2: TYPOGRAPHY */}
          {settingsTab === 'typography' && (
            <Stack spacing={2}>
              <M3Selector
                label="Lyric Animation Style"
                icon={<Activity className="w-3.5 h-3.5" />}
                value={lyricsAnimationStyle}
                onChange={(val) => setLyricsAnimationStyle(val)}
                options={ANIMATION_OPTIONS}
              />

              <M3Selector
                label="Lyrics Typography & Font"
                icon={<TypeIcon className="w-3.5 h-3.5" />}
                value={lyricsFontFamily}
                onChange={(val) => setLyricsFontFamily(val)}
                options={FONT_OPTIONS}
              />

              {/* Lyrics Size Presets */}
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'rgb(212 212 216)', fontWeight: 600 }}>Lyrics Size Preset</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {(['normal', 'balanced', 'large', 'maximum'] as const).map((preset) => {
                    const isSel = lyricsFontSizePreset === preset;
                    return (
                      <Box
                        key={preset}
                        component="button"
                        onClick={() => setLyricsFontSizePreset(preset)}
                        sx={{
                          py: 1,
                          px: 1.5,
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          border: isSel ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                          bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSel ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                          },
                        }}
                      >
                        {preset === 'maximum' ? 'Max Space' : preset}
                      </Box>
                    );
                  })}
                </Box>
              </Stack>

              {/* Manual Font Size Slider */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgb(212 212 216)' }}>
                  <span>Manual Font Size</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-stop-1, #6366f1)' }}>
                    {Math.round(activeFontSize)}px
                  </span>
                </Box>
                <input
                  type="range"
                  min={18}
                  max={150}
                  step={1}
                  value={activeFontSize}
                  onChange={(e) => {
                    setLyricsFontSizePreset('manual');
                    setLyricsFontSize(parseInt(e.target.value, 10));
                  }}
                  style={{
                    background: `linear-gradient(to right, var(--color-stop-1, #6366f1) 0%, var(--color-stop-2, #818cf8) ${
                      ((activeFontSize - 18) / (150 - 18)) * 100
                    }%, #27272a ${((activeFontSize - 18) / (150 - 18)) * 100}%)`,
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-m3"
                />
              </Box>

              {/* Checkboxes */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Waves className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Wavy Seekbar</Typography>
                </Box>
                <Checkbox
                  checked={isWavySeekbarEnabled}
                  onChange={toggleWavySeekbar}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Audio Specs Badge</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>FLAC sample rate & bit depth</Typography>
                </Box>
                <Checkbox
                  checked={showAudioSpecs}
                  onChange={toggleShowAudioSpecs}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Auto-hide Controls</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Fade buttons during playback</Typography>
                </Box>
                <Checkbox
                  checked={autoHideLyricsControls}
                  onChange={toggleAutoHideLyricsControls}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>
            </Stack>
          )}

          {/* TAB 3: SYNC & LANGUAGES */}
          {settingsTab === 'sync' && (
            <Stack spacing={2}>
              {/* Romanization */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Languages className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Lyric Romanization</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, bgcolor: 'rgba(0, 0, 0, 0.4)', p: 0.5, borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  {(['off', 'below', 'replace'] as const).map((mode) => {
                    const isSel = currentRomanizationState === mode;
                    return (
                      <Box
                        key={mode}
                        component="button"
                        onClick={() => handleRomanizationChange(mode)}
                        sx={{
                          py: 0.5,
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          border: 'none',
                          bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'transparent',
                          color: isSel ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
                          cursor: 'pointer',
                        }}
                      >
                        {mode}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Translation */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Globe className="w-3.5 h-3.5" style={{ color: 'var(--color-stop-1, #6366f1)' }} />
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Lyric Translation</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5, bgcolor: 'rgba(0, 0, 0, 0.4)', p: 0.5, borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  {(['off', 'below', 'replace'] as const).map((mode) => {
                    const isSel = currentTranslationState === mode;
                    return (
                      <Box
                        key={mode}
                        component="button"
                        onClick={() => handleTranslationChange(mode)}
                        sx={{
                          py: 0.5,
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          border: 'none',
                          bgcolor: isSel ? 'var(--color-stop-1, #6366f1)' : 'transparent',
                          color: isSel ? 'var(--color-stop-1-text, #ffffff)' : 'rgb(161 161 170)',
                          cursor: 'pointer',
                        }}
                      >
                        {mode}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Sync Options Checkboxes */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Prefer Word/Syllable Sync</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Query rich syllable timing</Typography>
                </Box>
                <Checkbox
                  checked={preferWordSyncedLyrics}
                  onChange={togglePreferWordSyncedLyrics}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Infer Word-by-Word Sync</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Estimate word timing</Typography>
                </Box>
                <Checkbox
                  checked={inferWordSyncedLyrics}
                  onChange={toggleInferWordSyncedLyrics}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Auto-fetch Online Lyrics</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Search online database</Typography>
                </Box>
                <Checkbox
                  checked={lrclibAutoFetch}
                  onChange={(e) => setLrclibAutoFetch(e.target.checked)}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Prefer Online Over Embedded</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Prioritize online synced</Typography>
                </Box>
                <Checkbox
                  checked={preferOnlineLyrics}
                  onChange={(e) => setPreferOnlineLyrics(e.target.checked)}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>Auto-embed to Audio</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', fontSize: '10px' }}>Save fetched lyrics to file</Typography>
                </Box>
                <Checkbox
                  checked={autoEmbedLyrics}
                  onChange={toggleAutoEmbedLyrics}
                  size="small"
                  sx={{ color: 'var(--color-stop-1, #6366f1)', '&.Mui-checked': { color: 'var(--color-stop-1, #6366f1)' }, p: 0 }}
                />
              </Box>

              {/* Action Buttons */}
              <Stack spacing={1} sx={{ pt: 1 }}>
                <Box
                  component="button"
                  onClick={handleManualRefresh}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 1,
                    px: 1.5,
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    bgcolor: 'var(--color-stop-1, #6366f1)',
                    color: 'var(--color-stop-1-text, #ffffff)',
                    cursor: 'pointer',
                    '&:hover': { filter: 'brightness(1.1)' },
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Online Lyrics
                </Box>

                <Box
                  component="button"
                  onClick={handleEmbedLyrics}
                  disabled={isEmbedding || !rawLrc.trim()}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 1,
                    px: 1.5,
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    bgcolor: embedSuccess ? '#10b981' : 'var(--color-stop-1, #6366f1)',
                    color: 'var(--color-stop-1-text, #ffffff)',
                    cursor: 'pointer',
                    opacity: isEmbedding || !rawLrc.trim() ? 0.5 : 1,
                    '&:hover:not(:disabled)': { filter: 'brightness(1.1)' },
                  }}
                >
                  {embedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Embedded to File!
                    </>
                  ) : (
                    <>
                      <Save className={`w-3.5 h-3.5 ${isEmbedding ? 'animate-pulse' : ''}`} />
                      {isEmbedding ? 'Embedding...' : 'Embed Lyrics to File'}
                    </>
                  )}
                </Box>
              </Stack>
            </Stack>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
