/**
 * 2D Level creation tools: node manipulation, tilemap, physics, scripts, batch ops, and live bridge tools.
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';
export function registerLevel2dTools(ctx) {
    const tools = [
        // --- Headless tools (10) ---
        {
            name: 'modify_node',
            description: 'Set properties on an existing node in a scene file. Supports typed values like {_type: "Vector2", x: 100, y: 200}.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the node (e.g., "root/Player")' },
                    properties: {
                        type: 'object',
                        description: 'Properties to set. Values can be plain or typed: {position: {_type: "Vector2", x: 100, y: 200}, z_index: 5}',
                    },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'properties'],
            },
        },
        {
            name: 'delete_node',
            description: 'Remove a node and its children from a scene file.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the node to delete (e.g., "root/OldEnemy")' },
                },
                required: ['projectPath', 'scenePath', 'nodePath'],
            },
        },
        {
            name: 'reparent_node',
            description: 'Move a node to a different parent within a scene file.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the node to move' },
                    newParentPath: { type: 'string', description: 'Path to the new parent node' },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'newParentPath'],
            },
        },
        {
            name: 'create_tilemap',
            description: 'Add a TileMapLayer node with TileSet configuration to a scene.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    parentNodePath: { type: 'string', description: 'Path to the parent node (default: "root")' },
                    nodeName: { type: 'string', description: 'Name for the TileMapLayer node' },
                    tileSize: {
                        type: 'object',
                        properties: { x: { type: 'number' }, y: { type: 'number' } },
                        description: 'Tile size in pixels (default: 16x16)',
                    },
                    atlasSource: {
                        type: 'object',
                        properties: {
                            texturePath: { type: 'string', description: 'Path to the atlas texture (relative to project)' },
                            atlasId: { type: 'number', description: 'Atlas source ID (default: 0)' },
                            tileSize: {
                                type: 'object',
                                properties: { x: { type: 'number' }, y: { type: 'number' } },
                                description: 'Individual tile size in the atlas',
                            },
                        },
                        description: 'Optional atlas source configuration',
                    },
                },
                required: ['projectPath', 'scenePath'],
            },
        },
        {
            name: 'set_tiles',
            description: 'Place tiles on a TileMapLayer by grid coordinates.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the TileMapLayer node' },
                    tiles: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                x: { type: 'number', description: 'Grid x coordinate' },
                                y: { type: 'number', description: 'Grid y coordinate' },
                                source_id: { type: 'number', description: 'Tile source ID (default: 0)' },
                                atlas_x: { type: 'number', description: 'Atlas x coordinate (default: 0)' },
                                atlas_y: { type: 'number', description: 'Atlas y coordinate (default: 0)' },
                            },
                            required: ['x', 'y'],
                        },
                        description: 'Array of tiles to place',
                    },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'tiles'],
            },
        },
        {
            name: 'add_collision_shape',
            description: 'Add a CollisionShape2D with a shape resource to a scene. Shape types: RectangleShape2D, CircleShape2D, CapsuleShape2D, WorldBoundaryShape2D, SegmentShape2D, ConvexPolygonShape2D.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    parentNodePath: { type: 'string', description: 'Path to the parent node (e.g., a physics body)' },
                    nodeName: { type: 'string', description: 'Name for the CollisionShape2D node' },
                    shape: {
                        type: 'object',
                        description: 'Shape definition, e.g. {_type: "RectangleShape2D", size: {_type: "Vector2", x: 32, y: 32}} or {_type: "CircleShape2D", radius: 16}',
                    },
                    properties: {
                        type: 'object',
                        description: 'Additional properties to set on the CollisionShape2D',
                    },
                },
                required: ['projectPath', 'scenePath', 'parentNodePath', 'shape'],
            },
        },
        {
            name: 'configure_physics_body',
            description: 'Set physics properties on a StaticBody2D, RigidBody2D, CharacterBody2D, or Area2D.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the physics body node' },
                    properties: {
                        type: 'object',
                        description: 'Physics properties to set (e.g., mass, gravity_scale, friction, linear_velocity)',
                    },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'properties'],
            },
        },
        {
            name: 'attach_script',
            description: 'Attach an existing .gd script file to a node in a scene.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the node' },
                    scriptPath: { type: 'string', description: 'Path to the .gd script file (relative to project)' },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'scriptPath'],
            },
        },
        {
            name: 'create_and_attach_script',
            description: 'Create a new .gd script file and attach it to a node in a scene.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    nodePath: { type: 'string', description: 'Path to the node' },
                    scriptPath: { type: 'string', description: 'Path for the new .gd file (relative to project)' },
                    baseClass: { type: 'string', description: 'Base class to extend (default: "Node")' },
                    template: {
                        type: 'string',
                        enum: ['empty', 'default'],
                        description: '"empty" = just extends line, "default" = extends + _ready + _process stubs',
                    },
                    content: { type: 'string', description: 'Raw script content (overrides template if provided)' },
                },
                required: ['projectPath', 'scenePath', 'nodePath', 'scriptPath'],
            },
        },
        {
            name: 'batch_scene_operations',
            description: 'Execute multiple scene operations in a single Godot invocation. Much faster than individual calls. Supported operations: add_node, modify_node, delete_node, reparent_node, add_collision_shape, set_tiles.',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Godot project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (relative to project)' },
                    operations: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                operation: {
                                    type: 'string',
                                    enum: ['add_node', 'modify_node', 'delete_node', 'reparent_node', 'add_collision_shape', 'set_tiles'],
                                    description: 'Operation to perform',
                                },
                                params: {
                                    type: 'object',
                                    description: 'Parameters for the operation (same as standalone tool, minus projectPath/scenePath)',
                                },
                            },
                            required: ['operation', 'params'],
                        },
                        description: 'Array of operations to execute in order',
                    },
                },
                required: ['projectPath', 'scenePath', 'operations'],
            },
        },
        // --- Bridge tools (4) ---
        {
            name: 'set_node_property',
            description: 'Set a property on a node in the live running scene (via bridge). Supports typed values.',
            inputSchema: {
                type: 'object',
                properties: {
                    nodePath: { type: 'string', description: 'Path to the node (e.g., "/root/Main/Player")' },
                    property: { type: 'string', description: 'Property name to set' },
                    value: { description: 'Value to set. Can be typed: {_type: "Vector2", x: 100, y: 200}' },
                },
                required: ['nodePath', 'property', 'value'],
            },
        },
        {
            name: 'delete_node_live',
            description: 'Remove a node from the live running scene (via bridge).',
            inputSchema: {
                type: 'object',
                properties: {
                    nodePath: { type: 'string', description: 'Path to the node to delete (e.g., "/root/Main/Enemy")' },
                },
                required: ['nodePath'],
            },
        },
        {
            name: 'set_tiles_live',
            description: 'Place tiles on a TileMapLayer in the live running scene (via bridge).',
            inputSchema: {
                type: 'object',
                properties: {
                    nodePath: { type: 'string', description: 'Path to the TileMapLayer node' },
                    tiles: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' },
                                source_id: { type: 'number' },
                                atlas_x: { type: 'number' },
                                atlas_y: { type: 'number' },
                            },
                            required: ['x', 'y'],
                        },
                        description: 'Array of tiles to place',
                    },
                },
                required: ['nodePath', 'tiles'],
            },
        },
        {
            name: 'reparent_node_live',
            description: 'Move a node to a different parent in the live running scene (via bridge).',
            inputSchema: {
                type: 'object',
                properties: {
                    nodePath: { type: 'string', description: 'Path to the node to move' },
                    newParentPath: { type: 'string', description: 'Path to the new parent node' },
                },
                required: ['nodePath', 'newParentPath'],
            },
        },
    ];
    // --- Helpers ---
    function validateProjectAndScene(args) {
        if (!args.projectPath || !args.scenePath) {
            return 'projectPath and scenePath are required';
        }
        if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
            return 'Invalid path';
        }
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
            return `Not a valid Godot project: ${args.projectPath}`;
        }
        if (!existsSync(join(args.projectPath, args.scenePath))) {
            return `Scene file does not exist: ${args.scenePath}`;
        }
        return null;
    }
    async function runHeadlessOp(args, operation, buildParams, successMsg) {
        const err = validateProjectAndScene(args);
        if (err)
            return createErrorResponse(err);
        try {
            const params = buildParams(args);
            const { stdout, stderr } = await ctx.executeOperation(operation, params, args.projectPath);
            if (stderr?.includes('Failed to') || stderr?.includes('[ERROR]')) {
                return createErrorResponse(`${operation} failed: ${stderr}`);
            }
            return createTextResponse(`${successMsg}\n\nOutput: ${stdout}`);
        }
        catch (error) {
            return createErrorResponse(`${operation} failed: ${error?.message || 'Unknown error'}`);
        }
    }
    const bridgeHints = [
        'Ensure the Godot editor is running with the MCP plugin enabled',
        'Ensure a project/scene is running in the editor',
    ];
    // --- Handlers ---
    const handlers = {
        // Headless tools
        modify_node: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            return runHeadlessOp(args, 'modify_node', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
                properties: a.properties,
            }), `Node '${args.nodePath}' modified successfully in '${args.scenePath}'.`);
        },
        delete_node: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            return runHeadlessOp(args, 'delete_node', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
            }), `Node '${args.nodePath}' deleted from '${args.scenePath}'.`);
        },
        reparent_node: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.newParentPath) {
                return createErrorResponse('newParentPath is required');
            }
            return runHeadlessOp(args, 'reparent_node', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
                newParentPath: a.newParentPath,
            }), `Node '${args.nodePath}' reparented to '${args.newParentPath}' in '${args.scenePath}'.`);
        },
        create_tilemap: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            return runHeadlessOp(args, 'create_tilemap', (a) => {
                const params = { scenePath: a.scenePath };
                if (a.parentNodePath)
                    params.parentNodePath = a.parentNodePath;
                if (a.nodeName)
                    params.nodeName = a.nodeName;
                if (a.tileSize)
                    params.tileSize = a.tileSize;
                if (a.atlasSource)
                    params.atlasSource = a.atlasSource;
                return params;
            }, `TileMapLayer created in '${args.scenePath}'.`);
        },
        set_tiles: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.tiles) {
                return createErrorResponse('nodePath and tiles are required');
            }
            return runHeadlessOp(args, 'set_tiles', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
                tiles: a.tiles,
            }), `Tiles set on '${args.nodePath}' in '${args.scenePath}'.`);
        },
        add_collision_shape: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.parentNodePath || !args.shape) {
                return createErrorResponse('parentNodePath and shape are required');
            }
            return runHeadlessOp(args, 'add_collision_shape', (a) => {
                const params = {
                    scenePath: a.scenePath,
                    parentNodePath: a.parentNodePath,
                    shape: a.shape,
                };
                if (a.nodeName)
                    params.nodeName = a.nodeName;
                if (a.properties)
                    params.properties = a.properties;
                return params;
            }, `CollisionShape2D added to '${args.parentNodePath}' in '${args.scenePath}'.`);
        },
        configure_physics_body: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.properties) {
                return createErrorResponse('nodePath and properties are required');
            }
            return runHeadlessOp(args, 'configure_physics_body', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
                properties: a.properties,
            }), `Physics body '${args.nodePath}' configured in '${args.scenePath}'.`);
        },
        attach_script: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.scriptPath) {
                return createErrorResponse('nodePath and scriptPath are required');
            }
            if (!validatePath(args.scriptPath)) {
                return createErrorResponse('Invalid script path');
            }
            return runHeadlessOp(args, 'attach_script', (a) => ({
                scenePath: a.scenePath,
                nodePath: a.nodePath,
                scriptPath: a.scriptPath,
            }), `Script '${args.scriptPath}' attached to '${args.nodePath}' in '${args.scenePath}'.`);
        },
        create_and_attach_script: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.scriptPath) {
                return createErrorResponse('nodePath and scriptPath are required');
            }
            if (!validatePath(args.scriptPath)) {
                return createErrorResponse('Invalid script path');
            }
            return runHeadlessOp(args, 'create_and_attach_script', (a) => {
                const params = {
                    scenePath: a.scenePath,
                    nodePath: a.nodePath,
                    scriptPath: a.scriptPath,
                };
                if (a.baseClass)
                    params.baseClass = a.baseClass;
                if (a.template)
                    params.template = a.template;
                if (a.content)
                    params.content = a.content;
                return params;
            }, `Script created at '${args.scriptPath}' and attached to '${args.nodePath}' in '${args.scenePath}'.`);
        },
        batch_scene_operations: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.operations || !Array.isArray(args.operations)) {
                return createErrorResponse('operations array is required');
            }
            return runHeadlessOp(args, 'batch_scene_operations', (a) => ({
                scenePath: a.scenePath,
                operations: a.operations,
            }), `Batch operations (${args.operations.length} ops) completed on '${args.scenePath}'.`);
        },
        // Bridge tools
        set_node_property: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.property) {
                return createErrorResponse('nodePath and property are required');
            }
            try {
                const result = await ctx.bridgeClient.request('set_node_property', {
                    node_path: args.nodePath,
                    property: args.property,
                    value: args.value,
                });
                return createTextResponse(JSON.stringify(result, null, 2));
            }
            catch (error) {
                return createErrorResponse(`Failed to set property: ${error?.message || 'Unknown error'}`, bridgeHints);
            }
        },
        delete_node_live: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath) {
                return createErrorResponse('nodePath is required');
            }
            try {
                const result = await ctx.bridgeClient.request('delete_node', {
                    node_path: args.nodePath,
                });
                return createTextResponse(JSON.stringify(result, null, 2));
            }
            catch (error) {
                return createErrorResponse(`Failed to delete node: ${error?.message || 'Unknown error'}`, bridgeHints);
            }
        },
        set_tiles_live: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.tiles) {
                return createErrorResponse('nodePath and tiles are required');
            }
            try {
                const result = await ctx.bridgeClient.request('set_tiles', {
                    node_path: args.nodePath,
                    tiles: args.tiles,
                });
                return createTextResponse(JSON.stringify(result, null, 2));
            }
            catch (error) {
                return createErrorResponse(`Failed to set tiles: ${error?.message || 'Unknown error'}`, bridgeHints);
            }
        },
        reparent_node_live: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.nodePath || !args.newParentPath) {
                return createErrorResponse('nodePath and newParentPath are required');
            }
            try {
                const result = await ctx.bridgeClient.request('reparent_node', {
                    node_path: args.nodePath,
                    new_parent_path: args.newParentPath,
                });
                return createTextResponse(JSON.stringify(result, null, 2));
            }
            catch (error) {
                return createErrorResponse(`Failed to reparent node: ${error?.message || 'Unknown error'}`, bridgeHints);
            }
        },
    };
    return { tools, handlers };
}
