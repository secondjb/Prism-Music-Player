import { PlaybackStateDto } from '../types/sync';

export interface RemoteConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  serverDeviceName: string | null;
  connectedHost: string | null;
  connectedPort: number | null;
  remotePlaybackState: PlaybackStateDto | null;
}

export interface ParsedPairingCode {
  host: string;
  port: number;
  token: string;
  name?: string;
}

export function parsePairingInput(raw: string): ParsedPairingCode | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. URI format: prism://pair?host=192.168.1.50&port=9876&token=XYZ&name=MyPC
  if (trimmed.startsWith('prism://pair') || trimmed.includes('://')) {
    try {
      const url = new URL(trimmed.replace('prism://pair', 'http://localhost'));
      const host = url.searchParams.get('host') || url.searchParams.get('ip');
      const portStr = url.searchParams.get('port');
      const token = url.searchParams.get('token');
      const name = url.searchParams.get('name') || undefined;

      if (host && token) {
        return {
          host,
          port: portStr ? parseInt(portStr, 10) : 9876,
          token,
          name,
        };
      }
    } catch {
      // Fall through to regex/delimiter parsing
    }
  }

  // 2. Colon-delimited format: host:port:token (e.g., 192.168.1.50:9876:abcdef...)
  const parts = trimmed.split(':');
  if (parts.length >= 3) {
    const host = parts[0].trim();
    const port = parseInt(parts[1].trim(), 10) || 9876;
    const token = parts.slice(2).join(':').trim();
    if (host && token) {
      return { host, port, token };
    }
  }

  return null;
}

// ----------------------------------------------------------------------
// Universal PSK Stream Cipher (SHA-256 CTR)
// Matches Rust encrypt_payload / decrypt_payload
// ----------------------------------------------------------------------

async function applyStreamKeystream(
  data: Uint8Array,
  token: string,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const tokenBytes = enc.encode(token);
  const result = new Uint8Array(data.length);
  let counter = 0;
  let offset = 0;

  while (offset < data.length) {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, counter, false);

    const input = new Uint8Array(tokenBytes.length + nonce.length + 4);
    input.set(tokenBytes, 0);
    input.set(nonce, tokenBytes.length);
    input.set(counterBytes, tokenBytes.length + nonce.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', input);
    const block = new Uint8Array(hashBuffer);

    const chunkSize = Math.min(block.length, data.length - offset);
    for (let i = 0; i < chunkSize; i++) {
      result[offset + i] = data[offset + i] ^ block[i];
    }
    offset += chunkSize;
    counter++;
  }

  return result;
}

export async function encryptPayload(
  plaintextStr: string,
  token: string
): Promise<{ n: string; d: string }> {
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(plaintextStr);
  const nonceBytes = new Uint8Array(12);
  crypto.getRandomValues(nonceBytes);

  const cipherBytes = await applyStreamKeystream(plaintextBytes, token, nonceBytes);

  let nBinary = '';
  for (let i = 0; i < nonceBytes.length; i++) nBinary += String.fromCharCode(nonceBytes[i]);
  let dBinary = '';
  for (let i = 0; i < cipherBytes.length; i++) dBinary += String.fromCharCode(cipherBytes[i]);

  return { n: btoa(nBinary), d: btoa(dBinary) };
}

export async function decryptPayload(
  nB64: string,
  dB64: string,
  token: string
): Promise<string> {
  const nBinary = atob(nB64);
  const nonceBytes = new Uint8Array(nBinary.length);
  for (let i = 0; i < nBinary.length; i++) nonceBytes[i] = nBinary.charCodeAt(i);

  const dBinary = atob(dB64);
  const cipherBytes = new Uint8Array(dBinary.length);
  for (let i = 0; i < dBinary.length; i++) cipherBytes[i] = dBinary.charCodeAt(i);

  const plainBytes = await applyStreamKeystream(cipherBytes, token, nonceBytes);
  const dec = new TextDecoder();
  return dec.decode(plainBytes);
}

// ----------------------------------------------------------------------
// Remote P2P Client Manager
// ----------------------------------------------------------------------

class RemoteP2pClientManager {
  private ws: WebSocket | null = null;
  private currentToken: string | null = null;
  private statusListeners = new Set<(status: RemoteConnectionStatus) => void>();
  private status: RemoteConnectionStatus = {
    isConnected: false,
    isConnecting: false,
    error: null,
    serverDeviceName: null,
    connectedHost: null,
    connectedPort: null,
    remotePlaybackState: null,
  };

  public getStatus(): RemoteConnectionStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: RemoteConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private updateStatus(partial: Partial<RemoteConnectionStatus>) {
    this.status = { ...this.status, ...partial };
    for (const listener of this.statusListeners) {
      try {
        listener(this.getStatus());
      } catch (e) {
        console.error('[RemoteP2pClient] Error in listener:', e);
      }
    }
  }

