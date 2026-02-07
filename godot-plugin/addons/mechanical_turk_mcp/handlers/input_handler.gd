@tool
extends Node
## Handles input event injection into the running game.

# Key name to keycode mapping for common keys
const KEY_MAP: Dictionary = {
	"a": KEY_A, "b": KEY_B, "c": KEY_C, "d": KEY_D, "e": KEY_E,
	"f": KEY_F, "g": KEY_G, "h": KEY_H, "i": KEY_I, "j": KEY_J,
	"k": KEY_K, "l": KEY_L, "m": KEY_M, "n": KEY_N, "o": KEY_O,
	"p": KEY_P, "q": KEY_Q, "r": KEY_R, "s": KEY_S, "t": KEY_T,
	"u": KEY_U, "v": KEY_V, "w": KEY_W, "x": KEY_X, "y": KEY_Y,
	"z": KEY_Z,
	"0": KEY_0, "1": KEY_1, "2": KEY_2, "3": KEY_3, "4": KEY_4,
	"5": KEY_5, "6": KEY_6, "7": KEY_7, "8": KEY_8, "9": KEY_9,
	"space": KEY_SPACE, "enter": KEY_ENTER, "return": KEY_ENTER,
	"escape": KEY_ESCAPE, "esc": KEY_ESCAPE,
	"tab": KEY_TAB, "backspace": KEY_BACKSPACE, "delete": KEY_DELETE,
	"up": KEY_UP, "down": KEY_DOWN, "left": KEY_LEFT, "right": KEY_RIGHT,
	"shift": KEY_SHIFT, "ctrl": KEY_CTRL, "control": KEY_CTRL,
	"alt": KEY_ALT, "meta": KEY_META, "super": KEY_META,
	"f1": KEY_F1, "f2": KEY_F2, "f3": KEY_F3, "f4": KEY_F4,
	"f5": KEY_F5, "f6": KEY_F6, "f7": KEY_F7, "f8": KEY_F8,
	"f9": KEY_F9, "f10": KEY_F10, "f11": KEY_F11, "f12": KEY_F12,
	"home": KEY_HOME, "end": KEY_END,
	"pageup": KEY_PAGEUP, "pagedown": KEY_PAGEDOWN,
	"insert": KEY_INSERT,
	"minus": KEY_MINUS, "equal": KEY_EQUAL,
	"comma": KEY_COMMA, "period": KEY_PERIOD,
	"slash": KEY_SLASH, "backslash": KEY_BACKSLASH,
	"semicolon": KEY_SEMICOLON, "apostrophe": KEY_APOSTROPHE,
	"bracketleft": KEY_BRACKETLEFT, "bracketright": KEY_BRACKETRIGHT,
}

const MOUSE_BUTTON_MAP: Dictionary = {
	"left": MOUSE_BUTTON_LEFT,
	"right": MOUSE_BUTTON_RIGHT,
	"middle": MOUSE_BUTTON_MIDDLE,
}


func handle_input_event(params) -> Dictionary:
	if not params is Dictionary:
		return {"status": "error", "message": "Invalid params"}

	var event_type: String = params.get("event_type", "")

	match event_type:
		"key":
			return _handle_key_event(params)
		"mouse_button":
			return _handle_mouse_button(params)
		"mouse_motion":
			return _handle_mouse_motion(params)
		_:
			return {"status": "error", "message": "Unknown event_type: %s" % event_type}


func handle_action(params) -> Dictionary:
	if not params is Dictionary:
		return {"status": "error", "message": "Invalid params"}

	var action_name: String = params.get("action", "")
	var pressed: bool = params.get("pressed", true)
	var strength: float = params.get("strength", 1.0)

	if action_name.is_empty():
		return {"status": "error", "message": "Action name is required"}

	if not InputMap.has_action(action_name):
		return {"status": "error", "message": "Action not found in Input Map: %s" % action_name}

	if pressed:
		Input.action_press(action_name, strength)
	else:
		Input.action_release(action_name)

	return {"status": "ok", "action": action_name, "pressed": pressed}


func _handle_key_event(params: Dictionary) -> Dictionary:
	var event := InputEventKey.new()

	# Resolve keycode from name or raw value
	var key_name: String = params.get("key", "").to_lower()
	var raw_keycode: int = params.get("keycode", 0)

	if not key_name.is_empty() and KEY_MAP.has(key_name):
		event.keycode = KEY_MAP[key_name]
	elif raw_keycode > 0:
		event.keycode = raw_keycode
	else:
		return {"status": "error", "message": "No valid key or keycode provided"}

	event.pressed = params.get("pressed", true)
	event.echo = false

	Input.parse_input_event(event)
	return {"status": "ok", "event_type": "key", "keycode": event.keycode, "pressed": event.pressed}


func _handle_mouse_button(params: Dictionary) -> Dictionary:
	var event := InputEventMouseButton.new()

	var button_name: String = params.get("button", "left").to_lower()
	if MOUSE_BUTTON_MAP.has(button_name):
		event.button_index = MOUSE_BUTTON_MAP[button_name]
	else:
		return {"status": "error", "message": "Unknown mouse button: %s" % button_name}

	event.pressed = params.get("pressed", true)

	var pos = params.get("position", null)
	if pos is Dictionary:
		event.position = Vector2(pos.get("x", 0.0), pos.get("y", 0.0))
		event.global_position = event.position

	Input.parse_input_event(event)
	return {"status": "ok", "event_type": "mouse_button", "button": button_name, "pressed": event.pressed}


func _handle_mouse_motion(params: Dictionary) -> Dictionary:
	var event := InputEventMouseMotion.new()

	var pos = params.get("position", null)
	if pos is Dictionary:
		event.position = Vector2(pos.get("x", 0.0), pos.get("y", 0.0))
		event.global_position = event.position

	var rel = params.get("relative", null)
	if rel is Dictionary:
		event.relative = Vector2(rel.get("x", 0.0), rel.get("y", 0.0))

	Input.parse_input_event(event)
	return {"status": "ok", "event_type": "mouse_motion"}
