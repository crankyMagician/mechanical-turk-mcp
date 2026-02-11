@tool
extends Node
## WebSocket bridge server for MCP communication.
## Listens on port 9080 and dispatches JSON-RPC requests to handlers.

const PORT: int = 9080

var _tcp_server: TCPServer = null
var _peers: Array[WebSocketPeer] = []
var _handlers: Dictionary = {}

# Handler instances
var _screenshot_handler: Node = null
var _input_handler: Node = null
var _scene_tree_handler: Node = null
var _level_handler: Node = null


func _ready() -> void:
	_screenshot_handler = preload("res://addons/mechanical_turk_mcp/handlers/screenshot_handler.gd").new()
	_input_handler = preload("res://addons/mechanical_turk_mcp/handlers/input_handler.gd").new()
	_scene_tree_handler = preload("res://addons/mechanical_turk_mcp/handlers/scene_tree_handler.gd").new()
	_level_handler = preload("res://addons/mechanical_turk_mcp/handlers/level_handler.gd").new()
	add_child(_screenshot_handler)
	add_child(_input_handler)
	add_child(_scene_tree_handler)
	add_child(_level_handler)

	# Register method handlers
	_handlers["ping"] = _handle_ping
	_handlers["capture_screenshot"] = _screenshot_handler.handle
	_handlers["send_input_event"] = _input_handler.handle_input_event
	_handlers["send_action"] = _input_handler.handle_action
	_handlers["get_scene_tree"] = _scene_tree_handler.handle_get_tree
	_handlers["get_node_properties"] = _scene_tree_handler.handle_get_properties
	_handlers["set_node_property"] = _level_handler.handle_set_property
	_handlers["delete_node"] = _level_handler.handle_delete_node
	_handlers["set_tiles"] = _level_handler.handle_set_tiles
	_handlers["reparent_node"] = _level_handler.handle_reparent_node

	_start_server()


func _start_server() -> void:
	_tcp_server = TCPServer.new()
	var err := _tcp_server.listen(PORT)
	if err != OK:
		push_error("[MCP Bridge] Failed to listen on port %d: %s" % [PORT, error_string(err)])
		return
	print("[MCP Bridge] Server listening on port %d" % PORT)


func stop_server() -> void:
	for peer in _peers:
		peer.close()
	_peers.clear()
	if _tcp_server:
		_tcp_server.stop()
		_tcp_server = null
	print("[MCP Bridge] Server stopped")


func _process(_delta: float) -> void:
	if not _tcp_server:
		return

	# Accept new TCP connections and upgrade to WebSocket
	while _tcp_server.is_connection_available():
		var tcp_conn := _tcp_server.take_connection()
		if tcp_conn:
			var ws_peer := WebSocketPeer.new()
			var err := ws_peer.accept_stream(tcp_conn)
			if err == OK:
				_peers.append(ws_peer)
				print("[MCP Bridge] Client connected")
			else:
				push_error("[MCP Bridge] Failed to accept WebSocket: %s" % error_string(err))

	# Poll all peers
	var to_remove: Array[int] = []
	for i in range(_peers.size()):
		var peer := _peers[i]
		peer.poll()

		match peer.get_ready_state():
			WebSocketPeer.STATE_OPEN:
				while peer.get_available_packet_count() > 0:
					var data := peer.get_packet().get_string_from_utf8()
					_handle_message(peer, data)
			WebSocketPeer.STATE_CLOSING:
				pass  # Wait for close to complete
			WebSocketPeer.STATE_CLOSED:
				to_remove.append(i)
				print("[MCP Bridge] Client disconnected (code: %d)" % peer.get_close_code())

	# Remove disconnected peers (reverse order to preserve indices)
	for i in range(to_remove.size() - 1, -1, -1):
		_peers.remove_at(to_remove[i])


func _handle_message(peer: WebSocketPeer, data: String) -> void:
	var json := JSON.new()
	var err := json.parse(data)
	if err != OK:
		_send_error(peer, "0", -32700, "Parse error: %s" % json.get_error_message())
		return

	var msg = json.get_data()
	if typeof(msg) != TYPE_DICTIONARY:
		_send_error(peer, "0", -32600, "Invalid request: expected object")
		return

	var id: String = str(msg.get("id", "0"))
	var method: String = msg.get("method", "")
	var params = msg.get("params", {})

	if method.is_empty():
		_send_error(peer, id, -32600, "Missing method")
		return

	if not _handlers.has(method):
		_send_error(peer, id, -32601, "Method not found: %s" % method)
		return

	# Call the handler
	var handler: Callable = _handlers[method]
	var result = handler.call(params)

	# Handle deferred (async) results
	if result is Dictionary and result.has("_deferred"):
		# The handler returns a signal; we'll wait for it
		var deferred_signal: Signal = result["_deferred"]
		var deferred_result = await deferred_signal
		_send_result(peer, id, deferred_result)
	else:
		_send_result(peer, id, result)


func _send_result(peer: WebSocketPeer, id: String, result) -> void:
	var response := {
		"id": id,
		"result": result
	}
	peer.send_text(JSON.stringify(response))


func _send_error(peer: WebSocketPeer, id: String, code: int, message: String) -> void:
	var response := {
		"id": id,
		"error": {
			"code": code,
			"message": message
		}
	}
	peer.send_text(JSON.stringify(response))


func _handle_ping(_params) -> Dictionary:
	return {
		"status": "ok",
		"server": "mechanical-turk-mcp",
		"version": "0.1.0"
	}
