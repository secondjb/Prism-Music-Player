use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use futures::{SinkExt, StreamExt};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::http::StatusCode;
use tokio_tungstenite::tungstenite::Message;

pub use crate::stats::SyncListeningEvent;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestTrackEntry {
    pub filename: String,
    pub title: String,
    pub artist: String,
    #[serde(rename = "sizeBytes", default)]
    pub size_bytes: i64,
    #[serde(rename = "durationSecs", default)]
    pub duration_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncFrame {
    #[serde(rename = "handshake_req")]
    HandshakeReq {
        #[serde(rename = "clientToken")]
        client_token: String,
        #[serde(rename = "deviceName")]
        device_name: String,
        #[serde(rename = "clientVersion", default = "default_client_version")]
        client_version: String,
    },
    #[serde(rename = "handshake_resp")]
    HandshakeResp {
        #[serde(rename = "isApproved")]
        is_approved: bool,
        #[serde(rename = "serverDeviceName")]
        server_device_name: String,
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "state_sync")]
    StateSync {
        #[serde(rename = "playbackState")]
        playback_state: serde_json::Value,
    },
    #[serde(rename = "queue_sync")]
    QueueSync {
        queue: Vec<serde_json::Value>,
        #[serde(rename = "currentIndex")]
        current_index: usize,
    },
    #[serde(rename = "command")]
    Command {
        action: String,
        #[serde(rename = "seekPositionMs", default)]
        seek_position_ms: Option<i64>,
        #[serde(default)]
        volume: Option<f32>,
        #[serde(rename = "repeatMode", default)]
        repeat_mode: Option<String>,
        #[serde(rename = "trackTitle", default)]
        track_title: Option<String>,
        #[serde(rename = "trackArtist", default)]
        track_artist: Option<String>,
        #[serde(rename = "trackFilename", default)]
        track_filename: Option<String>,
        #[serde(rename = "trackUri", default)]
        track_uri: Option<String>,
        #[serde(rename = "queueFilenames", default)]
        queue_filenames: Option<Vec<String>>,
        #[serde(rename = "sleepTimerMode", default)]
        sleep_timer_mode: Option<String>,
        #[serde(rename = "sleepTimerValue", default)]
        sleep_timer_value: Option<i64>,
    },
    #[serde(rename = "swap_device")]
    SwapDevice {
        #[serde(rename = "targetDeviceId")]
        target_device_id: String,
    },
    #[serde(rename = "stats_sync")]
    StatsSync {
        events: Vec<SyncListeningEvent>,
    },
    #[serde(rename = "track_not_found")]
    TrackNotFound {
        #[serde(rename = "trackTitle")]
        track_title: String,
        #[serde(rename = "trackArtist")]
        track_artist: String,
        #[serde(rename = "trackFilename")]
        track_filename: String,
    },
    #[serde(rename = "manifest_req")]
    ManifestReq {
        #[serde(rename = "clientType", default = "default_client_type")]
        client_type: String,
    },
    #[serde(rename = "manifest_resp")]
    ManifestResp {
        tracks: Vec<ManifestTrackEntry>,
    },
    #[serde(rename = "file_chunk")]
    FileChunk {
        #[serde(rename = "fileId")]
        file_id: String,
        #[serde(rename = "chunkIndex")]
        chunk_index: usize,
        #[serde(rename = "totalChunks")]
        total_chunks: usize,
        #[serde(rename = "dataBase64")]
        data_base64: String,
        #[serde(rename = "sizeBytes")]
        size_bytes: i64,
        #[serde(rename = "isLast")]
        is_last: bool,
    },
    #[serde(rename = "routing_sync")]
    RoutingSync {
        #[serde(rename = "isDesktopEnabled")]
        is_desktop_enabled: bool,
        #[serde(rename = "isCompanionEnabled")]
        is_companion_enabled: bool,
        #[serde(rename = "starredDeviceId", default)]
        starred_device_id: Option<String>,
    },
}

fn default_client_type() -> String {
    "desktop".to_string()
}

