/**
 * Shared types for tool modules
 */

import { BridgeClient } from '../bridge/bridge-client.js';

export interface OperationParams {
  [key: string]: any;
}

export interface ToolContext {
  godotPath: string | null;
  operationsScriptPath: string;
  bridgeClient: BridgeClient;
  executeOperation: (operation: string, params: OperationParams, projectPath: string) => Promise<{ stdout: string; stderr: string }>;
  ensureGodotPath: () => Promise<string>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolRegistration {
  tools: ToolDefinition[];
  handlers: Record<string, (args: any) => Promise<any>>;
}
