# Prism P2P LAN Synchronization Specification

This document details the Peer-to-Peer (P2P) Local Area Network synchronization protocol between **Prism Windows** (desktop player / host) and **Prism Android** (mobile companion).

---

## 1. Architecture Overview

```
 ┌──────────────────────────────────────┐             ┌────────────────────────────────────────┐
 │            PRISM WINDOWS             │             │             PRISM ANDROID              │
 │  - Tauri / Rust WebSocket Server     │  WebSocket  │  - OkHttp WebSocket Client             │
 │  - mDNS Beacon (_prism-sync._tcp)    │ ◄─────────► │  - NsdManager / QR Code Scanner        │
 │  - Bi-directional State Sync         │  (LAN/WiFi) │  - Bi-directional Remote Controller    │
 │  - Listening History (SQLite)        │             │  - Listening History (SQLite)          │
 └──────────────────────────────────────┘             └────────────────────────────────────────┘
```

The synchronization enables:
1. **Remote Control**: Play, pause, skip, seek, shuffle, repeat, and volume control from either device with <50ms latency.
2. **State & Queue Mirroring**: Synchronizing current track metadata, position, duration, and queue across devices in real time.
3. **Seamless Device Hand-off (Swap Target)**: Seamlessly transferring playback from Windows to Android or vice-versa while preserving playback position.
4. **Listening Stats Sync**: Bi-directional syncing of `listening_events` (plays, listening duration, timestamps).

---

## 2. Discovery & Pairing

### A. mDNS Discovery (Presence Beacon)
* **Service Type**: `_prism-sync._tcp.local.` and `_prism._tcp.local.`
* **Service Name**: `Prism-Windows-<MachineName>`
* **Port**: Configurable (default `9876`)
* **TXT Records**:
  * `version`: `1.0.0`
  * `name`: Display name of the desktop machine.
  * *Note: Pairing tokens are NEVER broadcast over mDNS to prevent LAN snooping.*

### B. Offline QR Code & Manual Pairing
For networks where mDNS / multicast is disabled, camera-less devices, or connecting two laptops:
* The Windows app displays a QR code containing the pairing URI:
  ```text
  prism://pair?host=<local_ip>&port=<port>&token=<pairing_token>&name=<name>
  ```
* Fallback manual string format supported:
  ```text
  <local_ip>:<port>:<pairing_token>
  ```
* The companion app or client laptop can either:
  1. Scan the QR code using its camera.
  2. Paste the manual pairing string / URI in the "Connect to Remote Laptop" tab.

---

## 3. Transport, Authentication & Security Architecture

* **Protocol**: WebSockets (`ws://<host>:<port>/prism-sync`)
* **Authentication**:
  * Strong 32-character high-entropy cryptographic token (`[a-zA-Z0-9]`).
  * Supported in initial HTTP Upgrade via `X-Prism-Auth-Token` header or `?token=<token>` query param.
  * Sockets unauthenticated at HTTP level must send `handshake_req` within 5 seconds or are forcibly disconnected.
  * Constant-time comparison prevents timing side-channel attacks.
