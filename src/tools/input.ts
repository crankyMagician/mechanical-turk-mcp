/**
 * Input simulation tools: send_input_event, send_action
 * Injects input events into the running Godot game via the bridge.
 */

import { ToolContext, ToolRegistration } from './types.js';
import { normalizeParameters } from '../utils/parameters.js';
import { createErrorResponse, createTextResponse } from '../utils/errors.js';

export function registerInputTools(ctx: ToolContext): ToolRegistration {
  const tools = [
    {
      name: 'send_input_event',
      description: 'Send a keyboard or mouse input event to the running Mechanical Turk game. Requires the Mechanical Turk editor with MCP plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            enum: ['key', 'mouse_button', 'mouse_motion'],
            description: 'Type of input event',
          },
          key: {
            type: 'string',
            description: 'Key name for key events (e.g., "A", "Space", "Enter", "Escape")',
          },
          keycode: {
            type: 'number',
            description: 'Raw keycode (alternative to key name)',
          },
          pressed: {
            type: 'boolean',
            description: 'Whether the key/button is pressed (true) or released (false). Default: true',
          },
          button: {
            type: 'string',
            enum: ['left', 'right', 'middle'],
            description: 'Mouse button for mouse_button events',
          },
          position: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            description: 'Mouse position for mouse events',
          },
          relative: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            description: 'Relative mouse motion for mouse_motion events',
          },
        },
        required: ['eventType'],
      },
    },
    {
      name: 'send_action',
      description: 'Trigger a Mechanical Turk Input Map action (press or release). Requires the Mechanical Turk editor with MCP plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Input Map action name (e.g., "ui_accept", "move_left", "jump")',
          },
          pressed: {
            type: 'boolean',
            description: 'Whether to press (true) or release (false) the action. Default: true',
          },
          strength: {
            type: 'number',
            description: 'Action strength from 0.0 to 1.0. Default: 1.0',
          },
        },
        required: ['action'],
      },
    },
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {
    send_input_event: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.eventType) {
        return createErrorResponse('eventType is required', ['Provide "key", "mouse_button", or "mouse_motion"']);
      }
      try {
        const result = await ctx.bridgeClient.request('send_input_event', {
          event_type: args.eventType,
          key: args.key,
          keycode: args.keycode,
          pressed: args.pressed !== undefined ? args.pressed : true,
          button: args.button,
          position: args.position,
          relative: args.relative,
        });
        return createTextResponse(`Input event sent: ${args.eventType}${args.key ? ` (${args.key})` : ''} - ${result?.status || 'ok'}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to send input event: ${error?.message || 'Unknown error'}`, [
          'Ensure the Mechanical Turk editor is running with the MCP plugin enabled',
          'For game input, ensure a project is running in the editor',
        ]);
      }
    },

    send_action: async (rawArgs: any) => {
      const args = normalizeParameters(rawArgs || {});
      if (!args.action) {
        return createErrorResponse('action is required', ['Provide an Input Map action name']);
      }
      try {
        const result = await ctx.bridgeClient.request('send_action', {
          action: args.action,
          pressed: args.pressed !== undefined ? args.pressed : true,
          strength: args.strength !== undefined ? args.strength : 1.0,
        });
        return createTextResponse(`Action '${args.action}' ${args.pressed !== false ? 'pressed' : 'released'} - ${result?.status || 'ok'}`);
      } catch (error: any) {
        return createErrorResponse(`Failed to send action: ${error?.message || 'Unknown error'}`, [
          'Ensure the Mechanical Turk editor is running with the MCP plugin enabled',
          `Verify that action "${args.action}" exists in the project's Input Map`,
        ]);
      }
    },
  };

  return { tools, handlers };
}
