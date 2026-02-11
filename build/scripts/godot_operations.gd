#!/usr/bin/env -S godot --headless --script
extends SceneTree

# Debug mode flag
var debug_mode = false

func _init():
    var args = OS.get_cmdline_args()
    
    # Check for debug flag
    debug_mode = "--debug-godot" in args
    
    # Find the script argument and determine the positions of operation and params
    var script_index = args.find("--script")
    if script_index == -1:
        log_error("Could not find --script argument")
        quit(1)
    
    # The operation should be 2 positions after the script path (script_index + 1 is the script path itself)
    var operation_index = script_index + 2
    # The params should be 3 positions after the script path
    var params_index = script_index + 3
    
    if args.size() <= params_index:
        log_error("Usage: godot --headless --script godot_operations.gd <operation> <json_params>")
        log_error("Not enough command-line arguments provided.")
        quit(1)
    
    # Log all arguments for debugging
    log_debug("All arguments: " + str(args))
    log_debug("Script index: " + str(script_index))
    log_debug("Operation index: " + str(operation_index))
    log_debug("Params index: " + str(params_index))
    
    var operation = args[operation_index]
    var params_json = args[params_index]
    
    log_info("Operation: " + operation)
    log_debug("Params JSON: " + params_json)
    
    # Parse JSON using Godot 4.x API
    var json = JSON.new()
    var error = json.parse(params_json)
    var params = null
    
    if error == OK:
        params = json.get_data()
    else:
        log_error("Failed to parse JSON parameters: " + params_json)
        log_error("JSON Error: " + json.get_error_message() + " at line " + str(json.get_error_line()))
        quit(1)
    
    if not params:
        log_error("Failed to parse JSON parameters: " + params_json)
        quit(1)
    
    log_info("Executing operation: " + operation)
    
    match operation:
        "create_scene":
            create_scene(params)
        "add_node":
            add_node(params)
        "load_sprite":
            load_sprite(params)
        "export_mesh_library":
            export_mesh_library(params)
        "save_scene":
            save_scene(params)
        "get_uid":
            get_uid(params)
        "resave_resources":
            resave_resources(params)
        "modify_node":
            modify_node(params)
        "delete_node":
            delete_node(params)
        "reparent_node":
            reparent_node(params)
        "create_tilemap":
            create_tilemap(params)
        "set_tiles":
            set_tiles(params)
        "add_collision_shape":
            add_collision_shape(params)
        "configure_physics_body":
            configure_physics_body(params)
        "attach_script":
            attach_script(params)
        "create_and_attach_script":
            create_and_attach_script(params)
        "batch_scene_operations":
            batch_scene_operations(params)
        _:
            log_error("Unknown operation: " + operation)
            quit(1)
    
    quit()

# Logging functions
func log_debug(message):
    if debug_mode:
        print("[DEBUG] " + message)

func log_info(message):
    print("[INFO] " + message)

func log_error(message):
    printerr("[ERROR] " + message)

# --- Type conversion: JSON typed values → Godot types ---
func convert_typed_value(value):
    if typeof(value) != TYPE_DICTIONARY:
        return value
    if not value.has("_type"):
        # Recurse into plain dictionaries
        var result = {}
        for key in value:
            result[key] = convert_typed_value(value[key])
        return result
    var t = value["_type"]
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
            var res_path = value.get("path", "")
            if res_path != "" and ResourceLoader.exists(res_path):
                return load(res_path)
            return null
        "RectangleShape2D":
            var shape = RectangleShape2D.new()
            if value.has("size"):
                shape.size = convert_typed_value(value["size"])
            return shape
        "CircleShape2D":
            var shape = CircleShape2D.new()
            if value.has("radius"):
                shape.radius = value["radius"]
            return shape
        "CapsuleShape2D":
            var shape = CapsuleShape2D.new()
            if value.has("radius"):
                shape.radius = value["radius"]
            if value.has("height"):
                shape.height = value["height"]
            return shape
        "WorldBoundaryShape2D":
            var shape = WorldBoundaryShape2D.new()
            if value.has("normal"):
                shape.normal = convert_typed_value(value["normal"])
            if value.has("distance"):
                shape.distance = value["distance"]
            return shape
        "SegmentShape2D":
            var shape = SegmentShape2D.new()
            if value.has("a"):
                shape.a = convert_typed_value(value["a"])
            if value.has("b"):
                shape.b = convert_typed_value(value["b"])
            return shape
        "ConvexPolygonShape2D":
            var shape = ConvexPolygonShape2D.new()
            if value.has("points") and value["points"] is Array:
                var pts = PackedVector2Array()
                for pt in value["points"]:
                    pts.append(convert_typed_value(pt))
                shape.points = pts
            return shape
        _:
            log_debug("Unknown _type in convert_typed_value: " + t)
            return value

# --- Scene editing helpers ---
func load_scene_for_edit(scene_path: String) -> Array:
    var full_path = scene_path
    if not full_path.begins_with("res://"):
        full_path = "res://" + full_path
    var absolute_path = ProjectSettings.globalize_path(full_path)
    if not FileAccess.file_exists(absolute_path):
        log_error("Scene file does not exist at: " + absolute_path)
        return []
    var packed = load(full_path)
    if not packed:
        log_error("Failed to load scene: " + full_path)
        return []
    var scene_root = packed.instantiate()
    if not scene_root:
        log_error("Failed to instantiate scene: " + full_path)
        return []
    return [full_path, packed, scene_root]

func find_node_by_path(scene_root: Node, node_path: String) -> Node:
    if node_path == "root" or node_path == ".":
        return scene_root
    var rel_path = node_path
    if rel_path.begins_with("root/"):
        rel_path = rel_path.substr(5)
    var node = scene_root.get_node_or_null(rel_path)
    if not node:
        log_error("Node not found: " + node_path)
    return node

func save_scene_to_disk(scene_root: Node, full_path: String) -> bool:
    var packed = PackedScene.new()
    var result = packed.pack(scene_root)
    if result != OK:
        log_error("Failed to pack scene: " + str(result))
        return false
    var save_err = ResourceSaver.save(packed, full_path)
    if save_err != OK:
        log_error("Failed to save scene: " + str(save_err))
        return false
    return true

func set_owner_recursive(node: Node, owner: Node) -> void:
    node.owner = owner
    for child in node.get_children():
        set_owner_recursive(child, owner)

# --- Level-2D operations ---

