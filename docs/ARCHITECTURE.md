# Prism Music Player — Architectural Specification & System Guide

> **Audience**: AI Agents and Core Contributors.
> **Purpose**: Authoritative reference for subsystem design, data flow, IPC contracts, and performance constraints across the Rust backend and React frontend.

---

## 1. System Overview

Prism Music Player is built on **Tauri v2**, combining a high-performance, low-latency **Rust backend** with a responsive **React 18 / TypeScript frontend**.

```
+-----------------------------------------------------------------------------------+
|                                React 18 Frontend                                  |
|                                                                                   |
|  [App.tsx] Router, Root Scaffolding & ThemeProvider (prismDarkTheme)              |
|     ├── [Header.tsx] Search & Navigation Header                                  |
|     ├── [Sidebar.tsx] Coordinator -> [sidebar/{Nav, Playlists, ContextMenu}]      |
|     ├── [BottomBar.tsx] Coordinator -> [player/{TrackInfo, Controls, Volume, ...}]|
|     ├── [QueueDrawer.tsx] M3 Drawer -> [queue/{ItemRow, ContextMenu}]             |
|     ├── [TrackTableView.tsx] RevoGrid Virtual Data Grid                           |
|     ├── [LyricsView.tsx] Split/Centered Lyrics -> [lyrics/*]                      |
|     ├── [SettingsView.tsx] Coordinator -> [settings/{Library, Audio, Lyrics, ...}]|
|     ├── [AlbumGrid / AlbumView] Coordinator -> [albums/*]                         |
|     ├── [ArtistsGrid / ArtistView] Coordinator -> [artists/*]                     |
|     ├── [PlaylistView] Coordinator -> [playlist/*]                                |
|     ├── [StatsView] Coordinator -> [stats/{Cards, Charts, Leaderboards}]          |
|     └── [FilterView] Tag & Frequency Audio Filter                                 |
|                                                                                   |
|  Theme: [src/theme/prismTheme.ts] (MUI Dark Theme + Dynamic CSS Palette)          |
|  State: [usePlayerStore] (Zustand + Persist)                                      |
|  Lifecycle: [useAudioPlayback] (Sync loop, MediaSession, Web Audio Taskbar sync)  |
+-----------------------------------------▲-----------------------------------------+
                                          │ Tauri IPC (invoke, emit, listen)
+-----------------------------------------▼-----------------------------------------+
|                                 Rust Backend (Tauri v2)                           |
|                                                                                   |
|  [lib.rs]                                                                         |
|     ├── Thread Pools (Rayon throttled to N-2 cores for UI responsiveness)         |
|     ├── Taskbar Toolbar (Windows HWND thumbnail controls)                         |
|     └── MediaControls (Souvlaki SMTC / DBus)                                      |
|                                                                                   |
|  Subsystems:                                                                      |
|     ├── [audio.rs] GlobalAudioEngine (CPAL + Symphonia + Rubato + Lock-free IPC)  |
|     ├── [commands/playback.rs] Realtime Playback Controls                         |
|     ├── [commands/library.rs] File Scanner & Chunked Library Streaming            |
|     ├── [metadata.rs] ID3 / Vorbis / MP4 Parser & Lyric Embedding                 |
|     ├── [loudness.rs] EBU R128 ReplayGain 2.0 Scanner (BS.1770 LUFS)              |
|     ├── [audio_analysis.rs] BPM & Key Analysis Engine                             |
|     └── [stats.rs] SQLite Listening History (`listening_history.db`)             |
+-----------------------------------------------------------------------------------+
```

---

## 2. Audio Engine Deep Dive (`src-tauri/src/audio.rs`)

### 2.1 Audio Pipeline & Real-Time Threading
Playback is managed by `GlobalAudioEngine`:
1. **Output Stream (`cpal`)**:
   - Opens an exclusive output stream on the active audio endpoint.
   - Devices and capabilities are cached with pre-warming on startup (`pre-warm audio devices cache asynchronously <1ms`).
2. **Decoder (`symphonia`)**:
   - Decodes audio streams for MP3, FLAC, WAV, AAC, ALAC, Vorbis, and Opus.
   - Reads samples into planar format and normalizes channel interleaving.
3. **Resampler (`rubato::SincFixedIn`)**:
   - Automatically resamples non-native sample rates (e.g. 44.1 kHz, 96 kHz, 192 kHz) to match the hardware device's sample rate with zero audible distortion.
