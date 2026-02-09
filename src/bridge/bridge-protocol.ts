/**
 * Bridge protocol message types for WebSocket communication between
 * Node.js MCP server and Mechanical Turk editor plugin.
 */

export interface BridgeRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
}

export interface BridgeResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type BridgeMethod =
  | 'ping'
  | 'capture_screenshot'
  | 'send_input_event'
  | 'send_action'
  | 'get_scene_tree'
  | 'get_node_properties';
