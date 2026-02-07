/**
 * Path validation utilities
 */

export function validatePath(path: string): boolean {
  if (!path || path.includes('..')) {
    return false;
  }
  return true;
}