4. **Volume & ReplayGain Normalization**:
   - Software gain is applied as linear amplitude: `amplitude = volume * 10^(replay_gain_db / 20)`.
   - Equal-power crossfading uses standard trigonometric curve `(cos(t), sin(t))` or smooth exponential curve to eliminate volume dips during transitions.
5. **Gapless Playback**:
   - A next-track buffer is preloaded before the current track reaches EOF via `AudioCommand::SetNextTrack`.
   - Transition executes seamlessly without closing/reopening the CPAL stream.
6. **Automatic Output Device Migration & Error Recovery**:
   - The CPAL stream error callback tracks hardware disconnections via `device_changed: Arc<AtomicBool>`.
   - In default device mode, the engine polls OS default output device changes every 150ms and migrates streams seamlessly on unplug/plug events.
   - Buffer stall detection triggers stream recovery if an audio endpoint ceases consuming frames for >1.5s.
   - `set_output_device` explicitly targets the requested device and immediately updates the active stream without dropping requests.

### 2.2 Lock-Free IPC Position Tracking
- **The Problem**: Querying playback position frequently via Tauri IPC can cause UI micro-stutters if the audio render thread locks mutexes.
- **The Solution**:
  - `current_position_ms: Arc<AtomicU64>` and `seek_target_ms: Arc<AtomicU64>` provide lock-free atomic read/writes.
  - The frontend polls `get_playback_position` at ~250ms intervals for UI sync, while smooth 60fps seekbars use client-side linear extrapolation.

---

## 3. Frontend Architecture (`src/`)

### 3.1 State Management (`src/store/usePlayerStore.ts`)
The entire application state is stored in a single Zustand store:
- **Tracks & Library**: `tracks: Track[]`, `trackMap: Map<string, Track>`, `libraryDirectories: string[]`.
- **Playback**: `currentTrack`, `queue`, `queueIndex`, `isPlaying`, `volume`, `currentTime`, `duration`, `shuffleEnabled`, `repeatMode` (`'off' | 'all' | 'one'`).
- **Settings & Preferences**: Persisted to `localStorage` under `prism-player-storage` using Zustand's `partialize` (only user preferences are persisted; heavy runtime data is hydrated separately).

#### Performance Rules for Selectors:
```typescript
// ❌ WRONG: Causes component to re-render on every state change (including currentTime ticks)
const store = usePlayerStore();

// ✅ CORRECT: Select single primitive
const isPlaying = usePlayerStore((s) => s.isPlaying);

// ✅ CORRECT: Select multiple items with useShallow
import { useShallow } from 'zustand/react/shallow';
const { volume, setVolume } = usePlayerStore(
  useShallow((s) => ({ volume: s.volume, setVolume: s.setVolume }))
);
```

### 3.2 Centralized Audio Lifecycle Hook (`src/hooks/useAudioPlayback.ts`)
- Bridges Zustand store events to Rust Tauri commands (`play_audio`, `pause_audio`, `resume_audio`, `stop_audio`, `seek_audio`, `set_volume`).
- Synchronizes the Web MediaSession API (`navigator.mediaSession`) and Windows SMTC with track title, artist, album, and artwork.
- Contains the auto-advance logic (`nextTrack()`) when tracks finish.
- `togglePlay()` cleanly delegates to `pause()` and `resume()`, ensuring already loaded Symphonia audio streams remain active in memory without closing/re-opening the audio file from scratch.
- `stop_audio` command explicitly flushes audio buffers, clears `current_track`, `pending_next`, and resets hardware playback position to 0 (used on `clearQueue`).

