/**
 * MechTurkServer: MCP server lifecycle, tool registration, and operation execution.
 */
import { fileURLToPath } from 'url';
import { join, dirname, normalize } from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { detectGodotPath, isValidGodotPath, isValidGodotPathSync } from './utils/godot-path.js';
import { convertCamelToSnakeCase } from './utils/parameters.js';
import { BridgeClient } from './bridge/bridge-client.js';
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
import { registerLevel2dTools } from './tools/level-2d.js';
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEBUG_MODE = process.env.DEBUG === 'true';
const GODOT_DEBUG_MODE = true;
function logDebug(message) {
    if (DEBUG_MODE) {
        console.error(`[DEBUG] ${message}`);
    }
}
export class GodotServer {
    server;
    godotPath = null;
    operationsScriptPath;
    strictPathValidation = false;
    bridgeClient;
    allTools = [];
    allHandlers = {};
    constructor(config) {
        if (config) {
            if (config.strictPathValidation !== undefined) {
                this.strictPathValidation = config.strictPathValidation;
            }
            if (config.godotPath) {
                const normalizedPath = normalize(config.godotPath);
                if (isValidGodotPathSync(normalizedPath)) {
                    this.godotPath = normalizedPath;
                }
                else {
                    console.warn(`[SERVER] Invalid custom Godot path: ${normalizedPath}`);
                }
            }
        }
        this.operationsScriptPath = join(__dirname, 'scripts', 'godot_operations.gd');
        this.bridgeClient = new BridgeClient();
        // Initialize MCP server
        this.server = new Server({ name: 'mechanical-turk-mcp', version: '0.2.0' }, { capabilities: { tools: {} } });
        // Build tool context
        const ctx = {
            godotPath: this.godotPath,
            operationsScriptPath: this.operationsScriptPath,
            bridgeClient: this.bridgeClient,
            executeOperation: this.executeOperation.bind(this),
            ensureGodotPath: this.ensureGodotPath.bind(this),
        };
        // Register all tool modules
        const registrations = [
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
            registerLevel2dTools(ctx),
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
    async ensureGodotPath() {
        if (!this.godotPath) {
            this.godotPath = await detectGodotPath(null, this.strictPathValidation);
        }
        if (!this.godotPath) {
            throw new Error('Could not find a valid Godot executable path');
        }
        return this.godotPath;
    }
    async executeOperation(operation, params, projectPath) {
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
        }
        catch (error) {
            if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
                const execError = error;
                return { stdout: execError.stdout ?? '', stderr: execError.stderr ?? '' };
            }
            throw error;
        }
    }
    setupToolHandlers() {
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
    async cleanup() {
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
                }
                else {
                    console.error(`[SERVER] Warning: Using potentially invalid Godot path: ${this.godotPath}`);
                }
            }
            console.error(`[SERVER] Using Godot at: ${this.godotPath}`);
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('Mechanical Turk MCP server running on stdio');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[SERVER] Failed to start:', errorMessage);
            process.exit(1);
        }
    }
}
