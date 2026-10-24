# Prism Companion & Multi-Device P2P Synchronization Architecture

## Overview
Prism features a low-latency, bidirectional peer-to-peer (P2P) synchronization protocol designed for companions (Android phones, tablets, laptops, and secondary desktops). It enables seamless remote control, library matching, synchronized multi-room playback, and offline scrobbling/listening stats synchronization.

---

## 📡 Networking & Discovery Architecture

1. **mDNS Service Broadcasting**:
   - Primary service: `_prism._tcp.local.` on port `9876` (and fallback `8765`).
   - Secondary service: `_prism-sync._tcp.local.`.
   - TXT Records: `token=<16-char-secret>`, `name=<device_name>`, `version=1.0.0`.
2. **Offline Direct Pairing & QR Scanning**:
   - Pairing URI: `prism://pair?host=<ip>&port=<port>&token=<token>&name=<encoded_name>`
   - Direct string fallback: `<host>:<port>:<token>`
   - USB Reverse Tunneling: `adb reverse tcp:9876 tcp:9876` (connects via `127.0.0.1:9876`).
3. **Transport Layer**:
   - Cleartext/LAN WebSocket listener (`ws://<ip>:<port>/prism-sync`).
   - Instant authentication check on initial handshake frame or `X-Prism-Auth-Token` HTTP header.

---

## 🔄 Protocol Message Frames (`SyncFrame`)

All frames are JSON payloads tagged with `"type"`:

### 1. `handshake_req` (Client ➔ Host)
```json
{
  "type": "handshake_req",
  "clientToken": "16_CHAR_AUTH_TOKEN",
  "deviceName": "OnePlus 11 / Laptop Companion",
  "clientVersion": "1.0.0"
}
```

### 2. `handshake_resp` (Host ➔ Client)
```json
{
  "type": "handshake_resp",
  "isApproved": true,
  "serverDeviceName": "Prism Desktop (DESKTOP-ABC)",
  "sessionId": "sess_39f21"
}
```

### 3. `state_sync` (Bidirectional)
Broadcasts playback state whenever track, position, volume, queue, shuffle, or play/pause status updates:
```json
{
  "type": "state_sync",
  "playbackState": {
    "currentTrack": {
      "id": "trk_123",
      "uri": "file:///C:/Music/Artist/Song.flac",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "durationMs": 240000,
      "format": "FLAC",
      "artworkUri": "data:image/jpeg;base64,...",
      "lyrics": "[00:12.00]Lyrics..."
    },
    "isPlaying": true,
    "positionMs": 42150,
    "durationMs": 240000,
    "isShuffled": false,
    "repeatMode": "OFF",
    "volume": 0.85,
    "queueIndex": 3,
    "activeDeviceId": "desktop",
    "queue": [...]
  }
}
```

### 4. `command` (Client ➔ Host / Peer)
Supported actions:
- `PLAY_TRACK`: Direct track selection from companion library.
  ```json
  {
    "type": "command",
    "action": "PLAY_TRACK",
    "trackTitle": "Song Title",
    "trackArtist": "Artist Name",
    "trackFilename": "Song.flac",
    "trackUri": "file:///path/to/Song.flac"
  }
  ```
  *Matching Rule*: The desktop matches against library and queue by normalized filename (e.g. `Song.flac` via Syncthing parity) or `title + artist`.
- `PLAY`, `PAUSE`, `TOGGLE_PLAY_PAUSE`: Playback toggle.
- `SEEK`: `{"action": "SEEK", "seekPositionMs": 45000}`.
- `SKIP_NEXT`, `SKIP_PREVIOUS`: Queue navigation.
- `SET_VOLUME`: `{"action": "SET_VOLUME", "volume": 0.7}`.
- `TOGGLE_SHUFFLE`: Shuffle toggle.
- `SET_REPEAT`: `{"action": "SET_REPEAT", "repeatMode": "ALL" | "ONE" | "OFF"}`.

### 5. `swap_device`
Transfers active audio output target between `desktop`, `local` (phone/laptop), or multi-device.

### 6. `stats_sync`
Syncs offline scrobbling/listening event records between devices.

---

## 🔒 Pairing Management & Deleting Pairings

### Managing Paired Devices
1. **Auto-Reconnection**:
   - Clients persist approved pairings (`host`, `port`, `token`, `deviceName`) in secure preferences.
   - On launch, clients attempt auto-connection using the saved token. If reachable, the handshake succeeds automatically.
2. **Deleting Pairings (Client-Side)**:
   - When a user clicks **Delete Pairing** in the client's Device Switcher, the saved device is removed from local storage and the socket connection is cleanly severed (`TransportConnectionState.Disconnected`).
3. **Revoking / Unpairing Devices (Host-Side)**:
   - In `CompanionPairingModal`, the host lists connected and paired clients.
   - Host can click **Unpair** next to any companion device.
   - Host can click **Rotate Secret** to regenerate a new random 16-character token, immediately rejecting any future handshakes from previous pairing keys.
