/**
 * Utility functions for converting between snake_case and camelCase
 * Used for transforming backend API responses to frontend format
 */

/**
 * Recursively convert all snake_case keys in an object to camelCase
 *
 * @param obj - Object with snake_case keys
 * @returns New object with camelCase keys
 *
 * @example
 * convertKeysToCamelCase({ user_name: 'John', user_id: 123 })
 * // Returns: { userName: 'John', userId: 123 }
 *
 * @example
 * convertKeysToCamelCase({ items: [{ item_name: 'A' }] })
 * // Returns: { items: [{ itemName: 'A' }] }
 */
export function convertKeysToCamelCase(obj: any): any {
  // Handle null, undefined, or primitive types
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types (string, number, boolean)
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays - recursively convert each element
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamelCase(item));
  }

  // Handle Date objects - return as is
  if (obj instanceof Date) {
    return obj;
  }

  // Handle regular objects - convert keys
  return Object.keys(obj).reduce((acc, key) => {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Recursively convert nested objects/arrays
    acc[camelKey] = convertKeysToCamelCase(obj[key]);

    return acc;
  }, {} as any);
}

/**
 * Convert a single snake_case string to camelCase
 *
 * @param str - String in snake_case format
 * @returns String in camelCase format
 *
 * @example
 * snakeToCamel('user_name') // Returns: 'userName'
 * snakeToCamel('user_id') // Returns: 'userId'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a single camelCase string to snake_case
 *
 * @param str - String in camelCase format
 * @returns String in snake_case format
 *
 * @example
 * camelToSnake('userName') // Returns: 'user_name'
 * camelToSnake('userId') // Returns: 'user_id'
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert all camelCase keys in an object to snake_case
 *
 * @param obj - Object with camelCase keys
 * @returns New object with snake_case keys
 *
 * @example
 * convertKeysToSnakeCase({ userName: 'John', userId: 123 })
 * // Returns: { user_name: 'John', user_id: 123 }
 */
export function convertKeysToSnakeCase(obj: any): any {
  // Handle null, undefined, or primitive types
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToSnakeCase(item));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle regular objects
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = camelToSnake(key);
    acc[snakeKey] = convertKeysToSnakeCase(obj[key]);
    return acc;
  }, {} as any);
}
