/**
 * Godot typed value helpers for the level-2d tools.
 * Validates and auto-detects typed value objects (e.g., {_type: "Vector2", x: 100, y: 200}).
 */
const KNOWN_TYPES = new Set([
    'Vector2', 'Vector2i', 'Vector3', 'Vector3i',
    'Color', 'Rect2', 'NodePath', 'Resource',
    'RectangleShape2D', 'CircleShape2D', 'CapsuleShape2D',
    'WorldBoundaryShape2D', 'SegmentShape2D', 'ConvexPolygonShape2D',
]);
/** Check if a value is a typed Godot value object */
export function isTypedValue(value) {
    return (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof value._type === 'string' &&
        KNOWN_TYPES.has(value._type));
}
/** Check if a value looks like it should be a Vector2 (has x/y number keys, no _type) */
export function looksLikeVector2(value) {
    return (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof value.x === 'number' &&
        typeof value.y === 'number' &&
        !('z' in value) &&
        !('_type' in value));
}
/** Auto-wrap a plain {x, y} object as a typed Vector2 */
export function autoDetectVector2(value) {
    if (looksLikeVector2(value)) {
        return { _type: 'Vector2', x: value.x, y: value.y };
    }
    return value;
}
/** Shape type names that the GDScript convert_typed_value() supports */
export const SHAPE_2D_TYPES = [
    'RectangleShape2D',
    'CircleShape2D',
    'CapsuleShape2D',
    'WorldBoundaryShape2D',
    'SegmentShape2D',
    'ConvexPolygonShape2D',
];
export function isShape2DType(type) {
    return SHAPE_2D_TYPES.includes(type);
}
