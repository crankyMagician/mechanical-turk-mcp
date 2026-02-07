/**
 * GUT test integration tools: list_tests, run_tests
 * CLI-based, no bridge needed.
 */

import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { validatePath } from '../utils/path-validation.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

const execFileAsync = promisify(execFile);

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findTestFiles(fullPath));
      } else if (entry.isFile() && entry.name.startsWith('test_') && entry.name.endsWith('.gd')) {
        results.push(fullPath);
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results;
}

export function registerTestingTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'list_tests',
      description: 'List GUT test files in a Godot project. Scans for test_*.gd files.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Godot project directory' },
          testDir: { type: 'string', description: 'Subdirectory to search (relative to project, default: "test")' },
        },
        required: ['projectPath'],
      },
    },
    {
      name: 'run_tests',
      description: 'Run GUT tests headlessly in a Godot project. Requires GUT addon installed.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string', description: 'Path to the Godot project directory' },
          testScript: { type: 'string', description: 'Optional: Specific test script to run (relative to project)' },
          testName: { type: 'string', description: 'Optional: Specific test function name to run' },
          testDir: { type: 'string', description: 'Optional: Test directory (relative to project)' },
          includeSubdirs: { type: 'boolean', description: 'Include subdirectories in test search (default: true)' },
          xmlOutput: { type: 'string', description: 'Optional: Path for JUnit XML output file' },
        },
        required: ['projectPath'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    list_tests: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.projectPath) {
        return createErrorResponse('Project path is required');
      }
      if (!validatePath(args.projectPath)) {
        return createErrorResponse('Invalid project path');
      }
      try {
        if (!existsSync(join(args.projectPath, 'project.godot'))) {
          return createErrorResponse(`Not a valid Godot project: ${args.projectPath}`);
        }

        // Determine search directory
        const testDir = args.testDir || 'test';
        const searchDir = join(args.projectPath, testDir);

        if (!existsSync(searchDir)) {
          // Fall back to searching the whole project
          const allTests = findTestFiles(args.projectPath);
          if (allTests.length === 0) {
            return createTextResponse(`No test files found in ${args.projectPath}. GUT test files should be named test_*.gd`);
          }
          const relativePaths = allTests.map(p => p.replace(args.projectPath + '/', ''));
          return createTextResponse(JSON.stringify({ testDir: '(project root)', tests: relativePaths }, null, 2));
        }

        const testFiles = findTestFiles(searchDir);
        const relativePaths = testFiles.map(p => p.replace(args.projectPath + '/', ''));
        return createTextResponse(JSON.stringify({ testDir, tests: relativePaths, count: relativePaths.length }, null, 2));
      } catch (error: any) {
        return createErrorResponse(`Failed to list tests: ${error?.message || 'Unknown error'}`);
      }
    },

    run_tests: async (rawArgs: any) => {
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
          return createErrorResponse(`Not a valid Godot project: ${args.projectPath}`);
        }

        // Check GUT is installed
        const gutScript = join(args.projectPath, 'addons', 'gut', 'gut_cmdln.gd');
        if (!existsSync(gutScript)) {
          return createErrorResponse('GUT testing framework not found', [
            'Install GUT addon in your project (addons/gut/)',
            'Get GUT from the Godot Asset Library or https://github.com/bitwes/Gut',
          ]);
        }

        // Build command args
        const cmdArgs = [
          '--headless',
          '--path', args.projectPath,
          '-s', 'addons/gut/gut_cmdln.gd',
          '-gexit',
        ];

        if (args.testScript) {
          cmdArgs.push(`-gtest=${args.testScript}`);
        }
        if (args.testName) {
          cmdArgs.push(`-gunit_test_name=${args.testName}`);
        }
        if (args.testDir) {
          cmdArgs.push(`-gdir=${args.testDir}`);
        }
        if (args.includeSubdirs !== false) {
          cmdArgs.push('-ginclude_subdirs');
        }
        if (args.xmlOutput) {
          cmdArgs.push(`-gjunit_xml_file=${args.xmlOutput}`);
        }

        const { stdout, stderr } = await execFileAsync(godotPath, cmdArgs, { timeout: 120000 });

        const output = (stdout || '') + (stderr || '');
        return createTextResponse(`GUT Test Results:\n\n${output}`);
      } catch (error: any) {
        // execFileAsync throws on non-zero exit but still has stdout/stderr
        if (error.stdout || error.stderr) {
          const output = (error.stdout || '') + (error.stderr || '');
          return createTextResponse(`GUT Test Results (with errors):\n\n${output}`);
        }
        return createErrorResponse(`Failed to run tests: ${error?.message || 'Unknown error'}`, [
          'Ensure Godot and GUT are installed correctly',
        ]);
      }
    },
  };

  return { tools, handlers };
}