### 3.3 UI Component System & Material 3 Architecture
- **Component Preference**: Always prefer **Material 3 (MUI / Material Design 3)** UI components, controls, and scaffolding over raw/native custom CSS implementations wherever feasible.
- **Theme Integration**: Centralized in [`src/theme/prismTheme.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/theme/prismTheme.ts) via `prismDarkTheme`, providing an accessible base dark palette with concrete hex colors (`primary.main: '#6366f1'`) required by MUI internal color math (`augmentColor`, `getContrastText`), while binding components (Buttons, Sliders, Menus, Modals, Drawers, ToggleButtons) to dynamic album-derived CSS variables (`--color-stop-1` through `--color-stop-6`) via `sx` and `styleOverrides`. Includes full `MuiSlider` theming with custom non-teardrop rounded glass tooltips (`&::before: { display: 'none' }`). An early startup error trap in `index.html` prevents silent black-screen failures on fatal module crashes.
- **Sidebar & Responsiveness**:
  - Left navigation sidebar is collapsible/hideable via `isSidebarVisible` (persisted in store), featuring a one-click collapse button in the sidebar header and an unhide button in the header when collapsed.
  - Bottom player bar employs responsive flex-shrink, `overflow: 'hidden'`, and automatic collapsing of auxiliary controls (`Shuffle`, `Repeat`, sleep timer, speaker) on thin window sizes to prevent element collision.
- **Playlist Grid & Batch Actions**:
  - Playlist view (`PlaylistView.tsx`) passes `playlistId` into `TrackTableView.tsx`, isolating sort states and scoping `originalIndexMap` to relative track positions (1–N, e.g. 1–40) rather than whole-library indices.
  - Multi-selection pill (`BatchActionPill.tsx`) utilizes theme-reactive primary button styling, inline removal when viewing playlists, and hover/click playlist dropdown menu with toggleable addition/removal.
- **Modular Directory Structure**: All high-complexity monolithic views are refactored into coordinator containers with dedicated subcomponent directories:
  - [`src/components/player/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/player/): `PlayerTrackInfo.tsx`, `PlayerControls.tsx`, `PlayerVolumeControl.tsx`, `PlayerActions.tsx`, `PlayerContextMenu.tsx` (replaces fragile `clamp()` dynamic sizing with responsive flex-shrink & M3 typography).
  - [`src/components/sidebar/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/sidebar/): `SidebarNav.tsx`, `SidebarPlaylists.tsx`, `SidebarContextMenu.tsx`.
  - [`src/components/common/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/common/): `ViewHeaderControls.tsx` (shared view controls: M3 menu sort & ToggleButtonGroup grid/list toggle).
  - [`src/components/albums/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/albums/): `AlbumCard.tsx`, `AlbumListRow.tsx`, `AlbumDetailHeader.tsx`.
  - [`src/components/artists/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/artists/): `ArtistCard.tsx`, `ArtistListRow.tsx`, `ArtistDetailHeader.tsx`, `ArtistAlbumSection.tsx`.
  - [`src/components/playlist/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/playlist/): `PlaylistCard.tsx`, `PlaylistListRow.tsx`, `PlaylistDetailHeader.tsx`, `PlaylistAddSongsPanel.tsx`, `PlaylistContextMenu.tsx`.
  - [`src/components/queue/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/queue/): `QueueItemRow.tsx`, `QueueContextMenu.tsx` (M3 `Drawer` with glassmorphic paper background).
  - [`src/components/stats/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/stats/): `StatsSummaryCards.tsx`, `StatsCharts.tsx`, `StatsLeaderboards.tsx` (industry-standard music analytics across Tracks, Artists, and Albums with vertically-centered row alignment, dynamic "+ More" / "Collapse" pagination, smooth-scrolling containers, podium rank badges, and track artwork).
  - [`src/components/settings/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/settings/): `LibrarySettingsSection.tsx`, `AudioSettingsSection.tsx`, `LyricsBackgroundSection.tsx`, `LyricsTypographySection.tsx`, `StatsSettingsSection.tsx`, `SystemSettingsSection.tsx`.
- **Resource & Performance Constraints**:
  - Keep component hierarchies shallow and avoid excessive DOM nesting to conserve CPU/memory.
  - Rely on theme overrides or lightweight Tailwind utility classes rather than heavy runtime style computations.
  - Ensure controls remain snappy, low-latency, and fluid across high-refresh displays.

---

## 4. Track Table & Virtualized Grid (`src/components/TrackTableView.tsx`)

Prism utilizes `@revolist/react-datagrid` (RevoGrid) backed by Stencil web components for buttery smooth 60fps scrolling over 50,000+ tracks.

### 4.1 Stencil / React Cell Templates
- Cell contents (like Play button, Favorite Heart, Duration, and Track Title) use `createReactCellTemplate`.
- To avoid memory leaks, each cell mounts an isolated `createRoot(el)` keyed by `${colProp}-${trackId}`.
- Native Stencil cells are used for simple text/metadata properties to minimize React root overhead.

