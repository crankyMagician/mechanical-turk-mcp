/**
 * Scene tools: create_scene, add_node, load_sprite, save_scene
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

export function registerSceneTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'create_scene',
      description: 'Create a new Mechanical Turk scene file',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
          scenePath: { type: 'string', description: 'Path where the scene file will be saved (relative to project)' },
          rootNodeType: { type: 'string', description: 'Type of the root node (e.g., Node2D, Node3D)' },
        },
        required: ['projectPath', 'scenePath'],
      },
    },
    {
      name: 'add_node',
      description: 'Add a node to an existing scene',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
          scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
          parentNodePath: { type: 'string', description: 'Path to the parent node (e.g., "root" or "root/Player")' },
          nodeType: { type: 'string', description: 'Type of node to add (e.g., Sprite2D, CollisionShape2D)' },
          nodeName: { type: 'string', description: 'Name for the new node' },
          properties: { type: 'object', description: 'Optional properties to set on the node' },
        },
        required: ['projectPath', 'scenePath', 'nodeType', 'nodeName'],
      },
    },
    {
      name: 'load_sprite',
      description: 'Load a sprite into a Sprite2D node',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
          scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
          nodePath: { type: 'string', description: 'Path to the Sprite2D node (e.g., "root/Player/Sprite2D")' },
          texturePath: { type: 'string', description: 'Path to the texture file (relative to project)' },
        },
        required: ['projectPath', 'scenePath', 'nodePath', 'texturePath'],
      },
    },
    {
      name: 'save_scene',
      description: 'Save changes to a scene file',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
          scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
          newPath: { type: 'string', description: 'Optional: New path to save the scene to (for creating variants)' },
        },
        required: ['projectPath', 'scenePath'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    create_scene: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath || !args.scenePath) {
        return createErrorResponse('Project path and scene path are required');
      }
      if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
        return createErrorResponse('Invalid path');
      }
      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
        }
        const params = { scenePath: args.scenePath, rootNodeType: args.rootNodeType || 'Node2D' };
        const { stdout, stderr } = await ctx.executeOperation('create_scene', params, args.projectPath);
        if (stderr?.includes('Failed to')) {
          return createErrorResponse(`Failed to create scene: ${stderr}`);
        }
        return createTextResponse(`Scene created successfully at: ${args.scenePath}\n\nOutput: ${stdout}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to create scene: ${error?.message || 'Unknown error'}`);
      }
    },

    add_node: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath || !args.scenePath || !args.nodeType || !args.nodeName) {
        return createErrorResponse('Missing required parameters', ['Provide projectPath, scenePath, nodeType, and nodeName']);
      }
      if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
        return createErrorResponse('Invalid path');
      }
      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
        }
        if (!existsSync(join(args.projectPath, args.scenePath))) {
          return createErrorResponse(`Scene file does not exist: ${args.scenePath}`);
        }
        const params: any = { scenePath: args.scenePath, nodeType: args.nodeType, nodeName: args.nodeName };
        if (args.parentNodePath) params.parentNodePath = args.parentNodePath;
        if (args.properties) params.properties = args.properties;
        const { stdout, stderr } = await ctx.executeOperation('add_node', params, args.projectPath);
        if (stderr?.includes('Failed to')) {
          return createErrorResponse(`Failed to add node: ${stderr}`);
        }
        return createTextResponse(`Node '${args.nodeName}' of type '${args.nodeType}' added successfully to '${args.scenePath}'.\n\nOutput: ${stdout}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to add node: ${error?.message || 'Unknown error'}`);
      }
    },

    load_sprite: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath || !args.scenePath || !args.nodePath || !args.texturePath) {
        return createErrorResponse('Missing required parameters', ['Provide projectPath, scenePath, nodePath, and texturePath']);
      }
      if (!validatePath(args.projectPath) || !validatePath(args.scenePath) || !validatePath(args.nodePath) || !validatePath(args.texturePath)) {
        return createErrorResponse('Invalid path');
      }
      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
        }
        if (!existsSync(join(args.projectPath, args.scenePath))) {
          return createErrorResponse(`Scene file does not exist: ${args.scenePath}`);
        }
        if (!existsSync(join(args.projectPath, args.texturePath))) {
          return createErrorResponse(`Texture file does not exist: ${args.texturePath}`);
        }
        const params = { scenePath: args.scenePath, nodePath: args.nodePath, texturePath: args.texturePath };
        const { stdout, stderr } = await ctx.executeOperation('load_sprite', params, args.projectPath);
        if (stderr?.includes('Failed to')) {
          return createErrorResponse(`Failed to load sprite: ${stderr}`);
        }
        return createTextResponse(`Sprite loaded successfully with texture: ${args.texturePath}\n\nOutput: ${stdout}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to load sprite: ${error?.message || 'Unknown error'}`);
      }
    },

    save_scene: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath || !args.scenePath) {
        return createErrorResponse('Missing required parameters', ['Provide projectPath and scenePath']);
      }
      if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
        return createErrorResponse('Invalid path');
      }
      if (args.newPath && !validatePath(args.newPath)) {
        return createErrorResponse('Invalid new path');
      }
      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
        }
        if (!existsSync(join(args.projectPath, args.scenePath))) {
          return createErrorResponse(`Scene file does not exist: ${args.scenePath}`);
        }
        const params: any = { scenePath: args.scenePath };
        if (args.newPath) params.newPath = args.newPath;
        const { stdout, stderr } = await ctx.executeOperation('save_scene', params, args.projectPath);
        if (stderr?.includes('Failed to')) {
          return createErrorResponse(`Failed to save scene: ${stderr}`);
        }
        return createTextResponse(`Scene saved successfully to: ${args.newPath || args.scenePath}\n\nOutput: ${stdout}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to save scene: ${error?.message || 'Unknown error'}`);
      }
    },
  };

  return { tools, handlers };
}
