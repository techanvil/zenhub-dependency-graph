/**
 * Check if a variable is set
 *
 * @param {any} variable The variable to check
 *
 * @return {boolean} If the variable is set
 */
 export const isSet = ( variable ) => {
	return variable !== undefined && variable !== null && variable !== false;
};

/**
 * Check if a variable is empty
 *
 * @param {any} variable The variable to check
 *
 * @return {boolean} If the variable is empty
 */
export const isEmpty = ( variable ) => {
	return ! isSet( variable ) || variable?.length === 0;
};
