# Prism Music Player

<div align="center">

[![Rust Version](https://img.shields.io/badge/rust-1.77%2B-orange.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri Version](https://img.shields.io/badge/tauri-v2.0-blue.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![React Version](https://img.shields.io/badge/react-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg?style=flat-square)](#system-requirements)

**An ultra-high-fidelity local music player and audio workstation engine engineered with Tauri v2, Rust, and React 19.**

*Bit-Perfect Direct Hardware Output • Real-Time DSP Audio Analysis • Synced LRC & Multi-Language Romanization • Virtualized Performance Engine*

</div>

---

## Table of Contents

- [Overview](#overview)
- [Interface Showcase & Screenshots](#interface-showcase--screenshots)
- [System Architecture & Backend Pipeline](#system-architecture--backend-pipeline)
  - [Native Audio Engine (WASAPI & CPAL)](#1-native-audio-engine-wasapi--cpal)
  - [DSP Audio Analysis Engine (BPM & Key Detection)](#2-dsp-audio-analysis-engine-bpm--key-detection)
  - [Metadata Extraction & Storage Optimization](#3-metadata-extraction--storage-optimization)
  - [Lyrics Engine & Multi-Script Romanization](#4-lyrics-engine--multi-script-romanization)
  - [Local Telemetry & Listening Analytics](#5-local-telemetry--listening-analytics)
- [Core Features](#core-features)
- [Audio & DSP Technical Specifications](#audio--dsp-technical-specifications)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Local Development](#installation--local-development)
- [Building & Packaging](#building--packaging)
  - [Windows Standalone Production Executable](#windows-standalone-production-executable)
  - [Cross-Platform Tauri Bundles](#cross-platform-tauri-bundles)
- [Configuration & Keybindings](#configuration--keybindings)

---

## Overview

**Prism Music Player** is a desktop audio workstation and library management system designed for audiophiles, producers, and local music collectors. Modern web-based audio players often suffer from high memory footprints, OS mixer resampling artifacts, sluggish UI rendering with large libraries, and lack of deep audio DSP inspection.

Prism solves these challenges by combining a **bare-metal Rust audio pipeline** with a **hardware-accelerated React 19 / Vite interface** powered by Tauri v2:

1. **Bit-Perfect Direct Hardware Streaming:** Bypasses lossy system sample-rate converters by negotiating matching native sample rates and bit depths directly with output DACs and audio endpoints.
2. **On-the-Fly Audio Waveform DSP:** Analyzes raw decoded PCM waveforms across all CPU cores to compute musical key signatures and tempo (BPM). This feature is built for future automated dynamic playlist generation (leveraging AI and advanced harmonic/tempo filtering). While waveform DSP estimation is not 100% perfectly accurate for complex polyrhythmic or acoustically irregular music, it is very close for the vast majority of tracks.
3. **Tens-of-Thousands Track Scalability:** Employs an ultra-fast virtualized DOM data grid coupled with parallel multi-threaded directory indexing that loads and searches 50,000+ tracks in milliseconds.
4. **Adaptive Dynamic Theming:** Samples multi-stop color gamuts from embedded album artwork in real-time, driving an ambient UI glow and custom hardware visualizers.

---

## Interface Showcase & Screenshots

> Place your application screenshots in `docs/screenshots/` using the designated filenames below, or replace the image URLs with your preferred hosted assets.

### 1. Front Page (Main Library & Player Interface)
*High-density virtualized track table, ambient dynamic color extraction, and real-time audio playback bar.*

![Front Page](docs/screenshots/front-page.png)

---

### 2. Advanced Faceted Audio Filter
*Parametric audio filtering by Artist, Genre, Decade, Bitrate range, Sample Rate, Musical Key, and BPM.*

![Advanced Filter](docs/screenshots/advanced-filter.png)

---

### 3. Playlists & Queue Management
*Curated playlists, contextual playback, and two-tier priority drag-and-drop queue management.*

![Playlists](docs/screenshots/playlists.png)

---

### 4. Listening Statistics Dashboard
*Offline SQLite analytics graphing total listening time, hourly habits, top artists, and genre distributions.*

![Listening Stats](docs/screenshots/listening-stats.png)

---

### 5. Library Configuration & Settings
*Folder index management, DSP waveform analysis triggers, lyric settings, and demo data generator.*

![Settings](docs/screenshots/settings.png)

---

## System Architecture & Backend Pipeline

Prism employs a strict separation of concerns between its low-latency native backend (Rust) and reactive frontend (TypeScript / React 19), communicating over Tauri's binary-accelerated IPC bridge.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             REACT 19 FRONTEND                                    │
│  ┌────────────────────┐  ┌───────────────────────┐  ┌─────────────────────────┐  │
│  │  RevoGrid Table    │  │  Zustand Store        │  │  Adaptive Canvas Color  │  │
│  │  (Virtualized DOM) │  │  (Playback/Queue/Lib) │  │  (6-Stop Palette Gen)   │  │
│  └─────────┬──────────┘  └───────────┬───────────┘  └────────────┬────────────┘  │
└────────────┼─────────────────────────┼───────────────────────────┼───────────────┘
             │ Tauri IPC Invokes       │ Status/Progress Events    │
             ▼                         ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               TAURI V2 BRIDGE                                    │
│  - System Media Transport Controls (souvlaki / SMTC)                             │
│  - Asynchronous Command Router & Event Dispatcher                                │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴───────────────────────────────────────────┐
│                              RUST NATIVE CORE                                    │
│                                                                                  │
│   ┌────────────────────────────────┐       ┌──────────────────────────────────┐  │
│   │     GlobalAudioEngine          │       │      Parallel Metadata Scan      │  │
│   │  - Symphonia Decoders          │       │   - Rayon Multithreading         │  │
│   │  - Crossbeam Bounded RingBuf   │       │   - Lofty / Metaflac Tag Parser  │  │
│   │  - Linear Resampler & ReplayGain│      │   - MD5 Path Hash & Lazy Art     │  │
│   │  - CPAL Hardware Stream        │       └────────────────┬─────────────────┘  │
│   └───────────────┬────────────────┘                        │                    │
│                   │                                         ▼                    │
│                   │                        ┌──────────────────────────────────┐  │
│                   │                        │     DSP Waveform Analysis        │  │
│                   │                        │   - Rubato SincFixedIn Resampler │  │
│                   │                        │   - Stratum-DSP & RustFFT        │  │
│                   │                        │   - Parallel Batch BPM/Key Engine│  │
│                   │                        └────────────────┬─────────────────┘  │
│                   ▼                                         ▼                    │
│   ┌────────────────────────────────┐       ┌──────────────────────────────────┐  │
│   │    DAC / Audio Hardware        │       │   SQLite Listening Stats DB      │  │
│   │  (WASAPI / DirectStream / ALSA)│       │  (Embedded rusqlite Storage)     │  │
│   └────────────────────────────────┘       └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Native Audio Engine (WASAPI & CPAL)

Audio playback does **not** use browser `<audio>` elements or Web Audio API. Instead, Prism implements an autonomous, thread-isolated audio streaming engine located in `src-tauri/src/audio.rs`:

- **Dedicated Streaming Thread:** The playback loop executes on an isolated OS thread (`run_audio_thread`), completely decoupled from UI rendering cycles and garbage collection pauses.
- **Universal Codec Decoding via Symphonia:** Pure-Rust format demuxers and decoders handle FLAC, MP3, AAC, ALAC, Vorbis, Opus, WAV, and AIFF files without external DLL dependencies.
- **Bit-Perfect Hardware Negotiation:** 
  1. Inspects the source file's native sample rate (e.g., 44.1 kHz, 96 kHz, 192 kHz) and bit depth.
  2. Queries the selected audio device's supported stream configurations through `cpal`.
  3. If the audio device natively supports the source track's sample rate, Prism initializes a bit-exact stream directly at that frequency, bypassing OS mixer resampling.
  4. If the hardware requires a fixed clock (e.g., 48 kHz), an internal linear interpolation resampler transparently adapts the PCM stream with zero phase distortion.
- **Lock-Free Bounded Ring Buffer:** Audio samples pass from the decoder into the output stream using `crossbeam-channel::bounded` with instant stall detection.
- **Dynamic Stream Migration & Hot-Plugging:** Prism constantly monitors the active audio endpoint. If a user unplugs headphones, switches default devices, or selects a new output in the UI, the engine migrates the WASAPI stream on-the-fly without losing playback position.
- **Real-Time ReplayGain Scaling:** Reads embedded `REPLAYGAIN_TRACK_GAIN` and `REPLAYGAIN_TRACK_PEAK` Vorbis comments and ID3 tags, scaling linear gain via $10^{\frac{\text{dB}}{20}} \times \text{Volume}$ with hard clipping limits $[-1.0, 1.0]$.

### 2. DSP Audio Analysis Engine (BPM & Key Detection)

Located in `src-tauri/src/audio_analysis.rs`, Prism features a dedicated musical analysis engine:

- **Purpose & Future Dynamic Playlists:** The primary purpose of Key and BPM detection is to facilitate future automated dynamic playlist generation—allowing intelligent harmonic mixing (Camelot wheel transitions) and tempo-matched queue sequencing, potentially integrated with AI or multi-criteria filtering techniques.
- **Accuracy Profile:** Musical key and BPM estimation directly from raw audio is heuristic-based. While not 100% perfectly accurate on complex acoustic passages, ambient soundscapes, or meter shifts, it is very close and reliable for the vast majority of tracks.
- **Turbo Drop Sampling:** Skips the initial 45 seconds of a track to bypass atmospheric intros, extracting a high-energy 15-second mono PCM slice.
- **Anti-Aliased Sinc Resampling (Rubato):** High-sample-rate audio (>48 kHz) is downsampled to 44.1 kHz via `rubato::SincFixedIn` using a 128-sample Blackman-Harris window and 256 oversampling factor to eliminate Nyquist aliasing.
- **Fast Fourier Transform & Harmonic Analysis:** Analyzes the waveform using `stratum-dsp` and `rustfft` to compute rhythmic onset periodicity (BPM) and tonal chromagram centroids (Musical Key).
- **Rayon Multicore Batching:** Scans large libraries using all CPU cores in parallel (`rayon::par_iter()`), emitting real-time percentage progress events back to the UI.

### 3. Metadata Extraction & Storage Optimization

Located in `src-tauri/src/metadata.rs`:

- **Dual-Layer Tag Extraction:** Leverages `metaflac` for native FLAC Vorbis comments and `lofty` as a fallback for ID3v1, ID3v2, MP4/M4A atoms, and OGG containers.
- **Lightweight Library Serialization:** Embedded artwork is intentionally omitted from the persistent `library.json` database. This ensures that even a 50,000-track library stays under a few megabytes on disk and parses instantly on startup.
- **On-Demand Cover Art IPC:** Album art is read from file tags or local directory assets (`cover.jpg`, `folder.png`, etc.) on-demand and cached in the browser's memory.
- **Direct-to-Disk Lyrics Embedding:** Users can edit or fetch synchronized LRC lyrics and write them directly into the audio file's Vorbis comments block (`SYNCEDLYRICS`) with atomic file flushes.

### 4. Lyrics Engine & Multi-Script Romanization

- **LRC Synchronized Scrolling:** Parses standard timestamped LRC strings using `clrc` with millisecond precision and smooth scroll-interpolation.
- **Multi-Script Romanization:**
  - **Japanese (Romaji):** Heuristic Kana decomposition covering digraphs, palatalized sounds, and sokuon.
  - **Korean (Hangul to Romaja):** Algorithmic syllabic decomposition into Choseong (initial consonant), Jungseong (vowel), and Jongseong (final consonant).
  - **Chinese (Pinyin):** Powered by `pinyin-pro` tone normalization.
- **Dual Display Modes:** Displays romanized pronunciation directly underneath original characters or replaces the script entirely.
- **Cloud Lyrics Fetching:** Integrated with the [LRCLIB](https://lrclib.net/) REST API with automatic track title and artist search fallback.

### 5. Local Telemetry & Listening Analytics

Located in `src-tauri/src/stats.rs`:

- **Embedded SQLite Engine:** Stores historical play events inside an encrypted/isolated SQLite database (`listening_stats.db`) using `rusqlite`.
- **Zero Cloud Tracking:** All statistics remain strictly on the user's local machine.
- **Aggregation & Charting:** Aggregates top artists, top songs, listening hours, and genre distributions across Day, Week, and Month timeframes using `Chart.js` and `react-chartjs-2`.
- **Demo & Screenshot Mode:** Built-in setting to populate realistic simulated analytics data and demo playlists for testing and showcase screenshots.

---

## Core Features

| Feature Area | Capabilities |
| :--- | :--- |
| **High-Resolution Audio** | Bit-perfect hardware streaming up to 192 kHz / 32-bit float; accurate seeking; volume normalizer with ReplayGain peak limiting. |
| **Output Device Inspector** | Real-time audio endpoint modal showing device format, channel topology, sample rate clock sync, and device hot-switching. |
| **High-Scale Virtualized Table** | Custom data grid powered by `@revolist/react-datagrid` supporting density switches (compact to massive), custom column order, sorting, and inline playback. |
| **Intelligent Multi-Tier Queue** | Distinguishes between album/playlist context queue and user-prioritized queue ("Play Next" and "Add to Queue") with drag-and-drop reordering. |
| **BPM & Key Detection** | Integrated waveform DSP engine detecting tempo and harmonic key for future dynamic playlists (using AI/filtering). Highly close for most tracks. |
| **Multifaceted Filtering** | Multithreaded search by Artist, Album, Genre, Decades (70s-2020s), Year Range, Bitrate, Sample Rate, BPM, and Musical Key. |
| **Synchronized Lyrics** | Live auto-scrolling LRC view, click-line-to-seek, font size presets, direct tag embedding, and LRCLIB cloud fetching. |
| **Asian Script Romanization** | Real-time phonetic romanization for Japanese (Romaji), Korean (Hangul), and Chinese (Pinyin). |
| **Ambient Color Extraction** | Canvas-based multi-point image sampling generating 6 smooth, dark-mode-optimized palette stops dynamically derived from album art. |
| **System Integration** | Windows System Media Transport Controls (SMTC), hardware media keys (Play/Pause, Next, Previous), and Web MediaSession integration. |
| **Sleep Timer** | Timed auto-stop (minutes countdown) or track-count auto-stop with smooth playback cessation. |
| **Listening Insights** | Built-in analytics dashboard graphing listening duration, peak hours, and top artists over time with optional demo mode. |

---

## Audio & DSP Technical Specifications

```
Audio Decoding:
├── Framework:            Symphonia (Pure Rust)
├── Supported Containers: FLAC, MP3, MP4/M4A, OGG, WAV, AIFF
├── Bit Depths:           16-bit, 24-bit, 32-bit Integer, 32-bit Float
└── Channel Topologies:   Mono (1.0), Stereo (2.0), Multi-Channel (Downmixed)

Output Streaming (CPAL):
├── Backend Host:         WASAPI (Windows), ALSA / PulseAudio (Linux), CoreAudio (macOS)
├── Buffer Architecture:  Bounded RingBuffer (Crossbeam)
├── Direct Mode:          Bit-Perfect Native Rate Matching (44.1kHz - 192kHz)
├── Resampling Fallback:  Linear PCM Interpolation
└── Gain Calibration:     ReplayGain Track Gain / Peak Parsing

Digital Signal Processing:
├── Resampler:            Rubato SincFixedIn (64-bit float math, Blackman-Harris 2 window)
├── Spectral Analysis:    RustFFT & Stratum-DSP
├── Purpose:              Future Dynamic Playlists & Harmonic / Tempo Transitions (AI / Filtering)
└── Accuracy:             Heuristic approximation; very close for most tracks
```

---

## Tech Stack

### Frontend
- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build System:** [Vite 7](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + CSS Variables
- **State Management:** [Zustand 5](https://github.com/pmndrs/zustand) (with `persist` middleware)
- **Virtualized Grid:** [@revolist/react-datagrid](https://github.com/revolist/revogrid)
- **Motion & UI:** [Framer Motion](https://www.framer.com/motion/), [Lucide React Icons](https://lucide.dev/), Material UI primitives
- **Data Visualization:** [Chart.js 4](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)
- **LRC & Romanization:** `clrc`, `lyric-romanizer`, `pinyin-pro`

### Backend (Tauri / Rust)
- **App Runtime:** [Tauri v2](https://tauri.app/)
- **Audio Output:** `cpal` (0.15)
- **Audio Codecs:** `symphonia` (0.5.4) with all features enabled
- **DSP & FFT:** `stratum-dsp`, `rustfft`, `rubato`
- **Tag Extraction:** `metaflac`, `lofty`
- **Parallel Computing:** `rayon`, `crossbeam-channel`, `tokio`
- **Media Controls:** `souvlaki` (Windows SMTC / Linux MPRIS)
- **Database:** `rusqlite` (bundled SQLite 3)

---

## Directory Structure

```
Prism Music Player/
├── src/                               # React 19 Frontend
│   ├── components/                    # UI Components
│   │   ├── AlbumGrid.tsx              # Album grid view with cover cards
│   │   ├── AlbumView.tsx              # Detailed album tracklist view
│   │   ├── ArtistView.tsx             # Artist discography view
│   │   ├── ArtistsGrid.tsx            # Artist catalog cards
│   │   ├── AudioDeviceModal.tsx       # Hardware output device & DAC inspector
│   │   ├── AudioSlider.tsx            # Custom scrubbing & volume sliders
│   │   ├── BottomBar.tsx              # Persistent player control bar
│   │   ├── ColumnConfigModal.tsx      # Table column visibility & ordering
│   │   ├── FilterView.tsx             # Multi-parameter faceted filter view
│   │   ├── LyricsView.tsx             # Fullscreen synchronized LRC lyrics
│   │   ├── PlaylistView.tsx           # User playlists and track management
│   │   ├── QueueDrawer.tsx            # Dual-tier contextual & priority queue
│   │   ├── SettingsView.tsx           # Library paths, DSP tools, toggles
│   │   ├── SleepTimerModal.tsx        # Time & track count sleep timer
│   │   ├── SongInfoModal.tsx          # Deep audio metadata inspector
│   │   ├── StatsView.tsx              # Listening habits & analytics charts
│   │   ├── TrackList.tsx              # Library track listing wrapper
│   │   └── TrackTableView.tsx         # High-performance virtualized data table
│   ├── hooks/                         # Custom React hooks (table state, etc.)
│   ├── store/                         # Zustand global state (usePlayerStore)
│   ├── types/                         # TypeScript interfaces (Track, Playlist)
│   ├── utils/                         # Client utilities (color, stats, romanizer)
│   ├── App.tsx                        # Root application layout
│   └── main.tsx                       # Frontend entry point
├── src-tauri/                         # Rust Native Core
│   ├── src/
│   │   ├── audio.rs                   # CPAL audio engine, WASAPI loop, ring buffer
│   │   ├── audio_analysis.rs          # Rubato resampling & Stratum-DSP analysis
│   │   ├── metadata.rs                # Tag parsing (metaflac, lofty), library I/O
│   │   ├── stats.rs                   # SQLite database & listening event logs
│   │   ├── lib.rs                     # Tauri command definitions & event routing
│   │   └── main.rs                    # Application binary entry point
│   ├── Cargo.toml                     # Rust dependencies and compiler flags
│   └── tauri.conf.json                # Tauri v2 bundle and window configuration
├── package.json                       # Node dependencies and scripts
├── tsconfig.json                      # TypeScript configuration
└── vite.config.ts                     # Vite build configuration
```

---

## Getting Started

### Prerequisites

Ensure the following tools are installed on your workstation:

1. **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
2. **Rust & Cargo**: Latest stable toolchain ([Install via rustup](https://rustup.rs/))
3. **C++ Build Tools**:
   - **Windows:** Visual Studio C++ Build Tools or Visual Studio Community with the "Desktop development with C++" workload.
   - **Linux:** `build-essential`, `libssl-dev`, `libasound2-dev`, `libudev-dev`
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)

### Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/prism-music-player.git
   cd prism-music-player
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Launch in development mode:**
   ```bash
   npm run tauri dev
   ```
   *This command spins up the Vite development server on `localhost` with Hot Module Replacement (HMR) and compiles the Rust backend in debug mode.*

---

## Building & Packaging

### Windows Standalone Production Executable

To compile an optimized, standalone Windows binary:

```bash
npm run tauri build
```

Alternatively, you can run the included automation script on Windows:
```cmd
Build-And-Replace.bat
```
The compiled, self-contained executable will be generated at:
```
src-tauri/target/release/Prism Music Player.exe
```

### Cross-Platform Tauri Bundles

Tauri compiles native platform bundles into `src-tauri/target/release/bundle/`:

- **Windows:** `.msi` and `.exe` (NSIS installer)
- **macOS:** `.app` and `.dmg` (Universal or target-specific)
- **Linux:** `.deb`, `.AppImage`, and `.tar.gz`

To build for a specific target:
```bash
# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu

# macOS
npm run tauri build -- --target universal-apple-darwin
```

---

## Configuration & Keybindings

| Key / Action | Context | Function |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Global | Toggle Play / Pause |
| <kbd>Double Click</kbd> | Track Row | Play Track immediately in current context |
| <kbd>Media Play / Pause</kbd> | Hardware Key / SMTC | Toggle Play / Pause via OS Media Session |
| <kbd>Media Next</kbd> | Hardware Key / SMTC | Skip to Next Track |
| <kbd>Media Previous</kbd> | Hardware Key / SMTC | Return to Previous Track / Restart |
| <kbd>Click</kbd> on Lyric Line | Lyrics View | Seek playback to timestamp of clicked line |
| <kbd>Drag & Drop</kbd> | Queue Drawer | Reorder upcoming tracks dynamically |
