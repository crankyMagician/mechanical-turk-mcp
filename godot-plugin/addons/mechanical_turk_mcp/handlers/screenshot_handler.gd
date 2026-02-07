@tool
extends Node
## Handles screenshot/viewport capture requests.

signal screenshot_ready(result: Dictionary)


func handle(params) -> Dictionary:
	# Screenshot capture needs a frame to render, so we defer it
	_capture_deferred(params)
	return {"_deferred": screenshot_ready}


func _capture_deferred(params) -> void:
	# Wait for the next frame to ensure the viewport is rendered
	await get_tree().process_frame

	var source: String = params.get("source", "game") if params is Dictionary else "game"
	var resize_width: int = params.get("width", 0) if params is Dictionary else 0
	var resize_height: int = params.get("height", 0) if params is Dictionary else 0

	var image: Image = null

	if source == "editor":
		# Capture the editor viewport
		image = _capture_editor_viewport()
	else:
		# Capture the game viewport
		image = _capture_game_viewport()

	if image == null:
		screenshot_ready.emit({
			"error": "Failed to capture viewport",
			"source": source
		})
		return

	# Resize if requested
	if resize_width > 0 and resize_height > 0:
		image.resize(resize_width, resize_height, Image.INTERPOLATE_LANCZOS)
	elif resize_width > 0:
		var aspect := float(image.get_height()) / float(image.get_width())
		image.resize(resize_width, int(resize_width * aspect), Image.INTERPOLATE_LANCZOS)
	elif resize_height > 0:
		var aspect := float(image.get_width()) / float(image.get_height())
		image.resize(int(resize_height * aspect), resize_height, Image.INTERPOLATE_LANCZOS)

	# Encode to PNG and base64
	var png_buffer := image.save_png_to_buffer()
	var base64_str := Marshalls.raw_to_base64(png_buffer)

	screenshot_ready.emit({
		"image_base64": base64_str,
		"width": image.get_width(),
		"height": image.get_height(),
		"source": source
	})


func _capture_game_viewport() -> Image:
	var tree := get_tree()
	if tree == null:
		return null
	var viewport := tree.root
	if viewport == null:
		return null
	var texture := viewport.get_texture()
	if texture == null:
		return null
	return texture.get_image()


func _capture_editor_viewport() -> Image:
	# In the editor, try to get the 3D viewport
	if Engine.is_editor_hint():
		var editor_interface := EditorInterface
		# Try 3D viewport first
		var viewport_3d := editor_interface.get_editor_viewport_3d(0)
		if viewport_3d:
			var texture := viewport_3d.get_texture()
			if texture:
				return texture.get_image()

		# Fall back to 2D viewport
		var viewport_2d := editor_interface.get_editor_viewport_2d()
		if viewport_2d:
			var texture := viewport_2d.get_texture()
			if texture:
				return texture.get_image()

	# Fallback: capture the main viewport
	return _capture_game_viewport()