fn default_client_version() -> String {
    "1.0.0".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2pSyncInfo {
    pub is_running: bool,
    pub host: String,
    pub port: u16,
    pub token: String,
    pub pairing_uri: String,
    pub raw_pairing_string: String,
    pub device_name: String,
    pub connected_clients: usize,
    pub active_device_id: String,
}

pub struct SyncState {
    pub token: RwLock<String>,
    pub port: u16,
    pub local_ip: RwLock<String>,
    pub device_name: String,
    pub active_device_id: RwLock<String>,
    pub connected_clients: Arc<AtomicUsize>,
    pub broadcast_tx: tokio::sync::broadcast::Sender<String>,
    pub mdns_daemon: RwLock<Option<ServiceDaemon>>,
}

impl SyncState {
    pub fn new(port: u16) -> Self {
        let (broadcast_tx, _) = tokio::sync::broadcast::channel(256);
        let hostname = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "Desktop".to_string());
        let device_name = format!("Prism Desktop ({})", hostname);

        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        let token = generate_token();

        Self {
            token: RwLock::new(token),
            port,
            local_ip: RwLock::new(local_ip),
            device_name,
            active_device_id: RwLock::new("desktop".to_string()),
            connected_clients: Arc::new(AtomicUsize::new(0)),
            broadcast_tx,
            mdns_daemon: RwLock::new(None),
        }
    }

    pub fn get_info(&self) -> P2pSyncInfo {
        let token = self.token.read().clone();
        let host = self.local_ip.read().clone();
        let port = self.port;
        let device_name = self.device_name.clone();
        let pairing_uri = format!(
            "prism://pair?host={}&port={}&token={}&name={}",
            host,
            port,
            token,
            urlencoding_simple(&device_name)
        );
        let raw_pairing_string = format!("{}:{}:{}", host, port, token);

        P2pSyncInfo {
            is_running: true,
            host,
            port,
            token,
            pairing_uri,
            raw_pairing_string,
            device_name,
            connected_clients: self.connected_clients.load(Ordering::Relaxed),
            active_device_id: self.active_device_id.read().clone(),
        }
    }

    pub fn refresh_local_ip(&self) {
        if let Ok(ip) = local_ip_address::local_ip() {
            *self.local_ip.write() = ip.to_string();
        }
    }

    pub fn register_mdns_services(&self) {
        if let Ok(daemon) = ServiceDaemon::new() {
            let host_name = format!("{}.local.", std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Desktop".to_string()));
            let instance_name = format!("Prism-Windows-{}", std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Desktop".to_string()));
            let token = self.token.read().clone();
            let ip = self.local_ip.read().clone();

            let mut properties = HashMap::new();
            properties.insert("token".to_string(), token.clone());
            properties.insert("version".to_string(), "1.0.0".to_string());
            properties.insert("name".to_string(), self.device_name.clone());

            // 1. Primary service type matching Android NsdManager query "_prism._tcp."
            if let Ok(info_prism) = ServiceInfo::new(
                "_prism._tcp.local.",
                &instance_name,
                &host_name,
                &ip,
                self.port,
                properties.clone(),
            ) {
                let _ = daemon.register(info_prism);
            }

            // 2. Secondary service type matching specification "_prism-sync._tcp.local."
            if let Ok(info_prism_sync) = ServiceInfo::new(
                "_prism-sync._tcp.local.",
                &instance_name,
                &host_name,
                &ip,
                self.port,
                properties,
            ) {
                let _ = daemon.register(info_prism_sync);
            }

            *self.mdns_daemon.write() = Some(daemon);
            eprintln!("[mDNS] Advertised _prism._tcp and _prism-sync._tcp on {}:{}", ip, self.port);
        }
    }

    pub fn update_mdns_token(&self) {
        if let Some(daemon) = self.mdns_daemon.write().take() {
            let _ = daemon.shutdown();
        }
        self.register_mdns_services();
    }
}

pub fn generate_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let mut rng = rand::thread_rng();
    (0..16)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn urlencoding_simple(s: &str) -> String {
    let mut encoded = String::new();
    for c in s.chars() {
        if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
            encoded.push(c);
        } else {
            encoded.push_str(&format!("%{:02X}", c as u32));
        }
    }
    encoded
}

/// Spawns the dedicated WebSocket listener on LAN port 9876 and fallback/compat port 8765
pub fn start_p2p_sync_server(app_handle: AppHandle, sync_state: Arc<SyncState>) {
    let state_for_server = sync_state.clone();
    let app_for_server = app_handle.clone();

    // Advertise on mDNS
    sync_state.register_mdns_services();

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .thread_name("prism-p2p-sync")
            .build()
        {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[P2P Sync] Failed to build Tokio runtime: {}", e);
                return;
            }
        };

        rt.block_on(async move {
            let primary_port = state_for_server.port;
            // Support both primary 9876 and companion compatibility port 8765
            let ports = if primary_port == 8765 {
                vec![8765, 9876]
            } else {
                vec![primary_port, 8765]
            };

            for port in ports {
                let client_state = state_for_server.clone();
                let client_app = app_for_server.clone();
                let addr = SocketAddr::from(([0, 0, 0, 0], port));

                match TcpListener::bind(addr).await {
                    Ok(listener) => {
                        eprintln!("[P2P Sync] Listening for companion connections on ws://0.0.0.0:{}/prism-sync", port);
                        tokio::spawn(async move {
                            while let Ok((stream, peer_addr)) = listener.accept().await {
                                let s = client_state.clone();
                                let a = client_app.clone();
                                tokio::spawn(async move {
                                    handle_client_connection(stream, peer_addr, s, a).await;
                                });
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[P2P Sync] Note: could not bind port {}: {}", port, e);
                    }
                }
            }

            // Keep the Tokio runtime alive indefinitely
            futures::future::pending::<()>().await;
        });
    });
}

async fn handle_client_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    sync_state: Arc<SyncState>,
    app_handle: AppHandle,
) {
    let mut pre_authenticated = false;
    let expected_token = sync_state.token.read().clone();

    let callback = |req: &Request, resp: Response| {
        let path = req.uri().path();
        if path != "/prism-sync" && path != "/" {
            let err_resp = Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Some("Not Found".to_string()))
                .unwrap();
            return Err(err_resp);
        }

        if let Some(token_header) = req.headers().get("X-Prism-Auth-Token") {
            if let Ok(token_str) = token_header.to_str() {
                if token_str == expected_token {
                    pre_authenticated = true;
                } else {
                    let err_resp = Response::builder()
                        .status(StatusCode::UNAUTHORIZED)
                        .body(Some("Unauthorized: Invalid token".to_string()))
                        .unwrap();
                    return Err(err_resp);
                }
            }
        }
        Ok(resp)
    };

    let ws_stream = match accept_hdr_async(stream, callback).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[P2P Sync] WebSocket handshake failed from {}: {}", peer_addr, e);
            return;
        }
    };

    let current_clients = sync_state.connected_clients.fetch_add(1, Ordering::SeqCst) + 1;
    eprintln!("[P2P Sync] Companion connected from {} (total clients: {})", peer_addr, current_clients);
    let _ = app_handle.emit("p2p-client-count-changed", current_clients);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut broadcast_rx = sync_state.broadcast_tx.subscribe();

    let mut is_authenticated = pre_authenticated;
    let (outgoing_tx, mut outgoing_rx) = tokio::sync::mpsc::channel::<String>(128);

    // Outgoing forwarder task with 3-second heartbeat ping
    let writer_task = tokio::spawn(async move {
        let mut ping_interval = tokio::time::interval(tokio::time::Duration::from_secs(3));
        ping_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                _ = ping_interval.tick() => {
                    if let Err(_) = ws_sender.send(Message::Ping(vec![])).await {
                        break;
                    }
                }
                Some(direct_msg) = outgoing_rx.recv() => {
                    if let Err(_) = ws_sender.send(Message::Text(direct_msg)).await {
                        break;
                    }
                }
                Ok(broadcast_msg) = broadcast_rx.recv() => {
                    if let Err(_) = ws_sender.send(Message::Text(broadcast_msg)).await {
                        break;
                    }
                }
                else => break,
            }
        }
    });

    // If pre-authenticated by header, ask frontend to push state_sync
    if is_authenticated {
        let _ = app_handle.emit("p2p-request-state-sync", ());
    }

    // Incoming reader loop with 7-second dead-peer detection
    loop {
        let msg_result = match tokio::time::timeout(tokio::time::Duration::from_secs(7), ws_receiver.next()).await {
            Ok(Some(res)) => res,
            Ok(None) => break,
            Err(_) => {
                eprintln!("[P2P Sync] Activity timeout from {} (companion disconnected/unplugged)", peer_addr);
                break;
            }
        };
        let msg = match msg_result {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[P2P Sync] WebSocket read error from {}: {}", peer_addr, e);
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                if let Ok(frame) = serde_json::from_str::<SyncFrame>(&text) {
                    match frame {
                        SyncFrame::HandshakeReq { client_token, device_name, client_version } => {
                            let valid_token = sync_state.token.read().clone();
                            if client_token == valid_token {
                                is_authenticated = true;
                                let session_id = format!("sess_{:x}", rand::random::<u32>());
                                let resp = SyncFrame::HandshakeResp {
                                    is_approved: true,
                                    server_device_name: sync_state.device_name.clone(),
                                    session_id,
                                };
                                if let Ok(resp_json) = serde_json::to_string(&resp) {
                                    let _ = outgoing_tx.send(resp_json).await;
                                }
                                eprintln!("[P2P Sync] Handshake approved for device '{}' (v{})", device_name, client_version);
                                let _ = app_handle.emit("p2p-client-paired", serde_json::json!({
                                    "deviceName": device_name,
                                    "clientVersion": client_version
                                }));
                                // Trigger state sync to companion immediately
                                let _ = app_handle.emit("p2p-request-state-sync", ());

                                // Automatically send listening statistics to companion on connect
                                if let Some(db_state) = app_handle.try_state::<crate::stats::DbState>() {
                                    if let Ok(lock) = db_state.db.lock() {
                                        if let Some(conn) = lock.as_ref() {
                                            if let Ok(events) = crate::stats::fetch_synced_events_internal(conn) {
                                                if !events.is_empty() {
                                                    let stats_frame = SyncFrame::StatsSync { events };
                                                    if let Ok(json) = serde_json::to_string(&stats_frame) {
                                                        let _ = outgoing_tx.send(json).await;
                                                        eprintln!("[P2P Sync] Dispatched stats sync to connected companion");
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                let resp = SyncFrame::HandshakeResp {
                                    is_approved: false,
                                    server_device_name: sync_state.device_name.clone(),
                                    session_id: String::new(),
                                };
                                if let Ok(resp_json) = serde_json::to_string(&resp) {
                                    let _ = outgoing_tx.send(resp_json).await;
                                }
                                eprintln!("[P2P Sync] Handshake rejected for device '{}' (invalid token)", device_name);
                                break;
                            }
                        }
                        SyncFrame::Command {
                            action,
                            seek_position_ms,
                            volume,
                            repeat_mode,
                            track_title,
                            track_artist,
                            track_filename,
                            track_uri,
                            queue_filenames,
                            sleep_timer_mode,
                            sleep_timer_value,
                        } => {
                            if !is_authenticated {
                                continue;
                            }
                            let _ = app_handle.emit("p2p-command", serde_json::json!({
                                "action": action,
                                "seekPositionMs": seek_position_ms,
                                "volume": volume,
                                "repeatMode": repeat_mode,
                                "trackTitle": track_title,
                                "trackArtist": track_artist,
                                "trackFilename": track_filename,
                                "trackUri": track_uri,
                                "queueFilenames": queue_filenames,
                                "sleepTimerMode": sleep_timer_mode,
                                "sleepTimerValue": sleep_timer_value
                            }));
                        }
                        SyncFrame::SwapDevice { target_device_id } => {
                            if !is_authenticated {
                                continue;
                            }
                            *sync_state.active_device_id.write() = target_device_id.clone();
                            let _ = app_handle.emit("p2p-swap-device", serde_json::json!({
                                "targetDeviceId": target_device_id
                            }));
                        }
                        SyncFrame::RoutingSync { is_desktop_enabled, is_companion_enabled, starred_device_id } => {
                            if !is_authenticated {
                                continue;
                            }
                            let _ = app_handle.emit("p2p-routing-sync", serde_json::json!({
                                "isDesktopEnabled": is_desktop_enabled,
                                "isCompanionEnabled": is_companion_enabled,
                                "starredDeviceId": starred_device_id
                            }));
                        }
                        SyncFrame::StatsSync { events } => {
                            if !is_authenticated {
                                continue;
                            }
                            if let Some(db_state) = app_handle.try_state::<crate::stats::DbState>() {
                                if let Ok(lock) = db_state.db.lock() {
                                    if let Some(conn) = lock.as_ref() {
                                        if let Ok(inserted) = crate::stats::insert_synced_events(conn, &events) {
                                            eprintln!("[P2P Sync] Synced {} new listening stats events from companion", inserted);
                                            let _ = app_handle.emit("p2p-stats-synced", inserted);
                                        }
                                    }
                                }
                            }
                        }
                        SyncFrame::ManifestReq { client_type } => {
                            if !is_authenticated {
                                continue;
                            }
                            eprintln!("[P2P Sync] Received ManifestReq from {}", client_type);
                            let _ = app_handle.emit("p2p-manifest-req", ());
                        }
                        SyncFrame::ManifestResp { tracks } => {
                            if !is_authenticated {
                                continue;
                            }
                            let _ = app_handle.emit("p2p-manifest-resp", serde_json::to_value(&tracks).unwrap_or_default());
                        }
                        SyncFrame::TrackNotFound { track_title, track_artist, track_filename } => {
                            if !is_authenticated {
                                continue;
                            }
                            let _ = app_handle.emit("p2p-track-not-found", serde_json::json!({
                                "trackTitle": track_title,
                                "trackArtist": track_artist,
                                "trackFilename": track_filename
                            }));
                        }
                        SyncFrame::FileChunk {
                            file_id,
                            chunk_index,
                            total_chunks: _,
                            data_base64,
                            size_bytes: _,
                            is_last,
                        } => {
                            if !is_authenticated {
                                continue;
                            }
                            use base64::prelude::*;
                            if let Ok(bytes) = BASE64_STANDARD.decode(&data_base64) {
                                let music_dir = std::env::var("USERPROFILE")
                                    .map(|u| std::path::PathBuf::from(u).join("Music"))
                                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                                let prism_dir = music_dir.join("Prism");
                                let _ = std::fs::create_dir_all(&prism_dir);
                                let tmp_file = prism_dir.join(format!("{}.tmp", file_id));

                                use std::io::Write;
                                if chunk_index == 0 {
                                    let _ = std::fs::remove_file(&tmp_file);
                                }
                                if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&tmp_file) {
                                    let _ = f.write_all(&bytes);
                                }

                                if is_last {
                                    let target_file = prism_dir.join(&file_id);
                                    if !target_file.exists() {
                                        let _ = std::fs::rename(&tmp_file, &target_file);
                                        eprintln!("[P2P Sync] Successfully received file from companion: {:?}", target_file);
                                        let _ = app_handle.emit("p2p-file-received", target_file.to_string_lossy().to_string());
                                    } else {
                                        let _ = std::fs::remove_file(&tmp_file);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            Message::Ping(_) => {
                // Tungstenite automatically responds with pong
            }
            Message::Pong(_) => {
                // Heartbeat alive
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    writer_task.abort();
    let remaining_clients = sync_state.connected_clients.fetch_sub(1, Ordering::SeqCst).saturating_sub(1);
    eprintln!("[P2P Sync] Companion disconnected from {} (remaining: {})", peer_addr, remaining_clients);
    let _ = app_handle.emit("p2p-client-count-changed", remaining_clients);
}

// ---------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdbReverseResult {
    pub success: bool,
    pub message: String,
    pub device_found: bool,
}

#[tauri::command]
pub fn setup_adb_reverse() -> AdbReverseResult {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let sdk_adb = std::path::PathBuf::from(&local_app_data)
        .join("Android")
        .join("Sdk")
        .join("platform-tools")
        .join("adb.exe");

    let adb_path = if sdk_adb.exists() {
        sdk_adb.to_string_lossy().to_string()
    } else {
        "adb".to_string()
    };

    let check_cmd = std::process::Command::new(&adb_path)
        .arg("devices")
        .output();

    let output = match check_cmd {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(e) => return AdbReverseResult {
            success: false,
            message: format!("ADB executable not found: {}", e),
            device_found: false,
        },
    };

    let has_device = output.lines().any(|l| l.contains("\tdevice"));
    if !has_device {
        return AdbReverseResult {
            success: false,
            message: "No Android device detected over USB. Ensure USB Debugging is enabled.".to_string(),
            device_found: false,
        };
    }

    let _ = std::process::Command::new(&adb_path)
        .args(&["reverse", "tcp:9876", "tcp:9876"])
        .output();

    let _ = std::process::Command::new(&adb_path)
        .args(&["reverse", "tcp:8765", "tcp:8765"])
        .output();

    AdbReverseResult {
        success: true,
        message: "USB reverse proxy active! Port 9876 and 8765 bridged over USB cable.".to_string(),
        device_found: true,
    }
}

#[tauri::command]
pub fn get_p2p_sync_info(sync_state: State<'_, Arc<SyncState>>) -> P2pSyncInfo {

    sync_state.refresh_local_ip();
    sync_state.get_info()
}

#[tauri::command]
pub fn regenerate_p2p_pairing_token(sync_state: State<'_, Arc<SyncState>>) -> P2pSyncInfo {
    let new_token = generate_token();
    *sync_state.token.write() = new_token;
    sync_state.refresh_local_ip();
    sync_state.update_mdns_token();
    sync_state.get_info()
}

#[tauri::command]
pub fn broadcast_p2p_frame(sync_state: State<'_, Arc<SyncState>>, frame_json: String) -> Result<(), String> {
    let _ = sync_state.broadcast_tx.send(frame_json);
    Ok(())
}

#[tauri::command]
pub fn send_p2p_stats_sync(app_handle: AppHandle, sync_state: State<'_, Arc<SyncState>>) -> Result<usize, String> {
    let db_state = app_handle.try_state::<crate::stats::DbState>().ok_or("Database state missing")?;
    let lock = db_state.db.lock().map_err(|_| "Failed to acquire db lock")?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    let events = crate::stats::fetch_synced_events_internal(conn)?;
    let count = events.len();
    let frame = SyncFrame::StatsSync { events };
    let json = serde_json::to_string(&frame).map_err(|e| e.to_string())?;

    let _ = sync_state.broadcast_tx.send(json);
    Ok(count)
}

#[tauri::command]
pub fn set_p2p_active_device(sync_state: State<'_, Arc<SyncState>>, device_id: String) -> Result<(), String> {
    *sync_state.active_device_id.write() = device_id.clone();
    let frame = SyncFrame::SwapDevice {
        target_device_id: device_id,
    };
    if let Ok(json) = serde_json::to_string(&frame) {
        let _ = sync_state.broadcast_tx.send(json);
    }
    Ok(())
}

#[tauri::command]
pub async fn send_p2p_file(
    sync_state: State<'_, Arc<SyncState>>,
    file_path: String,
    file_id: String,
) -> Result<(), String> {
    use std::io::Read;
    use base64::prelude::*;

    let path = std::path::PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let total_size = file.metadata().map(|m| m.len()).unwrap_or(0);

    const CHUNK_SIZE: usize = 512 * 1024;
    let total_chunks = ((total_size as f64) / (CHUNK_SIZE as f64)).ceil() as usize;
    let total_chunks = if total_chunks == 0 { 1 } else { total_chunks };

    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut chunk_index = 0;

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 && chunk_index > 0 {
            break;
        }

        let is_last = bytes_read < CHUNK_SIZE || chunk_index + 1 >= total_chunks;
        let data_base64 = BASE64_STANDARD.encode(&buffer[..bytes_read]);

        let frame = SyncFrame::FileChunk {
            file_id: file_id.clone(),
            chunk_index,
            total_chunks,
            data_base64,
            size_bytes: total_size as i64,
            is_last,
        };

        if let Ok(json) = serde_json::to_string(&frame) {
            let _ = sync_state.broadcast_tx.send(json);
        }

        chunk_index += 1;
        if is_last {
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;
    }

    Ok(())
}
