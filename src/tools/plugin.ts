/**
 * Plugin management tool: install_plugin
 * Copies the MCP plugin into a Godot project's addons/ directory.
 */

import { join } from 'path';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerPluginTools(_ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'install_plugin',
      description: 'Install the Mechanical Turk MCP bridge plugin into a project. After installing, enable it in Project > Project Settings > Plugins.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Mechanical Turk project directory',
          },
        },
        required: ['projectPath'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    install_plugin: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath) {
        return createErrorResponse('Project path is required');
      }
      if (!validatePath(args.projectPath)) {
        return createErrorResponse('Invalid project path');
      }

      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`, [
            'Ensure the path points to a directory containing a project.godot file',
          ]);
        }

        // Source: the plugin directory bundled with this MCP server
        // Navigate from build/tools/ up to the repo root, then into godot-plugin/addons/
        const repoRoot = join(__dirname, '..', '..');
        const pluginSource = join(repoRoot, 'godot-plugin', 'addons', 'mechanical_turk_mcp');

        if (!existsSync(pluginSource)) {
          return createErrorResponse('Plugin source not found. The MCP server installation may be incomplete.', [
            'Ensure the godot-plugin directory exists in the MCP server repo',
          ]);
        }

        // Destination
        const destDir = join(args.projectPath, 'addons', 'mechanical_turk_mcp');

        // Create addons directory if needed
        const addonsDir = join(args.projectPath, 'addons');
        if (!existsSync(addonsDir)) {
          mkdirSync(addonsDir, { recursive: true });
        }

        // Copy plugin files
        cpSync(pluginSource, destDir, { recursive: true });

        return createTextResponse(
          `MCP plugin installed to: ${destDir}\n\n` +
          'To activate:\n' +
          '1. Open the project in Godot\n' +
          '2. Go to Project > Project Settings > Plugins\n' +
          '3. Enable "Mechanical Turk MCP Bridge"\n\n' +
          'The plugin will start a WebSocket server on port 9080 when enabled.'
        );
      } catch (error: any) {
        return createErrorResponse(`Failed to install plugin: ${error?.message || 'Unknown error'}`, [
          'Check write permissions for the project directory',
        ]);
      }
    },
  };

  return { tools, handlers };
}
