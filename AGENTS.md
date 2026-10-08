# Prism Music Player — Agent Quick Guide & Guidelines

> **Notice for AI Agents**: Always consult this guide before locating files or modifying code.
> When you introduce, remove, or modify core pipelines, components, or store states, you **must update** `docs/ARCHITECTURE.md` (and this file if paths changed) before concluding your task.

---

## 🗺️ Codebase Map & Key Touchpoints

### 1. Frontend (`/src`) — React 18 + Vite + Tailwind + Zustand
* **Main Entry & Root Routing**:
  * [`src/App.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/App.tsx): Root view router (`activeTab`), lazy component loading, ambient album-art background glow, global keyboard shortcuts, and startup hydration (`initLoad`).
  * [`src/main.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/main.tsx): React root mount point, global CSS.
  * [`src/App.css`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/App.css): Custom CSS variables, glassmorphism themes, dynamic gradients.
* **Global State & Audio Hook**:
  * [`src/store/usePlayerStore.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/store/usePlayerStore.ts): Primary Zustand store (library tracks, queue, playback state, settings, ReplayGain mode, sorting state, lyrics configs). Uses `zustand/middleware/persist` with selective partialization.
  * [`src/hooks/useAudioPlayback.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/hooks/useAudioPlayback.ts): Centralized playback loop. Synchronizes store state with Rust audio engine, polls position, handles MediaSession / Windows SMTC, auto-advances tracks, and handles crossfading.
  * [`src/types/player.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/types/player.ts): Core TypeScript interfaces (`Track`, `AudioDeviceInfo`, `AudioAnalysisResult`, `LibraryChunkResponse`).
* **Grids & Library Views**:
  * [`src/components/TrackTableView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/TrackTableView.tsx): High-performance RevoGrid data grid. Custom Stencil/React cell templates (`createReactCellTemplate`), custom column headers, sorting persistence, and multi-selection (`BatchActionPill`).
  * [`src/components/AlbumGrid.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/AlbumGrid.tsx) & [`AlbumView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/AlbumView.tsx): Album card grid and album detail drilldown.
  * [`src/components/ArtistsGrid.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/ArtistsGrid.tsx) & [`ArtistView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/ArtistView.tsx): Artist list and artist discography.
  * [`src/components/PlaylistView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/PlaylistView.tsx): Custom user playlists and track reordering.
* **Lyrics System**:
  * [`src/components/LyricsView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/LyricsView.tsx): Fullscreen & dedicated lyrics view page. Manages active line scroll, layout switching, romanization, and background effects.
  * [`src/components/lyrics/`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/lyrics/): Modular lyrics components (`LyricLineRow.tsx`, `LyricsSplitLayout.tsx`, `LyricsCenteredLayout.tsx`, `LyricsHeader.tsx`, `LyricsSeekbar.tsx`, `LyricsSettingsModal.tsx`).
  * [`src/utils/lyricsParser.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/utils/lyricsParser.ts): Parses standard LRC, enhanced word-level LRC (`<mm:ss.xx>`), syllable timings, and translations.
  * [`src/utils/lrclibFetcher.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/utils/lrclibFetcher.ts): LRCLIB API client for online synced/plain lyrics retrieval.
  * [`src/utils/romanization.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/utils/romanization.ts) & [`japaneseRomanizer.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/utils/japaneseRomanizer.ts): Japanese / Korean / Chinese lyric romanization.
* **Settings & Stats**:
  * [`src/components/SettingsView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/SettingsView.tsx): Categorized settings (Library, Audio, Lyrics Typography & Background, Stats, System Reset). Uses custom dark MUI controls.
  * [`src/components/StatsView.tsx`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/components/StatsView.tsx): Listening analytics, top artists/albums, play count charts.
  * [`src/utils/stats.ts`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src/utils/stats.ts): IPC calls to Rust SQLite stats database.

---

### 2. Backend (`/src-tauri`) — Rust + Tauri v2
* **Entry & Tauri Setup**:
  * [`src-tauri/src/lib.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/lib.rs): Tauri builder, Rayon thread pool configuration, SMTC/Souvlaki media controls, Windows Taskbar thumbnail buttons, invoke handler registration.
  * [`src-tauri/src/main.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/main.rs): Windows executable entry point.
* **Audio Engine & CPAL**:
  * [`src-tauri/src/audio.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/audio.rs): The core audio playback engine. Uses `cpal` output streams, `symphonia` audio decoding (FLAC, MP3, AAC, ALAC, Opus, WAV, Vorbis), `rubato` high-quality sample-rate conversion, equal-power crossfading, gapless track preloading, and lock-free atomic position tracking (`current_position_ms`).
