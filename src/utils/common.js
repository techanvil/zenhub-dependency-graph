/**
 * Check if a variable is set
 *
 * @param {any} variable The variable to check
 *
 * @return {boolean} If the variable is set
 */
export const isSet = (variable) => {
  return variable !== undefined && variable !== null && variable !== false;
};

/**
 * Check if a variable is empty
 *
 * @param {any} variable The variable to check
 *
 * @return {boolean} If the variable is empty
 */
export const isEmpty = (variable) => {
  return !isSet(variable) || variable?.length === 0;
};

export function shallowEqual(obj1, obj2) {
  // Check if both objects are strictly equal
  if (obj1 === obj2) {
    return true;
  }

  // Check if either object is null or not an object
  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return false;
  }

  // Get the keys of both objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Check if the number of keys is the same
  if (keys1.length !== keys2.length) {
    return false;
  }

  // Check if all keys and their values are shallow equal
  for (let key of keys1) {
    if (!keys2.includes(key) || obj1[key] !== obj2[key]) {
      return false;
    }
  }

  // Objects are shallow equal
  return true;
}
