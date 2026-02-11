/**
 * UID tools: get_uid, update_project_uids
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';
const execFileAsync = promisify(execFile);
function isGodot44OrLater(version) {
    const match = version.match(/^(\d+)\.(\d+)/);
    if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        return major > 4 || (major === 4 && minor >= 4);
    }
    return false;
}
export function registerUidTools(ctx) {
    const tools = [
        {
            name: 'get_uid',
            description: 'Get the UID for a specific file in a Mechanical Turk project (for Godot 4.4+)',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
                    filePath: { type: 'string', description: 'Path to the file (relative to project) for which to get the UID' },
                },
                required: ['projectPath', 'filePath'],
            },
        },
        {
            name: 'update_project_uids',
            description: 'Update UID references in a Mechanical Turk project by resaving resources (for Godot 4.4+)',
            inputSchema: {
                type: 'object',
                properties: {
                    projectPath: { type: 'string', description: 'Path to the Mechanical Turk project directory' },
                },
                required: ['projectPath'],
            },
        },
    ];
    const handlers = {
        get_uid: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.projectPath || !args.filePath) {
                return createErrorResponse('Missing required parameters', ['Provide projectPath and filePath']);
            }
            if (!validatePath(args.projectPath) || !validatePath(args.filePath)) {
                return createErrorResponse('Invalid path');
            }
            try {
                const godotPath = await ctx.ensureGodotPath();
                if (!existsSync(join(args.projectPath, 'project.godot'))) {
                    return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
                }
                if (!existsSync(join(args.projectPath, args.filePath))) {
                    return createErrorResponse(`File does not exist: ${args.filePath}`);
                }
                const { stdout: versionOutput } = await execFileAsync(godotPath, ['--version']);
                if (!isGodot44OrLater(versionOutput.trim())) {
                    return createErrorResponse(`UIDs are only supported in Godot 4.4 or later. Current version: ${versionOutput.trim()}`);
                }
                const { stdout, stderr } = await ctx.executeOperation('get_uid', { filePath: args.filePath }, args.projectPath);
                if (stderr?.includes('Failed to')) {
                    return createErrorResponse(`Failed to get UID: ${stderr}`);
                }
                return createTextResponse(`UID for ${args.filePath}: ${stdout.trim()}`);
            }
            catch (error) {
                return createErrorResponse(`Failed to get UID: ${error?.message || 'Unknown error'}`);
            }
        },
        update_project_uids: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            if (!args.projectPath) {
                return createErrorResponse('Project path is required');
            }
            if (!validatePath(args.projectPath)) {
                return createErrorResponse('Invalid project path');
            }
            try {
                const godotPath = await ctx.ensureGodotPath();
                if (!existsSync(join(args.projectPath, 'project.godot'))) {
                    return createErrorResponse(`Not a valid Mechanical Turk project: ${args.projectPath}`);
                }
                const { stdout: versionOutput } = await execFileAsync(godotPath, ['--version']);
                if (!isGodot44OrLater(versionOutput.trim())) {
                    return createErrorResponse(`UIDs are only supported in Godot 4.4 or later. Current version: ${versionOutput.trim()}`);
                }
                const { stdout, stderr } = await ctx.executeOperation('resave_resources', { projectPath: args.projectPath }, args.projectPath);
                if (stderr?.includes('Failed to')) {
                    return createErrorResponse(`Failed to update project UIDs: ${stderr}`);
                }
                return createTextResponse(`Project UIDs updated successfully.\n\nOutput: ${stdout}`);
            }
            catch (error) {
                return createErrorResponse(`Failed to update project UIDs: ${error?.message || 'Unknown error'}`);
            }
        },
    };
    return { tools, handlers };
}
