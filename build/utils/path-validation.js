/**
 * Path validation utilities
 */
export function validatePath(path) {
    if (!path || path.includes('..')) {
        return false;
    }
    return true;
}
