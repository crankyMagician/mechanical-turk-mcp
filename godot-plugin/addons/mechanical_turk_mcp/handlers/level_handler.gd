@tool
extends Node
## Handles live scene manipulation requests (set property, delete, tiles, reparent).


func _convert_typed_value(value) -> Variant:
	if typeof(value) != TYPE_DICTIONARY:
		return value
	if not value.has("_type"):
		var result := {}
		for key in value:
			result[key] = _convert_typed_value(value[key])
		return result
	var t: String = value.get("_type", "")
	match t:
		"Vector2":
			return Vector2(value.get("x", 0.0), value.get("y", 0.0))
		"Vector2i":
			return Vector2i(int(value.get("x", 0)), int(value.get("y", 0)))
		"Vector3":
			return Vector3(value.get("x", 0.0), value.get("y", 0.0), value.get("z", 0.0))
		"Vector3i":
			return Vector3i(int(value.get("x", 0)), int(value.get("y", 0)), int(value.get("z", 0)))
		"Color":
			return Color(value.get("r", 0.0), value.get("g", 0.0), value.get("b", 0.0), value.get("a", 1.0))
		"Rect2":
			return Rect2(value.get("x", 0.0), value.get("y", 0.0), value.get("w", 0.0), value.get("h", 0.0))
		"NodePath":
			return NodePath(value.get("path", ""))
		"Resource":
			var res_path: String = value.get("path", "")
			if res_path != "" and ResourceLoader.exists(res_path):
				return load(res_path)
			return null
		_:
			return value


func handle_set_property(params) -> Dictionary:
	if not params is Dictionary:
		return {"error": "Invalid params"}

	var node_path: String = params.get("node_path", "")
	var property: String = params.get("property", "")
	var value = params.get("value", null)

	if node_path.is_empty() or property.is_empty():
		return {"error": "node_path and property are required"}

	var tree := get_tree()
	if tree == null:
		return {"error": "No scene tree available"}

	var node: Node = tree.root.get_node_or_null(node_path.trim_prefix("/root"))
	if node_path == "/root":
		node = tree.root
	if node == null:
		return {"error": "Node not found: %s" % node_path}

	var converted = _convert_typed_value(value)
	node.set(property, converted)

	return {"status": "ok", "node": node_path, "property": property}


func handle_delete_node(params) -> Dictionary:
	if not params is Dictionary:
		return {"error": "Invalid params"}

	var node_path: String = params.get("node_path", "")
	if node_path.is_empty():
		return {"error": "node_path is required"}

	var tree := get_tree()
	if tree == null:
		return {"error": "No scene tree available"}

	var node: Node = tree.root.get_node_or_null(node_path.trim_prefix("/root"))
	if node_path == "/root":
		return {"error": "Cannot delete root node"}
	if node == null:
		return {"error": "Node not found: %s" % node_path}

	var node_name := node.name
	node.get_parent().remove_child(node)
	node.queue_free()

	return {"status": "ok", "deleted": node_path, "name": node_name}


func handle_set_tiles(params) -> Dictionary:
	if not params is Dictionary:
		return {"error": "Invalid params"}

	var node_path: String = params.get("node_path", "")
	var tiles = params.get("tiles", [])

	if node_path.is_empty():
		return {"error": "node_path is required"}

	var tree := get_tree()
	if tree == null:
		return {"error": "No scene tree available"}

	var node: Node = tree.root.get_node_or_null(node_path.trim_prefix("/root"))
	if node == null:
		return {"error": "Node not found: %s" % node_path}
	if not node is TileMapLayer:
		return {"error": "Node is not a TileMapLayer: %s" % node.get_class()}

	var tilemap := node as TileMapLayer
	var count := 0
	if tiles is Array:
		for tile in tiles:
			var coords := Vector2i(int(tile.get("x", 0)), int(tile.get("y", 0)))
			var source_id := int(tile.get("source_id", 0))
			var atlas_coords := Vector2i(int(tile.get("atlas_x", 0)), int(tile.get("atlas_y", 0)))
			tilemap.set_cell(coords, source_id, atlas_coords)
			count += 1

	return {"status": "ok", "node": node_path, "tiles_set": count}


func handle_reparent_node(params) -> Dictionary:
	if not params is Dictionary:
		return {"error": "Invalid params"}

	var node_path: String = params.get("node_path", "")
	var new_parent_path: String = params.get("new_parent_path", "")

	if node_path.is_empty() or new_parent_path.is_empty():
		return {"error": "node_path and new_parent_path are required"}

	var tree := get_tree()
	if tree == null:
		return {"error": "No scene tree available"}

	var node: Node = tree.root.get_node_or_null(node_path.trim_prefix("/root"))
	if node_path == "/root":
		return {"error": "Cannot reparent root node"}
	if node == null:
		return {"error": "Node not found: %s" % node_path}

	var new_parent: Node = tree.root.get_node_or_null(new_parent_path.trim_prefix("/root"))
	if new_parent_path == "/root":
		new_parent = tree.root
	if new_parent == null:
		return {"error": "New parent not found: %s" % new_parent_path}

	node.reparent(new_parent)

	return {"status": "ok", "node": node_path, "new_parent": new_parent_path, "new_path": str(node.get_path())}
