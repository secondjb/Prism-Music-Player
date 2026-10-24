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

/// Spawns the dedicated WebSocket listener on LAN port 9876
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
            let addr = SocketAddr::from(([0, 0, 0, 0], state_for_server.port));
            let listener = match TcpListener::bind(addr).await {
                Ok(l) => {
                    eprintln!("[P2P Sync] Listening for companion connections on ws://0.0.0.0:{}/prism-sync", state_for_server.port);
                    l
                }
                Err(e) => {
                    eprintln!("[P2P Sync] Failed to bind TCP listener on port {}: {}", state_for_server.port, e);
                    return;
                }
            };

            while let Ok((stream, peer_addr)) = listener.accept().await {
                let client_state = state_for_server.clone();
                let client_app = app_for_server.clone();

                tokio::spawn(async move {
                    handle_client_connection(stream, peer_addr, client_state, client_app).await;
                });
            }
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

    // Outgoing forwarder task
    let writer_task = tokio::spawn(async move {
        loop {
            tokio::select! {
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

    // Incoming reader loop
    while let Some(msg_result) = ws_receiver.next().await {
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
                        SyncFrame::Command { action, seek_position_ms, volume, repeat_mode } => {
                            if !is_authenticated {
                                continue;
                            }
                            let _ = app_handle.emit("p2p-command", serde_json::json!({
                                "action": action,
                                "seekPositionMs": seek_position_ms,
                                "volume": volume,
                                "repeatMode": repeat_mode
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
                        _ => {}
                    }
                }
            }
            Message::Ping(_) => {
                // Tungstenite automatically responds with pong
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
