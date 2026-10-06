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
|  [App.tsx] Router & Layout                                                        |
|     ├── [Header / Sidebar / BottomBar / QueueDrawer]                              |
|     ├── [TrackTableView] (RevoGrid + Stencil Virtual Cells)                       |
|     ├── [LyricsView] (Split/Centered, Word-Sync, Romanizer, 60fps Scroll)         |
|     ├── [SettingsView] (Categorized MUI Configs, ReplayGain, Audio Devices)       |
|     └── [AlbumGrid / ArtistsGrid / PlaylistView / StatsView]                      |
|                                                                                   |
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
- Bridges Zustand store events to Rust Tauri commands (`play_audio`, `pause_audio`, `resume_audio`, `seek_audio`, `set_volume`).
- Synchronizes the Web MediaSession API (`navigator.mediaSession`) and Windows SMTC with track title, artist, album, and artwork.
- Contains the auto-advance logic (`nextTrack()`) when tracks finish.

### 3.3 UI Component System & Material 3 Guidelines
- **Component Preference**: Always prefer **Material 3 (MUI / Material Design 3)** UI components, controls, and scaffolding over raw/native custom CSS implementations wherever feasible.
- **Theme Integration**: Integrate components with the existing dark theme tokens (`muiDarkTheme` in `SettingsView.tsx`, `M3Selector.tsx`) and dynamic album-derived CSS variables (`--color-stop-1` through `--color-stop-6`).
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

### 4.2 Grid Sorting & Key Invalidation
- **Gotcha**: RevoGrid caches internal row order. If sorting state changes in the store, the grid can fall 1 step out of sync unless its cache key is updated.
- **Rule**: Always incorporate `sortState` into the grid's unique key:
  ```typescript
  const gridKey = useMemo(() => {
    return `track-grid-${sortState.col}-${sortState.dir}-${tracks.length}`;
  }, [sortState, tracks.length]);
  ```

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

---

## 6. Library Scanning & Metadata Pipeline

### 6.1 Chunked Library Loading (`src-tauri/src/commands/library.rs`)
- Scanning 100,000 files in a single IPC call will exceed IPC payload limits and freeze the webview.
- Files are scanned recursively with Rayon parallel iterators, cached to `library.json`, and streamed back to the frontend in chunks of 500 tracks (`load_library_chunk`).

### 6.2 Metadata Reading & Embedding (`src-tauri/src/metadata.rs`)
- Extracted tags: Title, Artist, Album, Year, Date, Genre, Track Number, Bit Depth, Sample Rate, Bitrate, Channels, Embedded Art Base64, and Unsynced Lyrics.
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
