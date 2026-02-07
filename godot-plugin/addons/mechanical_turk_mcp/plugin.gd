@tool
extends EditorPlugin

var bridge_server: Node = null

func _enter_tree() -> void:
	bridge_server = preload("res://addons/mechanical_turk_mcp/bridge_server.gd").new()
	bridge_server.name = "MCPBridgeServer"
	add_child(bridge_server)
	print("[MCP Bridge] Plugin enabled")

func _exit_tree() -> void:
	if bridge_server:
		bridge_server.stop_server()
		bridge_server.queue_free()
		bridge_server = null
	print("[MCP Bridge] Plugin disabled")
