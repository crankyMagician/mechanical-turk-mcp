/**
 * Mesh tools: export_mesh_library
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';
export function registerMeshTools(ctx) {
    const tools = [
        {
            name: 'export_mesh_library',
            description: 'Export a scene as a MeshLibrary resource',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
                    scenePath: { type: 'string', description: 'Path to the scene file (.tscn) to export' },
                    outputPath: { type: 'string', description: 'Path where the mesh library (.res) will be saved' },
                    meshItemNames: { type: 'array', items: { type: 'string' }, description: 'Optional: Names of specific mesh items to include' },
                },
                required: ['projectPath', 'scenePath', 'outputPath'],
            },
        },
    ];
    const handlers = {
        export_mesh_library: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.projectPath || !args.scenePath || !args.outputPath) {
                return createErrorResponse('Missing required parameters', ['Provide projectPath, scenePath, and outputPath']);
            }
            if (!validatePath(args.projectPath) || !validatePath(args.scenePath) || !validatePath(args.outputPath)) {
                return createErrorResponse('Invalid path');
            }
            try {
                if (!existsSync(join(args.projectPath, 'project.godot'))) {
                    return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
                }
                if (!existsSync(join(args.projectPath, args.scenePath))) {
                    return createErrorResponse(`Scene file does not exist: ${args.scenePath}`);
                }
                const params = { scenePath: args.scenePath, outputPath: args.outputPath };
                if (args.meshItemNames && Array.isArray(args.meshItemNames)) {
                    params.meshItemNames = args.meshItemNames;
                }
                const { stdout, stderr } = await ctx.executeOperation('export_mesh_library', params, args.projectPath);
                if (stderr?.includes('Failed to')) {
                    return createErrorResponse(`Failed to export mesh library: ${stderr}`);
                }
                return createTextResponse(`MeshLibrary exported successfully to: ${args.outputPath}\n\nOutput: ${stdout}`);
            }
            catch (error) {
                return createErrorResponse(`Failed to export mesh library: ${error?.message || 'Unknown error'}`);
            }
        },
    };
    return { tools, handlers };
}