* **Commands & Subsystems**:
  * [`src-tauri/src/commands/playback.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/commands/playback.rs): Audio commands (`play_audio`, `pause_audio`, `resume_audio`, `seek_audio`, `set_volume`, `set_replay_gain`, `get_playback_position`, `set_next_track`).
  * [`src-tauri/src/commands/library.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/commands/library.rs): File scanning (`scan_directory`, `scan_libraries`, `refresh_libraries`), chunked library streaming (`load_library_chunk`), and JSON persistence.
  * [`src-tauri/src/metadata.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/metadata.rs): Reads ID3, Vorbis, MP4 tags, embedded art, unsynced lyrics, and writes embedded lyrics (`embed_lyrics`).
  * [`src-tauri/src/loudness.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/loudness.rs): EBU R128 ReplayGain 2.0 loudness scanning (integrated BS.1770 LUFS analysis).
  * [`src-tauri/src/audio_analysis.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/audio_analysis.rs): Key and BPM musical analysis engine.
  * [`src-tauri/src/stats.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/stats.rs): Local SQLite listening database (`listening_history.db`).
  * [`src-tauri/src/taskbar.rs`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/src-tauri/src/taskbar.rs): Windows Taskbar thumbnail toolbar integration (Play/Pause, Next, Prev buttons).

---

## ⚠️ Critical Architectural Gotchas & Pitfalls

1. **RevoGrid Headless Sorting**:
   * We disabled RevoGrid's built-in sorting (`sortable: false`). Do not re-enable it. Sorting is handled strictly by React via `sortedTracks` updating the `source` array. The column headers are interactive via `ColumnHeader` React click handlers. `sortState` MUST remain EXCLUDED from `gridKey` to prevent the UI from flashing blank on every sort.
2. **Lyrics View Rendering & Performance**:
   * Lyrics progress runs at 60 FPS. **Never** subscribe components directly to `currentTime` inside `usePlayerStore` if they render large trees. Use `requestAnimationFrame` or localized timer subscriptions (e.g. `LyricsSeekbar` or syllable highlighter memoization).
   * Always use `useShallow` when pulling multiple actions/properties from `usePlayerStore`.
3. **Rust Audio Thread Safety**:
   * The CPAL audio callback runs on a high-priority real-time audio thread. **Never** acquire blocking mutexes or allocate memory on the audio render thread. Position and seek offsets are tracked using `AtomicU64` and `AtomicBool`.
4. **Tauri IPC Command Arguments**:
   * Tauri v2 deserializes camelCase frontend args to snake_case Rust args. Double check parameter names in `src-tauri/src/commands/` when adding or altering `invoke('command_name', { ... })`.
5. **Theme Colors & Gradient Bleed**:
   * Prism dynamically derives CSS variables (`--color-stop-1` through `--color-stop-6`) from the album art using `updateLogoGradientFromImage` in `src/utils/colorExtractor.ts`. Elements using ambient art colors should refer to these CSS variables or `glass-card` styling.
6. **UI System: Material 3 Preferred Over Native CSS**:
   * Always prefer **Material 3 (MUI / Material Design 3)** UI components, controls, and scaffolding over raw/native custom CSS implementations wherever feasible.
   * Maintain high performance, snappy responsiveness, and minimal resource usage: keep them lightweight, avoid unnecessary DOM nesting, and integrate smoothly with the player's dark glassmorphism aesthetic (`muiDarkTheme` in `SettingsView.tsx`, `M3Selector.tsx`).

---

## 📋 Rule for Agents: Updating Documentation
Whenever you make changes to:
- Core audio pipelines or playback commands
- Zustand state schemas or persistence keys
- View structures or navigation tabs
- RevoGrid table logic or Lyrics rendering mechanics

👉 **You must update [`docs/ARCHITECTURE.md`](file:///c:/Users/b1a7e/Desktop/Prism%20Music%20Player/docs/ARCHITECTURE.md) to reflect the new architecture before ending your turn.**

---

## 🚀 Rule for Agents: Commit & Push
👉 **Always commit and push your changes to remote (`git add`, `git commit`, and `git push`) before concluding your response or task.** Ensure commit messages are concise, clear, and descriptive.