### 4.2 Grid Sorting & Smooth Data Updates
- **Headless React Sorting**: To resolve conflicts between RevoGrid's internal sorting state and React's `usePlayerStore` state, we use an industry-standard "dumb grid" pattern. RevoGrid's built-in sorting (`sortable: true`) is completely disabled.
- **Explicit React Column Headers**: The `ColumnHeader` component explicitly receives React's authoritative `sortState` and `onSort` click handlers via custom props (`columnHeaderTemplate`). This guarantees the UI arrow and click behavior never drift out of sync, because RevoGrid has zero internal sorting state.
- **Smooth Re-ordering**: To prevent the table from flashing blank and unmounting virtual nodes on every sort, `sortState` is **excluded** from `gridKey`. `sortedTracks` seamlessly calculates the sorted array and provides it to the `<RevoGrid source={source} />` prop.
- **Reset Grid Defaults**: Invoking `resetGrid()` resets custom column widths, density, visibility, order, and resets `sortState` (`mainGridSortState` and `localSortState`) to `null` to return to the natural track sequence.

### 4.3 Album Art & Thumbnail High-Performance Pipeline
- **Strict Per-Track Keying**: To prevent cross-track artwork pollution across tracks sharing flat directories or unknown albums, artwork and thumbnails are keyed strictly by each audio file's canonical `track.path`.
- **Rust In-Memory Caching**: `extract_track_art` in `src-tauri/src/metadata.rs` caches extracted base64 artwork by file path in a thread-safe `OnceLock<Mutex<HashMap>>`, eliminating repeated disk I/O and tag parsing when scrolling, sorting, or re-rendering.
- **Frontend Canvas Thumbnail Memoization**: In-memory `thumbnailCache` and `thumbPromiseCache` store downscaled thumbnails and prevent redundant HTML Canvas operations across component re-renders.

---

## 5. Lyrics Engine (`src/components/LyricsView.tsx` & `src/components/lyrics/`)

### 5.1 Format Support & Parsing (`src/utils/lyricsParser.ts`)
- **Standard LRC**: Line timestamps `[mm:ss.xx] Line text`.
- **Enhanced Word-Synced LRC**: Word timestamps inside lines:
  `[01:12.30] Hello <01:12.50> World <01:13.10> !`
- **Syllable Timings**: Character or syllable start/end offsets.
- **Translations & Duets**: Inline secondary translations and multi-singer markers (`v1:`, `v2:`).

### 5.2 Romanization Pipeline (`src/utils/romanization.ts`)
- Automatically detects Japanese (Kanji/Kana), Korean (Hangul), and Chinese (Hanzi).
- Supports modes:
  - `side_by_side`: Displays original script with romanized pronunciation above/below.
  - `replace`: Replaces script directly with romanized text (both full line and syllable view).

### 5.3 Rendering & Smooth Auto-Scrolling
- Pre-calculates interlude breaks (>4 seconds of instrumental) with animated countdown dots (`InterludeIndicator.tsx`).
- Smooth centering scroll runs with custom CSS `transform: translateY(...)` or virtual scroll offsets.
- Fast seek jumps are debounced to prevent scroll bounce glitches.

### 5.4 Pop-Out Lyric Viewer & Multi-Window Overlay Architecture (`LyricsPopoutView.tsx`)
- **Secondary Tauri Webview Window (`lyrics-popout`)**:
  - Configured with `decorations: false`, `alwaysOnTop: true`, `transparent: true`, `resizable: true`, and `visible: false` in `tauri.conf.json`.
  - Managed via Rust IPC commands: `open_lyrics_popout`, `close_lyrics_popout`, and `toggle_lyrics_popout` in `src-tauri/src/commands/playback.rs`.
  - Dedicated entrypoint in `src/main.tsx` (`?window=lyrics-popout`), directly mounting `<LyricsPopoutView />` inside `ThemeProvider (prismDarkTheme)` and completely bypassing the main player scaffolding, RevoGrid tables, and audio device polling loops for minimal CPU/GPU overhead.
- **Cross-Window Synchronization Bus (`src/hooks/usePopoutSync.ts`)**:
  - Employs `BroadcastChannel('prism-popout-sync')` to synchronize track changes, volume levels, play/pause states, lyric animation styles, and user commands across windows.
  - The popout window polls `get_playback_position` directly from the Rust CPAL atomic clock at 75ms intervals and updates Zustand store `currentTime`, ensuring 60 FPS syllable synchronization and Lossless Glow/karaoke effects even when the main player window is minimized or occluded by fullscreen apps/games.
