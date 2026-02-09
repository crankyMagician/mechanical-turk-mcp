/**
 * MechTurkServer: MCP server lifecycle, tool registration, and operation execution.
 */

import { fileURLToPath } from 'url';
import { join, dirname, normalize } from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { detectGodotPath, isValidGodotPath, isValidGodotPathSync } from './utils/godot-path.js';
import { convertCamelToSnakeCase, OperationParams } from './utils/parameters.js';
import { BridgeClient } from './bridge/bridge-client.js';
import { ToolContext, ToolDefinition, ToolRegistration } from './tools/types.js';

// Tool registrations
import { registerEditorTools, clearActiveProcess } from './tools/editor.js';
import { registerProjectTools } from './tools/project.js';
import { registerSceneTools } from './tools/scene.js';
import { registerMeshTools } from './tools/mesh.js';
import { registerUidTools } from './tools/uid.js';
import { registerScreenshotTools } from './tools/screenshot.js';
import { registerInputTools } from './tools/input.js';
import { registerSceneTreeTools } from './tools/scene-tree.js';
import { registerTestingTools } from './tools/testing.js';
import { registerPluginTools } from './tools/plugin.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEBUG_MODE = process.env.DEBUG === 'true';
const GODOT_DEBUG_MODE = true;

function logDebug(message: string): void {
  if (DEBUG_MODE) {
    console.error(`[DEBUG] ${message}`);
  }
}

export interface GodotServerConfig {
  godotPath?: string;
  debugMode?: boolean;
  godotDebugMode?: boolean;
  strictPathValidation?: boolean;
}

export class GodotServer {
  private server: Server;
  private godotPath: string | null = null;
  private operationsScriptPath: string;
  private strictPathValidation: boolean = false;
  private bridgeClient: BridgeClient;
  private allTools: ToolDefinition[] = [];
  private allHandlers: Record<string, (args: any) => Promise<any>> = {};

  constructor(config?: GodotServerConfig) {
    if (config) {
      if (config.strictPathValidation !== undefined) {
        this.strictPathValidation = config.strictPathValidation;
      }
      if (config.godotPath) {
        const normalizedPath = normalize(config.godotPath);
        if (isValidGodotPathSync(normalizedPath)) {
          this.godotPath = normalizedPath;
        } else {
          console.warn(`[SERVER] Invalid custom Godot path: ${normalizedPath}`);
        }
      }
    }

    this.operationsScriptPath = join(__dirname, 'scripts', 'godot_operations.gd');
    this.bridgeClient = new BridgeClient();

    // Initialize MCP server
    this.server = new Server(
      { name: 'mechanical-turk-mcp', version: '0.2.0' },
      { capabilities: { tools: {} } }
    );

    // Build tool context
    const ctx: ToolContext = {
      godotPath: this.godotPath,
      operationsScriptPath: this.operationsScriptPath,
      bridgeClient: this.bridgeClient,
      executeOperation: this.executeOperation.bind(this),
      ensureGodotPath: this.ensureGodotPath.bind(this),
    };

    // Register all tool modules
    const registrations: ToolRegistration[] = [
      registerEditorTools(ctx),
      registerProjectTools(ctx),
      registerSceneTools(ctx),
      registerMeshTools(ctx),
      registerUidTools(ctx),
      registerPluginTools(ctx),
      registerScreenshotTools(ctx),
      registerInputTools(ctx),
      registerSceneTreeTools(ctx),
      registerTestingTools(ctx),
    ];

    for (const reg of registrations) {
      this.allTools.push(...reg.tools);
      Object.assign(this.allHandlers, reg.handlers);
    }

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async ensureGodotPath(): Promise<string> {
    if (!this.godotPath) {
      this.godotPath = await detectGodotPath(null, this.strictPathValidation);
    }
    if (!this.godotPath) {
      throw new Error('Could not find a valid Godot executable path');
    }
    return this.godotPath;
  }

  private async executeOperation(
    operation: string,
    params: OperationParams,
    projectPath: string
  ): Promise<{ stdout: string; stderr: string }> {
    logDebug(`Executing operation: ${operation} in project: ${projectPath}`);

    const snakeCaseParams = convertCamelToSnakeCase(params);
    const godotPath = await this.ensureGodotPath();

    try {
      const paramsJson = JSON.stringify(snakeCaseParams);
      const args = [
        '--headless',
        '--path', projectPath,
        '--script', this.operationsScriptPath,
        operation,
        paramsJson,
      ];

      if (GODOT_DEBUG_MODE) {
        args.push('--debug-godot');
      }

      logDebug(`Executing: ${godotPath} ${args.join(' ')}`);
      const { stdout, stderr } = await execFileAsync(godotPath, args);
      return { stdout: stdout ?? '', stderr: stderr ?? '' };
    } catch (error: unknown) {
      if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
        const execError = error as Error & { stdout: string; stderr: string };
        return { stdout: execError.stdout ?? '', stderr: execError.stderr ?? '' };
      }
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.allTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      logDebug(`Handling tool request: ${toolName}`);

      const handler = this.allHandlers[toolName];
      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }

      return await handler(request.params.arguments);
    });
  }

  private async cleanup() {
    logDebug('Cleaning up resources');
    clearActiveProcess();
    this.bridgeClient.disconnect();
    await this.server.close();
  }

  async run() {
    try {
      this.godotPath = await detectGodotPath(this.godotPath, this.strictPathValidation);

      if (!this.godotPath) {
        console.error('[SERVER] Failed to find a valid Godot executable path');
        process.exit(1);
      }

      const isValid = await isValidGodotPath(this.godotPath);
      if (!isValid) {
        if (this.strictPathValidation) {
          console.error(`[SERVER] Invalid Godot path: ${this.godotPath}`);
          process.exit(1);
        } else {
          console.error(`[SERVER] Warning: Using potentially invalid Godot path: ${this.godotPath}`);
        }
      }

      console.error(`[SERVER] Using Godot at: ${this.godotPath}`);

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Mechanical Turk MCP server running on stdio');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SERVER] Failed to start:', errorMessage);
      process.exit(1);
    }
  }
}