# Modify properties on an existing node
func modify_node(params):
    log_info("Modifying node in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)

    if params.has("properties"):
        var properties = params.properties
        for property in properties:
            var converted = convert_typed_value(properties[property])
            log_debug("Setting property: " + property + " = " + str(converted))
            node.set(property, converted)

    if save_scene_to_disk(scene_root, full_path):
        log_info("Node modified successfully: " + params.node_path)
    else:
        quit(1)

# Delete a node from a scene
func delete_node(params):
    log_info("Deleting node from scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)
    if node == scene_root:
        log_error("Cannot delete the root node")
        quit(1)

    node.get_parent().remove_child(node)
    node.queue_free()

    if save_scene_to_disk(scene_root, full_path):
        log_info("Node deleted successfully: " + params.node_path)
    else:
        quit(1)

# Reparent a node in a scene
func reparent_node(params):
    log_info("Reparenting node in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)
    if node == scene_root:
        log_error("Cannot reparent the root node")
        quit(1)

    var new_parent = find_node_by_path(scene_root, params.new_parent_path)
    if not new_parent:
        quit(1)

    node.get_parent().remove_child(node)
    new_parent.add_child(node)
    set_owner_recursive(node, scene_root)

    if save_scene_to_disk(scene_root, full_path):
        log_info("Node reparented successfully: " + params.node_path + " -> " + params.new_parent_path)
    else:
        quit(1)

# Create a TileMapLayer with TileSet
func create_tilemap(params):
    log_info("Creating TileMapLayer in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var parent_path = params.get("parent_node_path", "root")
    var parent = find_node_by_path(scene_root, parent_path)
    if not parent:
        quit(1)

    var tilemap = TileMapLayer.new()
    tilemap.name = params.get("node_name", "TileMapLayer")

    # Create TileSet
    var tileset = TileSet.new()
    if params.has("tile_size"):
        var ts = params.tile_size
        tileset.tile_size = Vector2i(int(ts.get("x", 16)), int(ts.get("y", 16)))

    # Add atlas source if provided
    if params.has("atlas_source"):
        var atlas_cfg = params.atlas_source
        var atlas = TileSetAtlasSource.new()
        var tex_path = atlas_cfg.get("texture_path", "")
        if not tex_path.begins_with("res://"):
            tex_path = "res://" + tex_path
        if ResourceLoader.exists(tex_path):
            atlas.texture = load(tex_path)
        if atlas_cfg.has("tile_size"):
            var ats = atlas_cfg.tile_size
            atlas.texture_region_size = Vector2i(int(ats.get("x", 16)), int(ats.get("y", 16)))
        var atlas_id = int(atlas_cfg.get("atlas_id", 0))
        tileset.add_source(atlas, atlas_id)

    tilemap.tile_set = tileset
    parent.add_child(tilemap)
    tilemap.owner = scene_root

    if save_scene_to_disk(scene_root, full_path):
        log_info("TileMapLayer created successfully: " + tilemap.name)
    else:
        quit(1)

# Set tiles on a TileMapLayer
func set_tiles(params):
    log_info("Setting tiles in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)
    if not node is TileMapLayer:
        log_error("Node is not a TileMapLayer: " + params.node_path)
        quit(1)

    var tilemap := node as TileMapLayer
    if params.has("tiles") and params.tiles is Array:
        for tile in params.tiles:
            var coords = Vector2i(int(tile.get("x", 0)), int(tile.get("y", 0)))
            var source_id = int(tile.get("source_id", 0))
            var atlas_coords = Vector2i(int(tile.get("atlas_x", 0)), int(tile.get("atlas_y", 0)))
            tilemap.set_cell(coords, source_id, atlas_coords)

    if save_scene_to_disk(scene_root, full_path):
        log_info("Tiles set successfully on: " + params.node_path)
    else:
        quit(1)

# Add a CollisionShape2D with a shape resource
func add_collision_shape(params):
    log_info("Adding collision shape in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var parent_path = params.get("parent_node_path", "root")
    var parent = find_node_by_path(scene_root, parent_path)
    if not parent:
        quit(1)

    var collision = CollisionShape2D.new()
    collision.name = params.get("node_name", "CollisionShape2D")

    if params.has("shape"):
        var shape = convert_typed_value(params.shape)
        if shape is Shape2D:
            collision.shape = shape
        else:
            log_error("Invalid shape value, must be a Shape2D type")
            quit(1)

    if params.has("properties"):
        var properties = params.properties
        for property in properties:
            collision.set(property, convert_typed_value(properties[property]))

    parent.add_child(collision)
    collision.owner = scene_root

    if save_scene_to_disk(scene_root, full_path):
        log_info("CollisionShape2D added successfully: " + collision.name)
    else:
        quit(1)

# Configure physics body properties
func configure_physics_body(params):
    log_info("Configuring physics body in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)

    if not (node is StaticBody2D or node is RigidBody2D or node is CharacterBody2D or node is Area2D):
        log_error("Node is not a physics body: " + node.get_class())
        quit(1)

    if params.has("properties"):
        var properties = params.properties
        for property in properties:
            node.set(property, convert_typed_value(properties[property]))

    if save_scene_to_disk(scene_root, full_path):
        log_info("Physics body configured successfully: " + params.node_path)
    else:
        quit(1)

# Attach an existing script to a node
func attach_script(params):
    log_info("Attaching script in scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)

    var script_path = params.script_path
    if not script_path.begins_with("res://"):
        script_path = "res://" + script_path
    if not ResourceLoader.exists(script_path):
        log_error("Script file does not exist: " + script_path)
        quit(1)

    var scr = load(script_path)
    if not scr:
        log_error("Failed to load script: " + script_path)
        quit(1)

    node.set_script(scr)

    if save_scene_to_disk(scene_root, full_path):
        log_info("Script attached successfully: " + script_path + " -> " + params.node_path)
    else:
        quit(1)

# Create a new script file and attach it to a node
func create_and_attach_script(params):
    log_info("Creating and attaching script in scene: " + params.scene_path)

    var script_path = params.script_path
    if not script_path.begins_with("res://"):
        script_path = "res://" + script_path

    var base_class = params.get("base_class", "Node")
    var template = params.get("template", "default")
    var content = params.get("content", "")

    # Generate script content
    var script_content = ""
    if content != "":
        script_content = content
    elif template == "empty":
        script_content = "extends " + base_class + "\n"
    else:
        script_content = "extends " + base_class + "\n\n\nfunc _ready() -> void:\n\tpass\n\n\nfunc _process(delta: float) -> void:\n\tpass\n"

    # Ensure directory exists
    var script_dir = script_path.get_base_dir()
    if script_dir != "res://" and script_dir != "":
        var dir_rel = script_dir
        if dir_rel.begins_with("res://"):
            dir_rel = dir_rel.substr(6)
        if dir_rel != "" and not DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(script_dir)):
            var dir = DirAccess.open("res://")
            if dir:
                dir.make_dir_recursive(dir_rel)

    # Write script file
    var f = FileAccess.open(script_path, FileAccess.WRITE)
    if not f:
        log_error("Failed to create script file: " + script_path)
        quit(1)
    f.store_string(script_content)
    f.close()
    log_info("Script file created: " + script_path)

    # Now attach to node
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    var node = find_node_by_path(scene_root, params.node_path)
    if not node:
        quit(1)

    var scr = load(script_path)
    if not scr:
        log_error("Failed to load created script: " + script_path)
        quit(1)
    node.set_script(scr)

    if save_scene_to_disk(scene_root, full_path):
        log_info("Script created and attached: " + script_path + " -> " + params.node_path)
    else:
        quit(1)

# Batch scene operations — multiple ops in one Godot invocation
func batch_scene_operations(params):
    log_info("Batch operations on scene: " + params.scene_path)
    var loaded = load_scene_for_edit(params.scene_path)
    if loaded.is_empty():
        quit(1)
    var full_path = loaded[0]
    var scene_root = loaded[2]

    if not params.has("operations") or not params.operations is Array:
        log_error("operations array is required")
        quit(1)

    var op_count = 0
    for op in params.operations:
        var op_name = op.get("operation", "")
        var op_params = op.get("params", {})
        log_debug("Batch op: " + op_name)
        match op_name:
            "add_node":
                _batch_add_node(scene_root, op_params)
            "modify_node":
                _batch_modify_node(scene_root, op_params)
            "delete_node":
                _batch_delete_node(scene_root, op_params)
            "reparent_node":
                _batch_reparent_node(scene_root, op_params)
            "add_collision_shape":
                _batch_add_collision_shape(scene_root, op_params)
            "set_tiles":
                _batch_set_tiles(scene_root, op_params)
            _:
                log_error("Unknown batch operation: " + op_name)
                continue
        op_count += 1

    if save_scene_to_disk(scene_root, full_path):
        log_info("Batch complete: " + str(op_count) + " operations applied")
    else:
        quit(1)

func _batch_add_node(scene_root: Node, params: Dictionary):
    var parent_path = params.get("parent_node_path", "root")
    var parent = find_node_by_path(scene_root, parent_path)
    if not parent:
        log_error("Batch add_node: parent not found: " + parent_path)
        return

    var new_node = instantiate_class(params.get("node_type", "Node"))
    if not new_node:
        log_error("Batch add_node: failed to instantiate: " + params.get("node_type", "Node"))
        return
    new_node.name = params.get("node_name", "NewNode")

    if params.has("properties"):
        for property in params.properties:
            new_node.set(property, convert_typed_value(params.properties[property]))

    parent.add_child(new_node)
    set_owner_recursive(new_node, scene_root)

func _batch_modify_node(scene_root: Node, params: Dictionary):
    var node = find_node_by_path(scene_root, params.get("node_path", "root"))
    if not node:
        return
    if params.has("properties"):
        for property in params.properties:
            node.set(property, convert_typed_value(params.properties[property]))

func _batch_delete_node(scene_root: Node, params: Dictionary):
    var node = find_node_by_path(scene_root, params.get("node_path", ""))
    if not node or node == scene_root:
        return
    node.get_parent().remove_child(node)
    node.queue_free()

func _batch_reparent_node(scene_root: Node, params: Dictionary):
    var node = find_node_by_path(scene_root, params.get("node_path", ""))
    if not node or node == scene_root:
        return
    var new_parent = find_node_by_path(scene_root, params.get("new_parent_path", "root"))
    if not new_parent:
        return
    node.get_parent().remove_child(node)
    new_parent.add_child(node)
    set_owner_recursive(node, scene_root)

func _batch_add_collision_shape(scene_root: Node, params: Dictionary):
    var parent_path = params.get("parent_node_path", "root")
    var parent = find_node_by_path(scene_root, parent_path)
    if not parent:
        return
    var collision = CollisionShape2D.new()
    collision.name = params.get("node_name", "CollisionShape2D")
    if params.has("shape"):
        var shape = convert_typed_value(params.shape)
        if shape is Shape2D:
            collision.shape = shape
    if params.has("properties"):
        for property in params.properties:
            collision.set(property, convert_typed_value(params.properties[property]))
    parent.add_child(collision)
    collision.owner = scene_root

func _batch_set_tiles(scene_root: Node, params: Dictionary):
    var node = find_node_by_path(scene_root, params.get("node_path", ""))
    if not node or not node is TileMapLayer:
        log_error("Batch set_tiles: node not found or not TileMapLayer")
        return
    var tilemap := node as TileMapLayer
    if params.has("tiles") and params.tiles is Array:
        for tile in params.tiles:
            var coords = Vector2i(int(tile.get("x", 0)), int(tile.get("y", 0)))
            var source_id = int(tile.get("source_id", 0))
            var atlas_coords = Vector2i(int(tile.get("atlas_x", 0)), int(tile.get("atlas_y", 0)))
            tilemap.set_cell(coords, source_id, atlas_coords)

# Get a script by name or path
func get_script_by_name(name_of_class):
    if debug_mode:
        print("Attempting to get script for class: " + name_of_class)
    
    # Try to load it directly if it's a resource path
    if ResourceLoader.exists(name_of_class, "Script"):
        if debug_mode:
            print("Resource exists, loading directly: " + name_of_class)
        var script = load(name_of_class) as Script
        if script:
            if debug_mode:
                print("Successfully loaded script from path")
            return script
        else:
            printerr("Failed to load script from path: " + name_of_class)
    elif debug_mode:
        print("Resource not found, checking global class registry")
    
    # Search for it in the global class registry if it's a class name
    var global_classes = ProjectSettings.get_global_class_list()
    if debug_mode:
        print("Searching through " + str(global_classes.size()) + " global classes")
    
    for global_class in global_classes:
        var found_name_of_class = global_class["class"]
        var found_path = global_class["path"]
        
        if found_name_of_class == name_of_class:
            if debug_mode:
                print("Found matching class in registry: " + found_name_of_class + " at path: " + found_path)
            var script = load(found_path) as Script
            if script:
                if debug_mode:
                    print("Successfully loaded script from registry")
                return script
            else:
                printerr("Failed to load script from registry path: " + found_path)
                break
    
    printerr("Could not find script for class: " + name_of_class)
    return null

# Instantiate a class by name
func instantiate_class(name_of_class):
    if name_of_class.is_empty():
        printerr("Cannot instantiate class: name is empty")
        return null
    
    var result = null
    if debug_mode:
        print("Attempting to instantiate class: " + name_of_class)
    
    # Check if it's a built-in class
    if ClassDB.class_exists(name_of_class):
        if debug_mode:
            print("Class exists in ClassDB, using ClassDB.instantiate()")
        if ClassDB.can_instantiate(name_of_class):
            result = ClassDB.instantiate(name_of_class)
            if result == null:
                printerr("ClassDB.instantiate() returned null for class: " + name_of_class)
        else:
            printerr("Class exists but cannot be instantiated: " + name_of_class)
            printerr("This may be an abstract class or interface that cannot be directly instantiated")
    else:
        # Try to get the script
        if debug_mode:
            print("Class not found in ClassDB, trying to get script")
        var script = get_script_by_name(name_of_class)
        if script is GDScript:
            if debug_mode:
                print("Found GDScript, creating instance")
            result = script.new()
        else:
            printerr("Failed to get script for class: " + name_of_class)
            return null
    
    if result == null:
        printerr("Failed to instantiate class: " + name_of_class)
    elif debug_mode:
        print("Successfully instantiated class: " + name_of_class + " of type: " + result.get_class())
    
    return result

# Create a new scene with a specified root node type
func create_scene(params):
    print("Creating scene: " + params.scene_path)
    
    # Get project paths and log them for debugging
    var project_res_path = "res://"
    var project_user_path = "user://"
    var global_res_path = ProjectSettings.globalize_path(project_res_path)
    var global_user_path = ProjectSettings.globalize_path(project_user_path)
    
    if debug_mode:
        print("Project paths:")
        print("- res:// path: " + project_res_path)
        print("- user:// path: " + project_user_path)
        print("- Globalized res:// path: " + global_res_path)
        print("- Globalized user:// path: " + global_user_path)
        
        # Print some common environment variables for debugging
        print("Environment variables:")
        var env_vars = ["PATH", "HOME", "USER", "TEMP", "GODOT_PATH"]
        for env_var in env_vars:
            if OS.has_environment(env_var):
                print("  " + env_var + " = " + OS.get_environment(env_var))
    
    # Normalize the scene path
    var full_scene_path = params.scene_path
    if not full_scene_path.begins_with("res://"):
        full_scene_path = "res://" + full_scene_path
    if debug_mode:
        print("Scene path (with res://): " + full_scene_path)
    
    # Convert resource path to an absolute path
    var absolute_scene_path = ProjectSettings.globalize_path(full_scene_path)
    if debug_mode:
        print("Absolute scene path: " + absolute_scene_path)
    
    # Get the scene directory paths
    var scene_dir_res = full_scene_path.get_base_dir()
    var scene_dir_abs = absolute_scene_path.get_base_dir()
    if debug_mode:
        print("Scene directory (resource path): " + scene_dir_res)
        print("Scene directory (absolute path): " + scene_dir_abs)
    
    # Only do extensive testing in debug mode
    if debug_mode:
        # Try to create a simple test file in the project root to verify write access
        var initial_test_file_path = "res://godot_mcp_test_write.tmp"
        var initial_test_file = FileAccess.open(initial_test_file_path, FileAccess.WRITE)
        if initial_test_file:
            initial_test_file.store_string("Test write access")
            initial_test_file.close()
            print("Successfully wrote test file to project root: " + initial_test_file_path)
            
            # Verify the test file exists
            var initial_test_file_exists = FileAccess.file_exists(initial_test_file_path)
            print("Test file exists check: " + str(initial_test_file_exists))
            
            # Clean up the test file
            if initial_test_file_exists:
                var remove_error = DirAccess.remove_absolute(ProjectSettings.globalize_path(initial_test_file_path))
                print("Test file removal result: " + str(remove_error))
        else:
            var write_error = FileAccess.get_open_error()
            printerr("Failed to write test file to project root: " + str(write_error))
            printerr("This indicates a serious permission issue with the project directory")
    
    # Use traditional if-else statement for better compatibility
    var root_node_type = "Node2D"  # Default value
    if params.has("root_node_type"):
        root_node_type = params.root_node_type
    if debug_mode:
        print("Root node type: " + root_node_type)
    
    # Create the root node
    var scene_root = instantiate_class(root_node_type)
    if not scene_root:
        printerr("Failed to instantiate node of type: " + root_node_type)
        printerr("Make sure the class exists and can be instantiated")
        printerr("Check if the class is registered in ClassDB or available as a script")
        quit(1)
    
    scene_root.name = "root"
    if debug_mode:
        print("Root node created with name: " + scene_root.name)
    
    # Set the owner of the root node to itself (important for scene saving)
    scene_root.owner = scene_root
    
    # Pack the scene
    var packed_scene = PackedScene.new()
    var result = packed_scene.pack(scene_root)
    if debug_mode:
        print("Pack result: " + str(result) + " (OK=" + str(OK) + ")")
    
    if result == OK:
        # Only do extensive testing in debug mode
        if debug_mode:
            # First, let's verify we can write to the project directory
            print("Testing write access to project directory...")
            var test_write_path = "res://test_write_access.tmp"
            var test_write_abs = ProjectSettings.globalize_path(test_write_path)
            var test_file = FileAccess.open(test_write_path, FileAccess.WRITE)
            
            if test_file:
                test_file.store_string("Write test")
                test_file.close()
                print("Successfully wrote test file to project directory")
                
                # Clean up test file
                if FileAccess.file_exists(test_write_path):
                    var remove_error = DirAccess.remove_absolute(test_write_abs)
                    print("Test file removal result: " + str(remove_error))
            else:
                var write_error = FileAccess.get_open_error()
                printerr("Failed to write test file to project directory: " + str(write_error))
                printerr("This may indicate permission issues with the project directory")
                # Continue anyway, as the scene directory might still be writable
        
        # Ensure the scene directory exists using DirAccess
        if debug_mode:
            print("Ensuring scene directory exists...")
        
        # Get the scene directory relative to res://
        var scene_dir_relative = scene_dir_res.substr(6)  # Remove "res://" prefix
        if debug_mode:
            print("Scene directory (relative to res://): " + scene_dir_relative)
        
        # Create the directory if needed
        if not scene_dir_relative.is_empty():
            # First check if it exists
            var dir_exists = DirAccess.dir_exists_absolute(scene_dir_abs)
            if debug_mode:
                print("Directory exists check (absolute): " + str(dir_exists))
            
            if not dir_exists:
                if debug_mode:
                    print("Directory doesn't exist, creating: " + scene_dir_relative)
                
                # Try to create the directory using DirAccess
                var dir = DirAccess.open("res://")
                if dir == null:
                    var open_error = DirAccess.get_open_error()
                    printerr("Failed to open res:// directory: " + str(open_error))
                    
                    # Try alternative approach with absolute path
                    if debug_mode:
                        print("Trying alternative directory creation approach...")
                    var make_dir_error = DirAccess.make_dir_recursive_absolute(scene_dir_abs)
                    if debug_mode:
                        print("Make directory result (absolute): " + str(make_dir_error))
                    
                    if make_dir_error != OK:
                        printerr("Failed to create directory using absolute path")
                        printerr("Error code: " + str(make_dir_error))
                        quit(1)
                else:
                    # Create the directory using the DirAccess instance
                    if debug_mode:
                        print("Creating directory using DirAccess: " + scene_dir_relative)
                    var make_dir_error = dir.make_dir_recursive(scene_dir_relative)
                    if debug_mode:
                        print("Make directory result: " + str(make_dir_error))
                    
                    if make_dir_error != OK:
                        printerr("Failed to create directory: " + scene_dir_relative)
                        printerr("Error code: " + str(make_dir_error))
                        quit(1)
                
                # Verify the directory was created
                dir_exists = DirAccess.dir_exists_absolute(scene_dir_abs)
                if debug_mode:
                    print("Directory exists check after creation: " + str(dir_exists))
                
                if not dir_exists:
                    printerr("Directory reported as created but does not exist: " + scene_dir_abs)
                    printerr("This may indicate a problem with path resolution or permissions")
                    quit(1)
            elif debug_mode:
                print("Directory already exists: " + scene_dir_abs)
        
        # Save the scene
        if debug_mode:
            print("Saving scene to: " + full_scene_path)
        var save_error = ResourceSaver.save(packed_scene, full_scene_path)
        if debug_mode:
            print("Save result: " + str(save_error) + " (OK=" + str(OK) + ")")
        
        if save_error == OK:
            # Only do extensive testing in debug mode
            if debug_mode:
                # Wait a moment to ensure file system has time to complete the write
                print("Waiting for file system to complete write operation...")
                OS.delay_msec(500)  # 500ms delay
                
                # Verify the file was actually created using multiple methods
                var file_check_abs = FileAccess.file_exists(absolute_scene_path)
                print("File exists check (absolute path): " + str(file_check_abs))
                
                var file_check_res = FileAccess.file_exists(full_scene_path)
                print("File exists check (resource path): " + str(file_check_res))
                
                var res_exists = ResourceLoader.exists(full_scene_path)
                print("Resource exists check: " + str(res_exists))
                
                # If file doesn't exist by absolute path, try to create a test file in the same directory
                if not file_check_abs and not file_check_res:
                    printerr("Scene file not found after save. Trying to diagnose the issue...")
                    
                    # Try to write a test file to the same directory
                    var test_scene_file_path = scene_dir_res + "/test_scene_file.tmp"
                    var test_scene_file = FileAccess.open(test_scene_file_path, FileAccess.WRITE)
                    
                    if test_scene_file:
                        test_scene_file.store_string("Test scene directory write")
                        test_scene_file.close()
                        print("Successfully wrote test file to scene directory: " + test_scene_file_path)
                        
                        # Check if the test file exists
                        var test_file_exists = FileAccess.file_exists(test_scene_file_path)
                        print("Test file exists: " + str(test_file_exists))
                        
                        if test_file_exists:
                            # Directory is writable, so the issue is with scene saving
                            printerr("Directory is writable but scene file wasn't created.")
                            printerr("This suggests an issue with ResourceSaver.save() or the packed scene.")
                            
                            # Try saving with a different approach
                            print("Trying alternative save approach...")
                            var alt_save_error = ResourceSaver.save(packed_scene, test_scene_file_path + ".tscn")
                            print("Alternative save result: " + str(alt_save_error))
                            
                            # Clean up test files
                            DirAccess.remove_absolute(ProjectSettings.globalize_path(test_scene_file_path))
                            if alt_save_error == OK:
                                DirAccess.remove_absolute(ProjectSettings.globalize_path(test_scene_file_path + ".tscn"))
                        else:
                            printerr("Test file couldn't be verified. This suggests filesystem access issues.")
                    else:
                        var write_error = FileAccess.get_open_error()
                        printerr("Failed to write test file to scene directory: " + str(write_error))
                        printerr("This confirms there are permission or path issues with the scene directory.")
                    
                    # Return error since we couldn't create the scene file
                    printerr("Failed to create scene: " + params.scene_path)
                    quit(1)
                
                # If we get here, at least one of our file checks passed
                if file_check_abs or file_check_res or res_exists:
                    print("Scene file verified to exist!")
                    
                    # Try to load the scene to verify it's valid
                    var test_load = ResourceLoader.load(full_scene_path)
                    if test_load:
                        print("Scene created and verified successfully at: " + params.scene_path)
                        print("Scene file can be loaded correctly.")
                    else:
                        print("Scene file exists but cannot be loaded. It may be corrupted or incomplete.")
                        # Continue anyway since the file exists
                    
                    print("Scene created successfully at: " + params.scene_path)
                else:
                    printerr("All file existence checks failed despite successful save operation.")
                    printerr("This indicates a serious issue with file system access or path resolution.")
                    quit(1)
            else:
                # In non-debug mode, just check if the file exists
                var file_exists = FileAccess.file_exists(full_scene_path)
                if file_exists:
                    print("Scene created successfully at: " + params.scene_path)
                else:
                    printerr("Failed to create scene: " + params.scene_path)
                    quit(1)
        else:
            # Handle specific error codes
            var error_message = "Failed to save scene. Error code: " + str(save_error)
            
            if save_error == ERR_CANT_CREATE:
                error_message += " (ERR_CANT_CREATE - Cannot create the scene file)"
            elif save_error == ERR_CANT_OPEN:
                error_message += " (ERR_CANT_OPEN - Cannot open the scene file for writing)"
            elif save_error == ERR_FILE_CANT_WRITE:
                error_message += " (ERR_FILE_CANT_WRITE - Cannot write to the scene file)"
            elif save_error == ERR_FILE_NO_PERMISSION:
                error_message += " (ERR_FILE_NO_PERMISSION - No permission to write the scene file)"
            
            printerr(error_message)
            quit(1)
    else:
        printerr("Failed to pack scene: " + str(result))
        printerr("Error code: " + str(result))
        quit(1)

# Add a node to an existing scene
func add_node(params):
    print("Adding node to scene: " + params.scene_path)
    
    var full_scene_path = params.scene_path
    if not full_scene_path.begins_with("res://"):
        full_scene_path = "res://" + full_scene_path
    if debug_mode:
        print("Scene path (with res://): " + full_scene_path)
    
    var absolute_scene_path = ProjectSettings.globalize_path(full_scene_path)
    if debug_mode:
        print("Absolute scene path: " + absolute_scene_path)
    
    if not FileAccess.file_exists(absolute_scene_path):
        printerr("Scene file does not exist at: " + absolute_scene_path)
        quit(1)
    
    var scene = load(full_scene_path)
    if not scene:
        printerr("Failed to load scene: " + full_scene_path)
        quit(1)
    
    if debug_mode:
        print("Scene loaded successfully")
    var scene_root = scene.instantiate()
    if debug_mode:
        print("Scene instantiated")
    
    # Use traditional if-else statement for better compatibility
    var parent_path = "root"  # Default value
    if params.has("parent_node_path"):
        parent_path = params.parent_node_path
    if debug_mode:
        print("Parent path: " + parent_path)
    
    var parent = scene_root
    if parent_path != "root":
        parent = scene_root.get_node(parent_path.replace("root/", ""))
        if not parent:
            printerr("Parent node not found: " + parent_path)
            quit(1)
    if debug_mode:
        print("Parent node found: " + parent.name)
    
    if debug_mode:
        print("Instantiating node of type: " + params.node_type)
    var new_node = instantiate_class(params.node_type)
    if not new_node:
        printerr("Failed to instantiate node of type: " + params.node_type)
        printerr("Make sure the class exists and can be instantiated")
        printerr("Check if the class is registered in ClassDB or available as a script")
        quit(1)
    new_node.name = params.node_name
    if debug_mode:
        print("New node created with name: " + new_node.name)
    
    if params.has("properties"):
        if debug_mode:
            print("Setting properties on node")
        var properties = params.properties
        for property in properties:
            var converted = convert_typed_value(properties[property])
            if debug_mode:
                print("Setting property: " + property + " = " + str(converted))
            new_node.set(property, converted)
    
    parent.add_child(new_node)
    new_node.owner = scene_root
    if debug_mode:
        print("Node added to parent and ownership set")
    
    var packed_scene = PackedScene.new()
    var result = packed_scene.pack(scene_root)
    if debug_mode:
        print("Pack result: " + str(result) + " (OK=" + str(OK) + ")")
    
    if result == OK:
        if debug_mode:
            print("Saving scene to: " + absolute_scene_path)
        var save_error = ResourceSaver.save(packed_scene, absolute_scene_path)
        if debug_mode:
            print("Save result: " + str(save_error) + " (OK=" + str(OK) + ")")
        if save_error == OK:
            if debug_mode:
                var file_check_after = FileAccess.file_exists(absolute_scene_path)
                print("File exists check after save: " + str(file_check_after))
                if file_check_after:
                    print("Node '" + params.node_name + "' of type '" + params.node_type + "' added successfully")
                else:
                    printerr("File reported as saved but does not exist at: " + absolute_scene_path)
            else:
                print("Node '" + params.node_name + "' of type '" + params.node_type + "' added successfully")
        else:
            printerr("Failed to save scene: " + str(save_error))
    else:
        printerr("Failed to pack scene: " + str(result))

# Load a sprite into a Sprite2D node
func load_sprite(params):
    print("Loading sprite into scene: " + params.scene_path)
    
    # Ensure the scene path starts with res:// for Godot's resource system
    var full_scene_path = params.scene_path
    if not full_scene_path.begins_with("res://"):
        full_scene_path = "res://" + full_scene_path
    
    if debug_mode:
        print("Full scene path (with res://): " + full_scene_path)
    
    # Check if the scene file exists
    var file_check = FileAccess.file_exists(full_scene_path)
    if debug_mode:
        print("Scene file exists check: " + str(file_check))
    
    if not file_check:
        printerr("Scene file does not exist at: " + full_scene_path)
        # Get the absolute path for reference
        var absolute_path = ProjectSettings.globalize_path(full_scene_path)
        printerr("Absolute file path that doesn't exist: " + absolute_path)
        quit(1)
    
    # Ensure the texture path starts with res:// for Godot's resource system
    var full_texture_path = params.texture_path
    if not full_texture_path.begins_with("res://"):
        full_texture_path = "res://" + full_texture_path
    
    if debug_mode:
        print("Full texture path (with res://): " + full_texture_path)
    
    # Load the scene
    var scene = load(full_scene_path)
    if not scene:
        printerr("Failed to load scene: " + full_scene_path)
        quit(1)
    
    if debug_mode:
        print("Scene loaded successfully")
    
    # Instance the scene
    var scene_root = scene.instantiate()
    if debug_mode:
        print("Scene instantiated")
    
    # Find the sprite node
    var node_path = params.node_path
    if debug_mode:
        print("Original node path: " + node_path)
    
    if node_path.begins_with("root/"):
        node_path = node_path.substr(5)  # Remove "root/" prefix
        if debug_mode:
            print("Node path after removing 'root/' prefix: " + node_path)
    
    var sprite_node = null
    if node_path == "":
        # If no node path, assume root is the sprite
        sprite_node = scene_root
        if debug_mode:
            print("Using root node as sprite node")
    else:
        sprite_node = scene_root.get_node(node_path)
        if sprite_node and debug_mode:
            print("Found sprite node: " + sprite_node.name)
    
    if not sprite_node:
        printerr("Node not found: " + params.node_path)
        quit(1)
    
    # Check if the node is a Sprite2D or compatible type
    if debug_mode:
        print("Node class: " + sprite_node.get_class())
    if not (sprite_node is Sprite2D or sprite_node is Sprite3D or sprite_node is TextureRect):
        printerr("Node is not a sprite-compatible type: " + sprite_node.get_class())
        quit(1)
    
    # Load the texture
    if debug_mode:
        print("Loading texture from: " + full_texture_path)
    var texture = load(full_texture_path)
    if not texture:
        printerr("Failed to load texture: " + full_texture_path)
        quit(1)
    
    if debug_mode:
        print("Texture loaded successfully")
    
    # Set the texture on the sprite
    if sprite_node is Sprite2D or sprite_node is Sprite3D:
        sprite_node.texture = texture
        if debug_mode:
            print("Set texture on Sprite2D/Sprite3D node")
    elif sprite_node is TextureRect:
        sprite_node.texture = texture
        if debug_mode:
            print("Set texture on TextureRect node")
    
    # Save the modified scene
    var packed_scene = PackedScene.new()
    var result = packed_scene.pack(scene_root)
    if debug_mode:
        print("Pack result: " + str(result) + " (OK=" + str(OK) + ")")
    
    if result == OK:
        if debug_mode:
            print("Saving scene to: " + full_scene_path)
        var error = ResourceSaver.save(packed_scene, full_scene_path)
        if debug_mode:
            print("Save result: " + str(error) + " (OK=" + str(OK) + ")")
        
        if error == OK:
            # Verify the file was actually updated
            if debug_mode:
                var file_check_after = FileAccess.file_exists(full_scene_path)
                print("File exists check after save: " + str(file_check_after))
                
                if file_check_after:
                    print("Sprite loaded successfully with texture: " + full_texture_path)
                    # Get the absolute path for reference
                    var absolute_path = ProjectSettings.globalize_path(full_scene_path)
                    print("Absolute file path: " + absolute_path)
                else:
                    printerr("File reported as saved but does not exist at: " + full_scene_path)
            else:
                print("Sprite loaded successfully with texture: " + full_texture_path)
        else:
            printerr("Failed to save scene: " + str(error))
    else:
        printerr("Failed to pack scene: " + str(result))

# Export a scene as a MeshLibrary resource
func export_mesh_library(params):
    print("Exporting MeshLibrary from scene: " + params.scene_path)
    
    # Ensure the scene path starts with res:// for Godot's resource system
    var full_scene_path = params.scene_path
    if not full_scene_path.begins_with("res://"):
        full_scene_path = "res://" + full_scene_path
    
    if debug_mode:
        print("Full scene path (with res://): " + full_scene_path)
    
    # Ensure the output path starts with res:// for Godot's resource system
    var full_output_path = params.output_path
    if not full_output_path.begins_with("res://"):
        full_output_path = "res://" + full_output_path
    
    if debug_mode:
        print("Full output path (with res://): " + full_output_path)
    
    # Check if the scene file exists
    var file_check = FileAccess.file_exists(full_scene_path)
    if debug_mode:
        print("Scene file exists check: " + str(file_check))
    
    if not file_check:
        printerr("Scene file does not exist at: " + full_scene_path)
        # Get the absolute path for reference
        var absolute_path = ProjectSettings.globalize_path(full_scene_path)
        printerr("Absolute file path that doesn't exist: " + absolute_path)
        quit(1)
    
    # Load the scene
    if debug_mode:
        print("Loading scene from: " + full_scene_path)
    var scene = load(full_scene_path)
    if not scene:
        printerr("Failed to load scene: " + full_scene_path)
        quit(1)
    
    if debug_mode:
        print("Scene loaded successfully")
    
    # Instance the scene
    var scene_root = scene.instantiate()
    if debug_mode:
        print("Scene instantiated")
    
    # Create a new MeshLibrary
    var mesh_library = MeshLibrary.new()
    if debug_mode:
        print("Created new MeshLibrary")
    
    # Get mesh item names if provided
    var mesh_item_names = params.mesh_item_names if params.has("mesh_item_names") else []
    var use_specific_items = mesh_item_names.size() > 0
    
    if debug_mode:
        if use_specific_items:
            print("Using specific mesh items: " + str(mesh_item_names))
        else:
            print("Using all mesh items in the scene")
    
    # Process all child nodes
    var item_id = 0
    if debug_mode:
        print("Processing child nodes...")
    
    for child in scene_root.get_children():
        if debug_mode:
            print("Checking child node: " + child.name)
        
        # Skip if not using all items and this item is not in the list
        if use_specific_items and not (child.name in mesh_item_names):
            if debug_mode:
                print("Skipping node " + child.name + " (not in specified items list)")
            continue
            
        # Check if the child has a mesh
        var mesh_instance = null
        if child is MeshInstance3D:
            mesh_instance = child
            if debug_mode:
                print("Node " + child.name + " is a MeshInstance3D")
        else:
            # Try to find a MeshInstance3D in the child's descendants
            if debug_mode:
                print("Searching for MeshInstance3D in descendants of " + child.name)
            for descendant in child.get_children():
                if descendant is MeshInstance3D:
                    mesh_instance = descendant
                    if debug_mode:
                        print("Found MeshInstance3D in descendant: " + descendant.name)
                    break
        
        if mesh_instance and mesh_instance.mesh:
            if debug_mode:
                print("Adding mesh: " + child.name)
            
            # Add the mesh to the library
            mesh_library.create_item(item_id)
            mesh_library.set_item_name(item_id, child.name)
            mesh_library.set_item_mesh(item_id, mesh_instance.mesh)
            if debug_mode:
                print("Added mesh to library with ID: " + str(item_id))
            
            # Add collision shape if available
            var collision_added = false
            for collision_child in child.get_children():
                if collision_child is CollisionShape3D and collision_child.shape:
                    mesh_library.set_item_shapes(item_id, [collision_child.shape])
                    if debug_mode:
                        print("Added collision shape from: " + collision_child.name)
                    collision_added = true
                    break
            
            if debug_mode and not collision_added:
                print("No collision shape found for mesh: " + child.name)
            
            # Add preview if available
            if mesh_instance.mesh:
                mesh_library.set_item_preview(item_id, mesh_instance.mesh)
                if debug_mode:
                    print("Added preview for mesh: " + child.name)
            
            item_id += 1
        elif debug_mode:
            print("Node " + child.name + " has no valid mesh")
    
    if debug_mode:
        print("Processed " + str(item_id) + " meshes")
    
    # Create directory if it doesn't exist
    var dir = DirAccess.open("res://")
    if dir == null:
        printerr("Failed to open res:// directory")
        printerr("DirAccess error: " + str(DirAccess.get_open_error()))
        quit(1)
        
    var output_dir = full_output_path.get_base_dir()
    if debug_mode:
        print("Output directory: " + output_dir)
    
    if output_dir != "res://" and not dir.dir_exists(output_dir.substr(6)):  # Remove "res://" prefix
        if debug_mode:
            print("Creating directory: " + output_dir)
        var error = dir.make_dir_recursive(output_dir.substr(6))  # Remove "res://" prefix
        if error != OK:
            printerr("Failed to create directory: " + output_dir + ", error: " + str(error))
            quit(1)
    
    # Save the mesh library
    if item_id > 0:
        if debug_mode:
            print("Saving MeshLibrary to: " + full_output_path)
        var error = ResourceSaver.save(mesh_library, full_output_path)
        if debug_mode:
            print("Save result: " + str(error) + " (OK=" + str(OK) + ")")
        
        if error == OK:
            # Verify the file was actually created
            if debug_mode:
                var file_check_after = FileAccess.file_exists(full_output_path)
                print("File exists check after save: " + str(file_check_after))
                
                if file_check_after:
                    print("MeshLibrary exported successfully with " + str(item_id) + " items to: " + full_output_path)
                    # Get the absolute path for reference
                    var absolute_path = ProjectSettings.globalize_path(full_output_path)
                    print("Absolute file path: " + absolute_path)
                else:
                    printerr("File reported as saved but does not exist at: " + full_output_path)
            else:
                print("MeshLibrary exported successfully with " + str(item_id) + " items to: " + full_output_path)
        else:
            printerr("Failed to save MeshLibrary: " + str(error))
    else:
        printerr("No valid meshes found in the scene")

# Find files with a specific extension recursively
func find_files(path, extension):
    var files = []
    var dir = DirAccess.open(path)
    
    if dir:
        dir.list_dir_begin()
        var file_name = dir.get_next()
        
        while file_name != "":
            if dir.current_is_dir() and not file_name.begins_with("."):
                files.append_array(find_files(path + file_name + "/", extension))
            elif file_name.ends_with(extension):
                files.append(path + file_name)
            
            file_name = dir.get_next()
    
    return files

# Get UID for a specific file
func get_uid(params):
    if not params.has("file_path"):
        printerr("File path is required")
        quit(1)
    
    # Ensure the file path starts with res:// for Godot's resource system
    var file_path = params.file_path
    if not file_path.begins_with("res://"):
        file_path = "res://" + file_path
    
    print("Getting UID for file: " + file_path)
    if debug_mode:
        print("Full file path (with res://): " + file_path)
    
    # Get the absolute path for reference
    var absolute_path = ProjectSettings.globalize_path(file_path)
    if debug_mode:
        print("Absolute file path: " + absolute_path)
    
    # Ensure the file exists
    var file_check = FileAccess.file_exists(file_path)
    if debug_mode:
        print("File exists check: " + str(file_check))
    
    if not file_check:
        printerr("File does not exist at: " + file_path)
        printerr("Absolute file path that doesn't exist: " + absolute_path)
        quit(1)
    
    # Check if the UID file exists
    var uid_path = file_path + ".uid"
    if debug_mode:
        print("UID file path: " + uid_path)
    
    var uid_check = FileAccess.file_exists(uid_path)
    if debug_mode:
        print("UID file exists check: " + str(uid_check))
    
    var f = FileAccess.open(uid_path, FileAccess.READ)
    
    if f:
        # Read the UID content
        var uid_content = f.get_as_text()
        f.close()
        if debug_mode:
            print("UID content read successfully")
        
        # Return the UID content
        var result = {
            "file": file_path,
            "absolutePath": absolute_path,
            "uid": uid_content.strip_edges(),
            "exists": true
        }
        if debug_mode:
            print("UID result: " + JSON.stringify(result))
        print(JSON.stringify(result))
    else:
        if debug_mode:
            print("UID file does not exist or could not be opened")
        
        # UID file doesn't exist
        var result = {
            "file": file_path,
            "absolutePath": absolute_path,
            "exists": false,
            "message": "UID file does not exist for this file. Use resave_resources to generate UIDs."
        }
        if debug_mode:
            print("UID result: " + JSON.stringify(result))
        print(JSON.stringify(result))

# Resave all resources to update UID references
func resave_resources(params):
    print("Resaving all resources to update UID references...")
    
    # Get project path if provided
    var project_path = "res://"
    if params.has("project_path"):
        project_path = params.project_path
        if not project_path.begins_with("res://"):
            project_path = "res://" + project_path
        if not project_path.ends_with("/"):
            project_path += "/"
    
    if debug_mode:
        print("Using project path: " + project_path)
    
    # Get all .tscn files
    if debug_mode:
        print("Searching for scene files in: " + project_path)
    var scenes = find_files(project_path, ".tscn")
    if debug_mode:
        print("Found " + str(scenes.size()) + " scenes")
    
    # Resave each scene
    var success_count = 0
    var error_count = 0
    
    for scene_path in scenes:
        if debug_mode:
            print("Processing scene: " + scene_path)
        
        # Check if the scene file exists
        var file_check = FileAccess.file_exists(scene_path)
        if debug_mode:
            print("Scene file exists check: " + str(file_check))
        
        if not file_check:
            printerr("Scene file does not exist at: " + scene_path)
            error_count += 1
            continue
        
        # Load the scene
        var scene = load(scene_path)
        if scene:
            if debug_mode:
                print("Scene loaded successfully, saving...")
            var error = ResourceSaver.save(scene, scene_path)
            if debug_mode:
                print("Save result: " + str(error) + " (OK=" + str(OK) + ")")
            
            if error == OK:
                success_count += 1
                if debug_mode:
                    print("Scene saved successfully: " + scene_path)
                
                    # Verify the file was actually updated
                    var file_check_after = FileAccess.file_exists(scene_path)
                    print("File exists check after save: " + str(file_check_after))
                
                    if not file_check_after:
                        printerr("File reported as saved but does not exist at: " + scene_path)
            else:
                error_count += 1
                printerr("Failed to save: " + scene_path + ", error: " + str(error))
        else:
            error_count += 1
            printerr("Failed to load: " + scene_path)
    
    # Get all .gd and .shader files
    if debug_mode:
        print("Searching for script and shader files in: " + project_path)
    var scripts = find_files(project_path, ".gd") + find_files(project_path, ".shader") + find_files(project_path, ".gdshader")
    if debug_mode:
        print("Found " + str(scripts.size()) + " scripts/shaders")
    
    # Check for missing .uid files
    var missing_uids = 0
    var generated_uids = 0
    
    for script_path in scripts:
        if debug_mode:
            print("Checking UID for: " + script_path)
        var uid_path = script_path + ".uid"
        
        var uid_check = FileAccess.file_exists(uid_path)
        if debug_mode:
            print("UID file exists check: " + str(uid_check))
        
        var f = FileAccess.open(uid_path, FileAccess.READ)
        if not f:
            missing_uids += 1
            if debug_mode:
                print("Missing UID file for: " + script_path + ", generating...")
            
            # Force a save to generate UID
            var res = load(script_path)
            if res:
                var error = ResourceSaver.save(res, script_path)
                if debug_mode:
                    print("Save result: " + str(error) + " (OK=" + str(OK) + ")")
                
                if error == OK:
                    generated_uids += 1
                    if debug_mode:
                        print("Generated UID for: " + script_path)
                    
                        # Verify the UID file was actually created
                        var uid_check_after = FileAccess.file_exists(uid_path)
                        print("UID file exists check after save: " + str(uid_check_after))
                    
                        if not uid_check_after:
                            printerr("UID file reported as generated but does not exist at: " + uid_path)
                else:
                    printerr("Failed to generate UID for: " + script_path + ", error: " + str(error))
            else:
                printerr("Failed to load resource: " + script_path)
        elif debug_mode:
            print("UID file already exists for: " + script_path)
    
    if debug_mode:
        print("Summary:")
        print("- Scenes processed: " + str(scenes.size()))
        print("- Scenes successfully saved: " + str(success_count))
        print("- Scenes with errors: " + str(error_count))
        print("- Scripts/shaders missing UIDs: " + str(missing_uids))
        print("- UIDs successfully generated: " + str(generated_uids))
    print("Resave operation complete")

# Save changes to a scene file
func save_scene(params):
    print("Saving scene: " + params.scene_path)
    
    # Ensure the scene path starts with res:// for Godot's resource system
    var full_scene_path = params.scene_path
    if not full_scene_path.begins_with("res://"):
        full_scene_path = "res://" + full_scene_path
    
    if debug_mode:
        print("Full scene path (with res://): " + full_scene_path)
    
    # Check if the scene file exists
    var file_check = FileAccess.file_exists(full_scene_path)
    if debug_mode:
        print("Scene file exists check: " + str(file_check))
    
    if not file_check:
        printerr("Scene file does not exist at: " + full_scene_path)
        # Get the absolute path for reference
        var absolute_path = ProjectSettings.globalize_path(full_scene_path)
        printerr("Absolute file path that doesn't exist: " + absolute_path)
        quit(1)
    
    # Load the scene
    var scene = load(full_scene_path)
    if not scene:
        printerr("Failed to load scene: " + full_scene_path)
        quit(1)
    
    if debug_mode:
        print("Scene loaded successfully")
    
    # Instance the scene
    var scene_root = scene.instantiate()
    if debug_mode:
        print("Scene instantiated")
    
    # Determine save path
    var save_path = params.new_path if params.has("new_path") else full_scene_path
    if params.has("new_path") and not save_path.begins_with("res://"):
        save_path = "res://" + save_path
    
    if debug_mode:
        print("Save path: " + save_path)
    
    # Create directory if it doesn't exist
    if params.has("new_path"):
        var dir = DirAccess.open("res://")
        if dir == null:
            printerr("Failed to open res:// directory")
            printerr("DirAccess error: " + str(DirAccess.get_open_error()))
            quit(1)
            
        var scene_dir = save_path.get_base_dir()
        if debug_mode:
            print("Scene directory: " + scene_dir)
        
        if scene_dir != "res://" and not dir.dir_exists(scene_dir.substr(6)):  # Remove "res://" prefix
            if debug_mode:
                print("Creating directory: " + scene_dir)
            var error = dir.make_dir_recursive(scene_dir.substr(6))  # Remove "res://" prefix
            if error != OK:
                printerr("Failed to create directory: " + scene_dir + ", error: " + str(error))
                quit(1)
    
    # Create a packed scene
    var packed_scene = PackedScene.new()
    var result = packed_scene.pack(scene_root)
    if debug_mode:
        print("Pack result: " + str(result) + " (OK=" + str(OK) + ")")
    
    if result == OK:
        if debug_mode:
            print("Saving scene to: " + save_path)
        var error = ResourceSaver.save(packed_scene, save_path)
        if debug_mode:
            print("Save result: " + str(error) + " (OK=" + str(OK) + ")")
        
        if error == OK:
            # Verify the file was actually created/updated
            if debug_mode:
                var file_check_after = FileAccess.file_exists(save_path)
                print("File exists check after save: " + str(file_check_after))
                
                if file_check_after:
                    print("Scene saved successfully to: " + save_path)
                    # Get the absolute path for reference
                    var absolute_path = ProjectSettings.globalize_path(save_path)
                    print("Absolute file path: " + absolute_path)
                else:
                    printerr("File reported as saved but does not exist at: " + save_path)
            else:
                print("Scene saved successfully to: " + save_path)
        else:
            printerr("Failed to save scene: " + str(error))
    else:
        printerr("Failed to pack scene: " + str(result))