- **Component & Typography Unification (`LyricLineRow.tsx`, `InterludeIndicator.tsx` & `src/utils/lyricsTypography.ts`)**:
  - Reuses `<LyricLineRow />` and `<InterludeIndicator />` directly with `compact` mode, unifying word-level synchronized karaoke animations, instrumental break indicators (ambient dancing notes & 3-second countdown balls with auto-scroll centering), selectable `ANIMATION_OPTIONS` (Lossless Glow, Apple Fluid, Karaoke Pulse, etc.), syllable transitions, and dual romanization/translation rows across both full and mini players.
  - Shares the `calculateBalancedFontSize` algorithm (`src/utils/lyricsTypography.ts`) with `LyricsView.tsx`, ensuring balanced font scaling, active/inactive parity, and 3-line visual focus consistency across any window size.
- **Configurable Floating Widgets & Appearance**:
  - Widget toggles persisted in `usePlayerStore` and dedicated `localStorage` (`popoutLyricsSettings` / `prism-popout-lyrics-settings`): Album Art (dynamic 1:1 split or stacked), Seekbar (interactive scrub), Playback Controls (Previous, Play/Pause, Next, Volume), Lyric Animation Style selector, and Word-by-Word karaoke vs plain line highlighting.
  - Appearance styles: *Frosted Glass* (blur), *Solid Dark* (ultra-low GPU), *Album Art Color* (dynamic color-mix matching current album palette), and *Transparent* (clean floating text with readability shadows for gaming/Discord overlays).
  - Window controls: Top drag handle (`data-tauri-drag-region`), Pin/Always-on-top toggle (`setAlwaysOnTop`), minimize, and close.

---

## 6. Library Scanning & Metadata Pipeline

### 6.1 Chunked Library Loading (`src-tauri/src/commands/library.rs`)
- Scanning 100,000 files in a single IPC call will exceed IPC payload limits and freeze the webview.
- Files are scanned recursively with Rayon parallel iterators, cached to `library.json`, and streamed back to the frontend in chunks of 500 tracks (`load_library_chunk`).

### 6.2 Metadata Reading & Embedding (`src-tauri/src/metadata.rs`)
- Extracted tags: Title, Artist, Album, Year, Date, Genre, Track Number, Bit Depth, Sample Rate, Bitrate, Channels, Embedded Art Base64, and Unsynced Lyrics.
- Artwork extraction (`extract_track_art`): Extracts embedded artwork across FLAC (`metaflac`) and MP3/M4A/MP4/Vorbis (`lofty`), with fallback to directory cover images (`cover.jpg`, etc.). Results are cached in `ART_CACHE`.
- Cache invalidation: Both backend (`clear_art_cache`) and frontend (`invalidateTrackArtCache` in `useTrackArt.ts`) caches can be cleared dynamically on startup, library refresh, or tag embedding.
- `embed_lyrics`: Modifies ID3v2 USLT / Vorbis `LYRICS` tags directly on disk when user edits or saves fetched lyrics.

---

## 7. ReplayGain & Audio Analysis

### 7.1 ReplayGain 2.0 (`src-tauri/src/loudness.rs`)
- Complies with ITU-R BS.1770-4 / EBU R128 standards.
- Computes integrated loudness (LUFS) and true peak across each audio file.
- Calculates target gain offset to normalize playback to -18 LUFS (or user preference).

### 7.2 BPM & Key Analysis (`src-tauri/src/audio_analysis.rs`)
- Fast Fourier Transform (FFT) and peak tracking to estimate musical key (Camelot / standard notation) and BPM.
- Supports background multi-threaded batch scanning (`analyze_library_batch_turbo`).

---

## 8. Common Maintenance Workflows for AI Agents

### Adding a New Setting
1. Add property and setter to `usePlayerStore.ts` state interface.
2. If persistent, verify it is included in `partialize` within `usePlayerStore.ts`.
3. Add UI control in `src/components/SettingsView.tsx` under the matching category (`library`, `audio`, `lyrics`, `stats`, or `system`).

### Adding a New Tauri IPC Command
1. Define the command in the appropriate `src-tauri/src/commands/*.rs` file with `#[tauri::command]`.
2. Export the command in `src-tauri/src/commands/mod.rs`.
3. Register the command inside `invoke_handler![...]` in `src-tauri/src/lib.rs`.
4. Define TypeScript request/response types in `src/types/player.ts`.
5. Call via `invoke('command_name', { ... })` in frontend stores or hooks.

### Modifying Audio Engine Behavior
1. Check `src-tauri/src/audio.rs`.
2. Do **not** add blocking locks inside `cpal` audio stream callback.
3. Use atomic types (`AtomicBool`, `AtomicU64`) or bounded crossbeam channels for thread communication.
