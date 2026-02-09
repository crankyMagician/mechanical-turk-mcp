/**
 * WebSocket client connecting to the Mechanical Turk editor plugin bridge.
 */

import WebSocket from 'ws';
import { BridgeRequest, BridgeResponse } from './bridge-protocol.js';

const DEBUG_MODE = process.env.DEBUG === 'true';

function logDebug(message: string): void {
  if (DEBUG_MODE) {
    console.error(`[DEBUG] [Bridge] ${message}`);
  }
}

export class BridgeClient {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private connectPromise: Promise<void> | null = null;

  constructor(host?: string, port?: number) {
    this.host = host || process.env.GODOT_BRIDGE_HOST || 'localhost';
    this.port = port || parseInt(process.env.GODOT_BRIDGE_PORT || '9080', 10);
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    // If already connecting, wait for it
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const url = `ws://${this.host}:${this.port}`;
      logDebug(`Connecting to Mechanical Turk bridge at ${url}`);

      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection to Mechanical Turk bridge timed out (${url}). Is the Godot editor running with the MCP plugin enabled?`));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.ws = ws;
        logDebug('Connected to Mechanical Turk bridge');
        resolve();
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const response: BridgeResponse = JSON.parse(data.toString());
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(`Bridge error: ${response.error.message}`));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (err) {
          logDebug(`Failed to parse bridge message: ${err}`);
        }
      });

      ws.on('close', () => {
        logDebug('Disconnected from Mechanical Turk bridge');
        this.ws = null;
        // Reject any pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Bridge connection closed'));
        }
        this.pendingRequests.clear();
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        logDebug(`Bridge connection error: ${err.message}`);
        this.ws = null;
        reject(new Error(
          `Cannot connect to Mechanical Turk bridge at ws://${this.host}:${this.port}. ` +
          'Ensure the Godot editor is running with the Mechanical Turk MCP plugin enabled. ' +
          'Use the install_plugin tool to install the plugin, then enable it in Project > Project Settings > Plugins.'
        ));
      });
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async request(method: string, params?: Record<string, any>, timeoutMs: number = 30000): Promise<any> {
    if (!this.isConnected) {
      await this.connect();
    }

    const id = String(++this.requestId);
    const request: BridgeRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Bridge request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      logDebug(`Sending bridge request: ${JSON.stringify(request)}`);
      this.ws!.send(JSON.stringify(request));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