  public connect(pairingString: string): boolean {
    const parsed = parsePairingInput(pairingString);
    if (!parsed) {
      this.updateStatus({
        error: 'Invalid pairing format. Expected "host:port:token" or "prism://pair?..."',
      });
      return false;
    }

    this.disconnect();
    this.currentToken = parsed.token;
    this.updateStatus({
      isConnecting: true,
      error: null,
      connectedHost: parsed.host,
      connectedPort: parsed.port,
    });

    try {
      const encodedToken = encodeURIComponent(parsed.token);
      const wsUrl = `ws://${parsed.host}:${parsed.port}/prism-sync?token=${encodedToken}`;
      console.log(`[RemoteP2pClient] Connecting to remote Prism host at ${parsed.host}:${parsed.port}...`);

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const connectionTimeout = setTimeout(() => {
        if (this.ws === ws && !this.status.isConnected) {
          console.warn('[RemoteP2pClient] Connection attempt timed out');
          ws.close();
          this.updateStatus({
            isConnecting: false,
            isConnected: false,
            error: `Connection timed out. Ensure the other laptop is running Prism and reachable on ${parsed.host}:${parsed.port}`,
          });
        }
      }, 7000);

      ws.onopen = async () => {
        clearTimeout(connectionTimeout);
        console.log('[RemoteP2pClient] Socket opened. Sending encrypted authentication handshake...');
        const handshake = {
          type: 'handshake_req',
          clientToken: parsed.token,
          deviceName: `Prism Laptop (${parsed.name || 'Remote Companion'})`,
          clientVersion: '1.0.0',
        };

        try {
          const enc = await encryptPayload(JSON.stringify(handshake), parsed.token);
          ws.send(JSON.stringify({ type: 'enc', n: enc.n, d: enc.d }));
        } catch (e) {
          // Fallback to plain if subtle crypto fails
          ws.send(JSON.stringify(handshake));
        }
      };

      ws.onmessage = async (event) => {
        try {
          let text = event.data;
          const raw = JSON.parse(text);

          // Transparent decryption if frame is encrypted
          if (raw.type === 'enc' && raw.n && raw.d && this.currentToken) {
            text = await decryptPayload(raw.n, raw.d, this.currentToken);
          }

          const data = JSON.parse(text);
          if (data.type === 'handshake_resp') {
            if (data.isApproved) {
              console.log('[RemoteP2pClient] Authenticated securely with host:', data.serverDeviceName);
              this.updateStatus({
                isConnected: true,
                isConnecting: false,
                error: null,
                serverDeviceName: data.serverDeviceName || `Host (${parsed.host})`,
              });
            } else {
              console.warn('[RemoteP2pClient] Host rejected handshake: Invalid token');
              this.updateStatus({
                isConnected: false,
                isConnecting: false,
                error: 'Authentication failed: The pairing token was rejected by the other laptop.',
              });
              ws.close();
            }
          } else if (data.type === 'state_sync') {
            if (data.playbackState) {
              this.updateStatus({
                remotePlaybackState: data.playbackState,
              });
            }
          }
        } catch (e) {
          console.error('[RemoteP2pClient] Failed to process message:', e);
        }
      };

      ws.onerror = (e) => {
        clearTimeout(connectionTimeout);
        console.error('[RemoteP2pClient] WebSocket error:', e);
        this.updateStatus({
          isConnecting: false,
          isConnected: false,
          error: `Failed to connect to ${parsed.host}:${parsed.port}. Check firewall or Wi-Fi connection.`,
        });
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        console.log('[RemoteP2pClient] Disconnected from host');
        this.updateStatus({
          isConnected: false,
          isConnecting: false,
        });
      };

      return true;
    } catch (e: any) {
      this.updateStatus({
        isConnecting: false,
        isConnected: false,
        error: e?.message || 'Failed to initialize WebSocket client',
      });
      return false;
    }
  }

  public disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.currentToken = null;
    this.updateStatus({
      isConnected: false,
      isConnecting: false,
      error: null,
      serverDeviceName: null,
      connectedHost: null,
      connectedPort: null,
      remotePlaybackState: null,
    });
  }

  public async sendCommand(
    action: string,
    params?: {
      seekPositionMs?: number;
      volume?: number;
      repeatMode?: string;
    }
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.status.isConnected) {
      console.warn('[RemoteP2pClient] Cannot send command: Not connected to host');
      return;
    }

    const command = {
      type: 'command',
      action,
      seekPositionMs: params?.seekPositionMs ?? null,
      volume: params?.volume ?? null,
      repeatMode: params?.repeatMode ?? null,
    };

    try {
      if (this.currentToken) {
        const enc = await encryptPayload(JSON.stringify(command), this.currentToken);
        this.ws.send(JSON.stringify({ type: 'enc', n: enc.n, d: enc.d }));
      } else {
        this.ws.send(JSON.stringify(command));
      }
    } catch (e) {
      console.error('[RemoteP2pClient] Failed to send encrypted command:', e);
    }
  }
}

export const remoteP2pClient = new RemoteP2pClientManager();
