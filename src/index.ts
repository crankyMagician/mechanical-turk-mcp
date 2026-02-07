#!/usr/bin/env node
/**
 * Mechanical Turk MCP Server
 *
 * Enhanced Godot MCP server with WebSocket bridge support for
 * live editor integration (screenshots, input simulation, scene tree inspection).
 */

import { GodotServer } from './server.js';

const server = new GodotServer();
server.run().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Failed to run server:', errorMessage);
  process.exit(1);
});
