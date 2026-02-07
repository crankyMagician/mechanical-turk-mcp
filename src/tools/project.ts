/**
 * Project tools: list_projects, get_project_info, get_godot_version
 */

import { join, basename } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

const execFileAsync = promisify(execFile);

function findGodotProjects(directory: string, recursive: boolean): Array<{ path: string; name: string }> {
  const projects: Array<{ path: string; name: string }> = [];
  try {
    const projectFile = join(directory, 'project.godot');
    if (existsSync(projectFile)) {
      projects.push({ path: directory, name: basename(directory) });
    }

    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subdir = join(directory, entry.name);
      const subProjectFile = join(subdir, 'project.godot');
      if (existsSync(subProjectFile)) {
        projects.push({ path: subdir, name: entry.name });
      } else if (recursive) {
        projects.push(...findGodotProjects(subdir, true));
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return projects;
}

function getProjectStructure(projectPath: string): any {
  const structure = { scenes: 0, scripts: 0, assets: 0, other: 0 };
  const scanDirectory = (currentPath: string) => {
    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) {
          scanDirectory(join(currentPath, entry.name));
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase();
          if (ext === 'tscn') structure.scenes++;
          else if (ext === 'gd' || ext === 'gdscript' || ext === 'cs') structure.scripts++;
          else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'ttf', 'wav', 'mp3', 'ogg'].includes(ext || '')) structure.assets++;
          else structure.other++;
        }
      }
    } catch { /* skip */ }
  };
  scanDirectory(projectPath);
  return structure;
}

export function registerProjectTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'get_godot_version',
      description: 'Get the installed Godot version',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'list_projects',
      description: 'List Godot projects in a directory',
      inputSchema: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to search for Godot projects' },
          recursive: { type: 'boolean', description: 'Whether to search recursively (default: false)' },
        },
        required: ['directory'],
      },
    },
    {
      name: 'get_project_info',
      description: 'Retrieve metadata about a Godot project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Godot project directory' },
        },
        required: ['projectPath'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    get_godot_version: async () => {
      try {
        const godotPath = await ctx.ensureGodotPath();
        const { stdout } = await execFileAsync(godotPath, ['--version']);
        return createTextResponse(stdout.trim());
      } catch (error: any) {
        return createErrorResponse(`Failed to get Godot version: ${error?.message || 'Unknown error'}`, [
          'Ensure Godot is installed correctly',
        ]);
      }
    },

    list_projects: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.directory) {
        return createErrorResponse('Directory is required', ['Provide a valid directory path']);
      }
      if (!validatePath(args.directory)) {
        return createErrorResponse('Invalid directory path', ['Provide a valid path without ".."']);
      }
      try {
        if (!existsSync(args.directory)) {
          return createErrorResponse(`Directory does not exist: ${args.directory}`);
        }
        const projects = findGodotProjects(args.directory, args.recursive === true);
        return createTextResponse(JSON.stringify(projects, null, 2));
      } catch (error: any) {
        return createErrorResponse(`Failed to list projects: ${error?.message || 'Unknown error'}`);
      }
    },

    get_project_info: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath) {
        return createErrorResponse('Project path is required');
      }
      if (!validatePath(args.projectPath)) {
        return createErrorResponse('Invalid project path');
      }
      try {
        const godotPath = await ctx.ensureGodotPath();
        const projectFile = join(args.projectPath, 'project.godot');
        if (!existsSync(projectFile)) {
          return createErrorResponse(`Not a valid Godot project: ${args.projectPath}`, [
            'Ensure the path points to a directory containing a project.godot file',
          ]);
        }
        const { stdout } = await execFileAsync(godotPath, ['--version'], { timeout: 10000 });
        const projectStructure = getProjectStructure(args.projectPath);

        let projectName = basename(args.projectPath);
        try {
          const content = readFileSync(projectFile, 'utf8');
          const match = content.match(/config\/name="([^"]+)"/);
          if (match?.[1]) projectName = match[1];
        } catch { /* use default name */ }

        return createTextResponse(JSON.stringify({
          name: projectName,
          path: args.projectPath,
          godotVersion: stdout.trim(),
          structure: projectStructure,
        }, null, 2));
      } catch (error: any) {
        return createErrorResponse(`Failed to get project info: ${error?.message || 'Unknown error'}`);
      }
    },
  };

  return { tools, handlers };
}
