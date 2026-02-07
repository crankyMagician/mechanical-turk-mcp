/**
 * Parameter normalization between snake_case and camelCase
 */

export interface OperationParams {
  [key: string]: any;
}

const parameterMappings: Record<string, string> = {
  'project_path': 'projectPath',
  'scene_path': 'scenePath',
  'root_node_type': 'rootNodeType',
  'parent_node_path': 'parentNodePath',
  'node_type': 'nodeType',
  'node_name': 'nodeName',
  'texture_path': 'texturePath',
  'node_path': 'nodePath',
  'output_path': 'outputPath',
  'mesh_item_names': 'meshItemNames',
  'new_path': 'newPath',
  'file_path': 'filePath',
  'directory': 'directory',
  'recursive': 'recursive',
  'scene': 'scene',
  // New tool parameters
  'event_type': 'eventType',
  'key_code': 'keyCode',
  'root_path': 'rootPath',
  'include_properties': 'includeProperties',
  'test_script': 'testScript',
  'test_name': 'testName',
  'test_dir': 'testDir',
  'include_subdirs': 'includeSubdirs',
  'xml_output': 'xmlOutput',
};

const reverseParameterMappings: Record<string, string> = {};
for (const [snakeCase, camelCase] of Object.entries(parameterMappings)) {
  reverseParameterMappings[camelCase] = snakeCase;
}

export function normalizeParameters(params: OperationParams): OperationParams {
  if (!params || typeof params !== 'object') {
    return params;
  }

  const result: OperationParams = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      let normalizedKey = key;
      if (key.includes('_') && parameterMappings[key]) {
        normalizedKey = parameterMappings[key];
      }
      if (typeof params[key] === 'object' && params[key] !== null && !Array.isArray(params[key])) {
        result[normalizedKey] = normalizeParameters(params[key] as OperationParams);
      } else {
        result[normalizedKey] = params[key];
      }
    }
  }
  return result;
}

export function convertCamelToSnakeCase(params: OperationParams): OperationParams {
  const result: OperationParams = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const snakeKey = reverseParameterMappings[key] || key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (typeof params[key] === 'object' && params[key] !== null && !Array.isArray(params[key])) {
        result[snakeKey] = convertCamelToSnakeCase(params[key] as OperationParams);
      } else {
        result[snakeKey] = params[key];
      }
    }
  }
  return result;
}
