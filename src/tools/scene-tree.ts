/**
 * Runtime scene tree tools: get_scene_tree, get_node_properties
 * Inspects the live scene tree in a running Godot game via the bridge.
 */

import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

export function registerSceneTreeTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'get_scene_tree',
      description: 'Get the live scene tree hierarchy from the running Godot game. Requires the Godot editor with MCP plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          depth: {
            type: 'number',
            description: 'Maximum depth to traverse (default: 5, -1 for unlimited)',
          },
          rootPath: {
            type: 'string',
            description: 'Path to start from (default: "/root", e.g., "/root/Main/Player")',
          },
          includeProperties: {
            type: 'boolean',
            description: 'Include basic properties (position, rotation, scale, visibility). Default: false',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_node_properties',
      description: 'Get detailed properties of a specific node in the running scene tree. Requires the Godot editor with MCP plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          nodePath: {
            type: 'string',
            description: 'Path to the node (e.g., "/root/Main/Player")',
          },
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Property categories to include (e.g., ["transform", "visibility", "script"]). Omit for all.',
          },
        },
        required: ['nodePath'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    get_scene_tree: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      try {
        const result = await ctx.bridgeClient.request('get_scene_tree', {
          depth: args.depth !== undefined ? args.depth : 5,
          root_path: args.rootPath || '/root',
          include_properties: args.includeProperties || false,
        });
        return createTextResponse(JSON.stringify(result, null, 2));
      } catch (error: any) {
        return createErrorResponse(`Failed to get scene tree: ${error?.message || 'Unknown error'}`, [
          'Ensure the Godot editor is running with the MCP plugin enabled',
          'Ensure a project is running in the editor',
        ]);
      }
    },

    get_node_properties: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.nodePath) {
        return createErrorResponse('nodePath is required', ['Provide the path to a node in the scene tree']);
      }
      try {
        const result = await ctx.bridgeClient.request('get_node_properties', {
          node_path: args.nodePath,
          categories: args.categories,
        });
        return createTextResponse(JSON.stringify(result, null, 2));
      } catch (error: any) {
        return createErrorResponse(`Failed to get node properties: ${error?.message || 'Unknown error'}`, [
          'Ensure the Godot editor is running with the MCP plugin enabled',
          `Verify the node path "${args.nodePath}" exists in the current scene`,
        ]);
      }
    },
  };

  return { tools, handlers };
}
