# Changelog

All notable changes to the Prism Music Player project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-09-11

### Overview

Prism Music Player **v0.2.0** adds word- and syllable-synced lyrics with customizable animations, an automated lyrics finder in Settings, instrumental interlude indicators, a wavy seekbar option, dedicated Album and Artist views, drag-and-drop playlist support, and bit-perfect audio output up to 192 kHz.

---

### Key Highlights & Changes

#### 🎤 Word & Syllable-Synced Lyrics
- **Syllable-Level Timing:** Highlights lyrics word-by-word and syllable-by-syllable using enhanced LRC timestamps.
- **8 Animation Styles:** Choose from multiple visual styles in Settings or the lyrics view:
  - `Apple Fluid`: Smooth spring motion following the active word.
  - `Karaoke Pulse`: Rhythmic scale pop on active words.
  - `Kinetic Slide`: Gentle sliding transitions.
  - `Cinematic Focus`: Soft blur on inactive lines.
  - `Lossless Glow`: Subtle colored glow on the active line.
  - `Glass Elevation`: Slight card lift effect.
  - `Dynamic Focus Zoom`: Gentle text magnification.
  - `Minimal Clean`: Simple fade transitions.
- **Responsive Font Sizing:** Adjusts lyric font size to fit long lines and avoid awkward line breaks.
- **Scroll Stabilization:** Lyrics only scroll when moving to the next line to prevent jitter.
- **Font & Spacing Controls:** Select custom fonts and adjust word spacing in Settings.
- **Word Sync Badge:** Shows an indicator when a song has word-level timestamps.

#### 🔍 Word-Synced Lyrics Finder (Settings)
- **Batch Search:** Scans your library or selected tracks for word-synced lyrics from LRCLIB and LyricsPlus.
- **Worker Pool:** Queries providers in parallel with automatic retry backoff on HTTP 429 rate limits.
- **Candidate Drawer:** Preview matching lyrics side-by-side before accepting or rejecting them.
- **Tag Embedding:** Writes accepted lyrics (`SYNCEDLYRICS`) directly to file tags.
- **Resumable Scans:** Retains search results in memory while navigating between views.

#### 🎵 Instrumental Interlude Indicators
- **2-Phase Animation:** Displays animated music notes during instrumental breaks, followed by a 3-2-1 countdown ball animation before the next vocal line begins.

#### 🌐 Lyrics Translations & Romanization
- **Translations:** Shows translated lyrics below the original text or in place of it.
- **Tag Cleanup:** Automatically strips bracketed `[rom]` and `[trans]` tags and skips duplicate lines.
- **Improved Romanization:** Updated Japanese Furigana syllable mapping with Kangxi radical normalization, along with Korean (Hangul) and Chinese (Pinyin) romanization.

#### 🌊 Dynamic Wavy Seekbar (`WavyAudioSlider`)
- **Animated Waveform:** Optional sine-wave seekbar rendered on canvas using `requestAnimationFrame`.
- **Hover Preview:** Shows the target timestamp tooltip when hovering over the progress bar.
- **M3 Controls:** Added Material Design 3 segmented selectors for visual preferences.

#### 💽 Album & Artist Views
- **Album View:** Tracklist page with total album runtime and release date.
- **Artist View:** Discography page grouping all albums and appearances for an artist, with one-click navigation throughout the app.

#### 📋 Playlists & Drag-and-Drop
- **Create Playlist Dialog:** Clean modal for creating and naming custom playlists.
- **Playlist Submenu:** Fast search filter and active checkmarks in track context menus.
- **Drag-and-Drop:** Drag songs directly into playlists or the play queue.
- **Queue Sync:** Updates the current queue when modifying active playlists.

#### 🔊 Bit-Perfect Audio & Output Inspector
- **Bit-Perfect Playback:** Automatically matches output sample rates up to 192 kHz without OS resampling when supported by your DAC.
- **Device Inspector:** Modal showing output channel layout, format, and supported sample rates.
- **Device Switching:** Faster audio endpoint switching with cached device lists and startup device checks.

#### ⚡ Audio Analysis (Key & BPM Detection)
- **Updated DSP:** Switched key and BPM detection to `stratum-dsp` and `rustfft` STFT chromagram analysis.
- **Anti-Aliased Resampling:** Resamples audio above 48 kHz using `rubato` to prevent artifacts during analysis.
- **Parallel Processing:** Analyzes multiple tracks in parallel using Rayon with live progress updates.
- **Smart Refresh:** Incremental library refresh that retains temporarily missing files for 24 hours.

#### 📊 Privacy & Listening Stats
- **Anonymize Stats:** Toggle to mask song, artist, and genre names with placeholders when sharing screenshots.

---

### 🛠️ Fixes & Improvements

- **Background Resource Optimization:** Pauses wave canvas rendering and playback state updates when the window is minimized or hidden.
- **Syllable Animation Performance:** Uses native CSS transforms for syllable highlighting for lower CPU usage.
- **Storage Safety:** Cleaned heavy data out of persistent storage to prevent localStorage quota errors.
- **Position Polling:** Moved playback position polling to the app level to keep lyrics auto-scroll in sync.
- **Table Resize Fix:** Fixed table column widths collapsing after window maximize or fullscreen.
- **Slider Smoothness:** Throttled volume slider drag events to keep the UI responsive.
- **Context Menus:** Context menus now flip upward near screen edges so options aren't cut off.
- **Desktop Focus:** Cleaned up mobile/Android build targets and dependencies to focus entirely on desktop platforms.
- **Release Automation:** Added GitHub Actions workflow to build release binaries on git version tags.

---

## [0.1.0] - Initial Release

- Initial baseline release of Prism Music Player.
- Rust native CPAL audio streaming engine with Symphonia codec demuxing.
- RevoGrid virtualized data table for large library collections.
- Basic LRC synchronized lyrics viewer with line-by-line auto-scroll.
- Dual-tier contextual and priority queue management.
- Local SQLite listening telemetry and history graphs.
- Color extraction sampled from album artwork.