* **Brute-Force Lockout**: Rate-limiter locks out IPs exceeding 5 failed authentication attempts for 60 seconds.
* **Path Traversal Defense**: File transfers (`FileChunk`) are strictly sanitized to filenames without path separators or `..`, whitelisted to audio formats only (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.opus`, etc.), capped at 250MB, and restricted to the `~/Music/Prism/` directory.
* **Command Sandboxing**: Inbound commands are strictly restricted to playback control actions (`PLAY`, `PAUSE`, `SEEK`, `SKIP_NEXT`, `SET_VOLUME`, etc.) with sanitized and clamped arguments. Arbitrary execution or system modifications are completely impossible.
* **Heartbeat**: 3-second ping intervals with 7-second dead-peer timeout.

---

## 4. Message Framing Protocol (JSON)

Every WebSocket message is a serialized JSON object tagged with a polymorphic `"type"` field matching Android's `com.secondjb.prism.core.sync.protocol.SyncFrame`.

### A. Handshake (`handshake_req` / `handshake_resp`)

#### 1. Handshake Request (Android -> Windows)
Sent immediately upon WebSocket connection open:
```json
{
  "type": "handshake_req",
  "clientToken": "abcdef123456",
  "deviceName": "OnePlus 11 (Android Companion)",
  "clientVersion": "1.0.0"
}
```

#### 2. Handshake Response (Windows -> Android)
Windows validates `clientToken` and replies:
```json
{
  "type": "handshake_resp",
  "isApproved": true,
  "serverDeviceName": "Prism Desktop - Studio PC",
  "sessionId": "sess_8941fbc0"
}
```

---

### B. Playback State Synchronization (`state_sync`)
Broadcast whenever playback status, position (debounced), track, or volume changes.

```json
{
  "type": "state_sync",
  "playbackState": {
    "currentTrack": {
      "id": "trk_1048",
      "uri": "file:///C:/Music/Album/Song.flac",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "durationMs": 242000,
      "sampleRate": 96000,
      "bitDepth": 24,
      "channels": 2,
      "bitRateKbps": 1411,
      "format": "FLAC",
      "artworkUri": "https://... or data:image/jpeg;base64,...",
      "lyrics": "[00:12.30]First line of lyrics..."
    },
    "isPlaying": true,
    "positionMs": 45100,
    "durationMs": 242000,
    "isShuffled": false,
    "repeatMode": "OFF",
    "volume": 0.85,
    "queueIndex": 3,
    "activeDeviceId": "desktop",
    "queue": [
      {
        "id": "trk_1048",
        "title": "Song Title",
        "artist": "Artist Name",
        "album": "Album Name",
        "durationMs": 242000,
        "format": "FLAC"
      }
    ]
  }
}
```

`repeatMode` values: `"OFF"`, `"ALL"`, `"ONE"`.

---

### C. Playback Command (`command`)
Sent by either device to trigger actions on the active playback engine:

```json
{
  "type": "command",
  "action": "PLAY",
  "seekPositionMs": null,
  "volume": null,
  "repeatMode": null
}
```

Supported `action` values:
- `"PLAY"`: Resume playback
- `"PAUSE"`: Pause playback
- `"TOGGLE_PLAY_PAUSE"`: Toggle play/pause
- `"SEEK"`: Seek position (requires `"seekPositionMs": <Long>`)
- `"SKIP_NEXT"`: Advance to next track
- `"SKIP_PREVIOUS"`: Return to previous track / restart current track
- `"SET_VOLUME"`: Adjust volume (requires `"volume": <Float 0.0 to 1.0>`)
- `"TOGGLE_SHUFFLE"`: Toggle shuffle mode
- `"SET_REPEAT"`: Change repeat mode (requires `"repeatMode": "OFF"|"ALL"|"ONE"`)

---

### D. Device Playback Hand-off (`swap_device`)
Transfers active audio rendering between Windows and Android:

```json
{
  "type": "swap_device",
  "targetDeviceId": "desktop"
}
```
* `"desktop"`: Audio outputs to Windows sound device.
* `"local"`: Audio outputs through Android phone / headphones.

---

### E. Listening Stats Synchronization (`stats_sync`)
Synchronizes SQLite listening events between devices:

```json
{
  "type": "stats_sync",
  "events": [
    {
      "song_title": "Song Title",
      "artist_name": "Artist Name",
      "album_name": "Album Name",
      "genre": "Rock",
      "duration_ms": 215000,
      "played_at": "2026-10-24 04:30:00"
    }
  ]
}
```

---

## 5. Recommended Windows Implementation Plan (Tauri / Rust)

1. **Rust WebSocket Server**:
   - Add `tokio-tungstenite` and `axum` in `src-tauri/Cargo.toml`.
   - Start WebSocket listener on `0.0.0.0:9876` during app startup (`src-tauri/src/main.rs`).
2. **mDNS Service Publisher**:
   - Register mDNS beacon `_prism-sync._tcp.local` using `mdns-sd`.
3. **QR Code Generation**:
   - Add QR code dialog in `prism-windows/src/components/SettingsView.tsx` and header rendering `prism://pair?host=<ip>&port=9876&token=<token>`.
4. **Store Integration**:
   - In `prism-windows/src/store/usePlayerStore.ts`:
     - Dispatch `state_sync` on store changes (`currentTrack`, `isPlaying`, `position`, `volume`).
     - Handle incoming `command` frames by calling existing store playback actions.
