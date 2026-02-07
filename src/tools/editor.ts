/**
 * Editor tools: launch_editor, run_project, get_debug_output, stop_project
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

interface GodotProcess {
  process: any;
  output: string[];
  errors: string[];
}

let activeProcess: GodotProcess | null = null;

export function getActiveProcess(): GodotProcess | null {
  return activeProcess;
}

export function clearActiveProcess(): void {
  if (activeProcess) {
    activeProcess.process.kill();
    activeProcess = null;
  }
}

export function registerEditorTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'launch_editor',
      description: 'Launch Godot editor for a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Godot project directory' },
        },
        required: ['projectPath'],
      },
    },
    {
      name: 'run_project',
      description: 'Run the Godot project and capture output',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Godot project directory' },
          scene: { type: 'string', description: 'Optional: Specific scene to run' },
        },
        required: ['projectPath'],
      },
    },
    {
      name: 'get_debug_output',
      description: 'Get the current debug output and errors',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'stop_project',
      description: 'Stop the currently running Godot project',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    launch_editor: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath) {
        return createErrorResponse('Project path is required', ['Provide a valid path to a Godot project directory']);
      }
      if (!validatePath(args.projectPath)) {
        return createErrorResponse('Invalid project path', ['Provide a valid path without ".." or other potentially unsafe characters']);
      }

      try {
        const godotPath = await ctx.ensureGodotPath();
        const projectFile = join(args.projectPath, 'project.godot');
        if (!existsSync(projectFile)) {
          return createErrorResponse(`Not a valid Godot project: ${args.projectPath}`, [
            'Ensure the path points to a directory containing a project.godot file',
            'Use list_projects to find valid Godot projects',
          ]);
        }

        spawn(godotPath, ['-e', '--path', args.projectPath], { stdio: 'pipe' });
        return createTextResponse(`Godot editor launched successfully for project at ${args.projectPath}.`);
      } catch (error: any) {
        return createErrorResponse(`Failed to launch Godot editor: ${error?.message || 'Unknown error'}`, [
          'Ensure Godot is installed correctly',
          'Check if the GODOT_PATH environment variable is set correctly',
        ]);
      }
    },

    run_project: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath) {
        return createErrorResponse('Project path is required', ['Provide a valid path to a Godot project directory']);
      }
      if (!validatePath(args.projectPath)) {
        return createErrorResponse('Invalid project path', ['Provide a valid path without ".." or other potentially unsafe characters']);
      }

      try {
        const godotPath = await ctx.ensureGodotPath();
        const projectFile = join(args.projectPath, 'project.godot');
        if (!existsSync(projectFile)) {
          return createErrorResponse(`Not a valid Godot project: ${args.projectPath}`, [
            'Ensure the path points to a directory containing a project.godot file',
          ]);
        }

        if (activeProcess) {
          activeProcess.process.kill();
        }

        const cmdArgs = ['-d', '--path', args.projectPath];
        if (args.scene && validatePath(args.scene)) {
          cmdArgs.push(args.scene);
        }

        const proc = spawn(godotPath, cmdArgs, { stdio: 'pipe' });
        const output: string[] = [];
        const errors: string[] = [];

        proc.stdout?.on('data', (data: Buffer) => {
          output.push(...data.toString().split('\n'));
        });
        proc.stderr?.on('data', (data: Buffer) => {
          errors.push(...data.toString().split('\n'));
        });
        proc.on('exit', () => {
          if (activeProcess && activeProcess.process === proc) {
            activeProcess = null;
          }
        });

        activeProcess = { process: proc, output, errors };
        return createTextResponse('Godot project started in debug mode. Use get_debug_output to see output.');
      } catch (error: any) {
        return createErrorResponse(`Failed to run Godot project: ${error?.message || 'Unknown error'}`, [
          'Ensure Godot is installed correctly',
        ]);
      }
    },

    get_debug_output: async () => {
      if (!activeProcess) {
        return createErrorResponse('No active Godot process.', ['Use run_project to start a Godot project first']);
      }
      return createTextResponse(JSON.stringify({ output: activeProcess.output, errors: activeProcess.errors }, null, 2));
    },

    stop_project: async () => {
      if (!activeProcess) {
        return createErrorResponse('No active Godot process to stop.', ['Use run_project to start a Godot project first']);
      }
      activeProcess.process.kill();
      const output = activeProcess.output;
      const errors = activeProcess.errors;
      activeProcess = null;
      return createTextResponse(JSON.stringify({ message: 'Godot project stopped', finalOutput: output, finalErrors: errors }, null, 2));
    },
  };

  return { tools, handlers };
}
