/**
 * Screenshot tool: capture_screenshot
 * Captures game or editor viewport via the bridge.
 */
import { writeFileSync } from 'fs';
import { normalizeParameters } from '../utils/parameters.js';
import { createErrorResponse, createImageResponse, createTextResponse } from '../utils/errors.js';
export function registerScreenshotTools(ctx) {
    const tools = [
        {
            name: 'capture_screenshot',
            description: 'Capture a screenshot from the running Mechanical Turk editor or game viewport. Requires the Mechanical Turk editor to be running with the MCP plugin.',
            inputSchema: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        enum: ['game', 'editor'],
                        description: 'Which viewport to capture: "game" for the running game, "editor" for the editor viewport (default: "game")',
                    },
                    outputPath: {
                        type: 'string',
                        description: 'Optional: File path to save the screenshot PNG. If omitted, returns the image inline.',
                    },
                    width: {
                        type: 'number',
                        description: 'Optional: Resize width in pixels',
                    },
                    height: {
                        type: 'number',
                        description: 'Optional: Resize height in pixels',
                    },
                },
                required: [],
            },
        },
    ];
    const handlers = {
        capture_screenshot: async (rawArgs) => {
            const args = normalizeParameters(rawArgs || {});
            try {
                const result = await ctx.bridgeClient.request('capture_screenshot', {
                    source: args.source || 'game',
                    width: args.width,
                    height: args.height,
                });
                if (!result || !result.image_base64) {
                    return createErrorResponse('No screenshot data received from the engine');
                }
                // If outputPath is specified, save to file
                if (args.outputPath) {
                    const buffer = Buffer.from(result.image_base64, 'base64');
                    writeFileSync(args.outputPath, buffer);
                    return createTextResponse(`Screenshot saved to: ${args.outputPath} (${buffer.length} bytes)`);
                }
                // Return as inline image
                return createImageResponse(result.image_base64, 'image/png', `Screenshot captured (${result.width}x${result.height})`);
            }
            catch (error) {
                return createErrorResponse(`Failed to capture screenshot: ${error?.message || 'Unknown error'}`, [
                    'Ensure the Mechanical Turk editor is running with the MCP plugin enabled',
                    'Use install_plugin to install the plugin if not already installed',
                    'For "game" source, ensure a project is running in the editor',
                ]);
            }
        },
    };
    return { tools, handlers };
}
