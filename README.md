
# Mechanical Turk MCP

![Mechanical Turk](assets/gold_mechanical_turk.png)

[![](https://badge.mcpx.dev?type=server 'MCP Server')](https://modelcontextprotocol.io/introduction)
[![](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white 'Node.js')](https://nodejs.org/en/download/)
[![](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white 'TypeScript')](https://www.typescriptlang.org/)

[![](https://img.shields.io/github/last-commit/crankyMagician/mechanical-turk-mcp 'Last Commit')](https://github.com/crankyMagician/mechanical-turk-mcp/commits/main)
[![](https://img.shields.io/github/stars/crankyMagician/mechanical-turk-mcp 'Stars')](https://github.com/crankyMagician/mechanical-turk-mcp/stargazers)
[![](https://img.shields.io/github/forks/crankyMagician/mechanical-turk-mcp 'Forks')](https://github.com/crankyMagician/mechanical-turk-mcp/network/members)
[![](https://img.shields.io/badge/License-MIT-red.svg 'MIT License')](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for interacting with the Mechanical Turk engine.

## Introduction

Mechanical Turk MCP enables AI assistants to launch the editor, run projects, capture debug output, and control project execution - all through a standardized interface.

This direct feedback loop helps AI assistants like Claude understand what works and what doesn't in real projects, leading to better code generation and debugging assistance.

## Features

- **Launch Editor**: Open the Mechanical Turk editor for a specific project
- **Run Projects**: Execute projects in debug mode
- **Capture Debug Output**: Retrieve console output and error messages
- **Control Execution**: Start and stop projects programmatically
- **Get Engine Version**: Retrieve the installed engine version
- **List Projects**: Find Mechanical Turk projects in a specified directory
- **Project Analysis**: Get detailed information about project structure
- **Scene Management**:
  - Create new scenes with specified root node types
  - Add nodes to existing scenes with customizable properties
  - Load sprites and textures into Sprite2D nodes
  - Export 3D scenes as MeshLibrary resources for GridMap
  - Save scenes with options for creating variants
- **UID Management** (for Godot 4.4+):
  - Get UID for specific files
  - Update UID references by resaving resources
- **Live Editor Integration** (via WebSocket bridge plugin):
  - Capture screenshots from the editor or running game
  - Send keyboard and mouse input events
  - Inspect the live scene tree hierarchy
  - Get detailed node properties
- **Testing**:
  - List GUT test files in a project
  - Run GUT tests headlessly

## Requirements

- [Godot Engine](https://godotengine.org/download) installed on your system
- Node.js and npm
- An AI assistant that supports MCP (Cline, Cursor, etc.)

## Installation and Configuration

### Step 1: Install and Build

First, clone the repository and build the MCP server:

```bash
git clone https://github.com/crankyMagician/mechanical-turk-mcp.git
cd mechanical-turk-mcp
npm install
npm run build
```

### Step 2: Configure with Your AI Assistant

#### Option A: Configure with Cline

Add to your Cline MCP settings file (`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "mechanical-turk": {
      "command": "node",
      "args": ["/absolute/path/to/mechanical-turk-mcp/build/index.js"],
      "env": {
        "DEBUG": "true"                  // Optional: Enable detailed logging
      },
      "disabled": false,
      "autoApprove": [
        "launch_editor",
        "run_project",
        "get_debug_output",
        "stop_project",
        "get_godot_version",
        "list_projects",
        "get_project_info",
        "create_scene",
        "add_node",
        "load_sprite",
        "export_mesh_library",
        "save_scene",
        "get_uid",
        "update_project_uids",
        "install_plugin",
        "capture_screenshot",
        "send_input_event",
        "send_action",
        "get_scene_tree",
        "get_node_properties",
        "list_tests",
        "run_tests"
      ]
    }
  }
}
```

#### Option B: Configure with Cursor

**Using the Cursor UI:**

1. Go to **Cursor Settings** > **Features** > **MCP**
2. Click on the **+ Add New MCP Server** button
3. Fill out the form:
   - Name: `mechanical-turk` (or any name you prefer)
   - Type: `command`
   - Command: `node /absolute/path/to/mechanical-turk-mcp/build/index.js`
4. Click "Add"
5. You may need to press the refresh button in the top right corner of the MCP server card to populate the tool list

**Using Project-Specific Configuration:**

Create a file at `.cursor/mcp.json` in your project directory with the following content:

```json
{
  "mcpServers": {
    "mechanical-turk": {
      "command": "node",
      "args": ["/absolute/path/to/mechanical-turk-mcp/build/index.js"],
      "env": {
        "DEBUG": "true"                  // Enable detailed logging
      }
    }
  }
}
```

#### Option C: Configure with Claude Code

Add to your Claude Code MCP settings (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "mechanical-turk": {
      "command": "node",
      "args": ["/absolute/path/to/mechanical-turk-mcp/build/index.js"],
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

### Step 3: Optional Environment Variables

You can customize the server behavior with these environment variables:

- `GODOT_PATH`: Path to the Godot executable (overrides automatic detection)
- `DEBUG`: Set to "true" to enable detailed server-side debug logging

### Step 4: Install the Bridge Plugin (Optional)

For live editor integration features (screenshots, input simulation, scene tree inspection), install the bridge plugin into your project:

1. Use the `install_plugin` tool, or manually copy `godot-plugin/addons/mechanical_turk_mcp/` into your project's `addons/` directory
2. Open the project in the editor
3. Go to **Project > Project Settings > Plugins**
4. Enable **Mechanical Turk MCP Bridge**

The plugin starts a WebSocket server on port 9080 when enabled.

## Example Prompts

Once configured, your AI assistant will automatically run the MCP server when needed. You can use prompts like:

```text
"Launch the editor for my project at /path/to/project"

"Run my project and show me any errors"

"Get information about my project structure"

"Analyze my project structure and suggest improvements"

"Help me debug this error in my project: [paste error]"

"Write a GDScript for a character controller with double jump and wall sliding"

"Create a new scene with a Player node in my project"

"Add a Sprite2D node to my player scene and load the character texture"

"Export my 3D models as a MeshLibrary for use with GridMap"

"Create a UI scene with buttons and labels for my game's main menu"

"Take a screenshot of my running game"

"Send a key press to test my player movement"

"Inspect the scene tree of my running game"

"Run the GUT tests in my project"
```

## Implementation Details

### Architecture

The Mechanical Turk MCP server uses two modes of operation:

1. **CLI Mode**: Simple operations like launching the editor or getting project info use Godot's built-in CLI commands directly. Complex operations like creating scenes or adding nodes use a bundled GDScript file (`godot_operations.gd`) that handles all operations.
2. **WebSocket Bridge Mode**: Live editor integration features (screenshots, input simulation, scene tree inspection) use a WebSocket bridge plugin that runs inside the Godot editor on port 9080.

This architecture provides several benefits:

- **No Temporary Files**: Eliminates the need for temporary script files, keeping your system clean
- **Simplified Codebase**: Centralizes all operations in organized modules
- **Better Maintainability**: Makes it easier to add new operations or modify existing ones
- **Improved Error Handling**: Provides consistent error reporting across all operations
- **Live Integration**: Real-time communication with the running editor via WebSocket

## Troubleshooting

- **Godot Not Found**: Set the GODOT_PATH environment variable to your Godot executable
- **Connection Issues**: Ensure the server is running and restart your AI assistant
- **Invalid Project Path**: Ensure the path points to a directory containing a project.godot file
- **Build Issues**: Make sure all dependencies are installed by running `npm install`
- **Bridge Not Connecting**: Ensure the Mechanical Turk MCP Bridge plugin is installed and enabled in the editor
- **For Cursor Specifically**:
-   Ensure the MCP server shows up and is enabled in Cursor settings (Settings > MCP)
-   MCP tools can only be run using the Agent chat profile (Cursor Pro or Business subscription)
-   Use "Yolo Mode" to automatically run MCP tool requests

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
