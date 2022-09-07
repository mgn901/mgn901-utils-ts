const isBoolean = (v: unknown): v is boolean => {
	return typeof v === 'boolean';
}

const isNumber = (v: unknown): v is number => {
	return typeof v === 'number';
}

const isBigint = (v: unknown): v is bigint => {
	return typeof v === 'bigint';
}

const isString = (v: unknown): v is string => {
	return typeof v === 'string';
}

const isSymbol = (v: unknown): v is symbol => {
	return typeof v === 'symbol';
}

const isObject = (v: unknown): v is object => {
	return typeof v === 'object'
}

const isFunction = (v: unknown): v is ((...args: any[]) => any) => {
	return typeof v === 'function';
}

/**
 * Test whether `v` is `Record`
 * @param v 
 * @returns Is `v` `Record`
 */
const isRecord = (v: unknown): v is Record<string, unknown> => {
	if (typeof v !== 'object' || v === null) {
		return false;
	} else {
		return true;
	}
}

/**
 * Test whether all elements in `v` passes the Custom Type Guard function (`f`)
 * @param v Arrays tested
 * @param f Custom Type Guard function used for the test
 * @returns Whether all elements in `v` is passed the test
 */
const isTypedArray = <T>(v: unknown, f: (w: unknown) => w is T): v is T[] => {
	if (!Array.isArray(v)) {
		return false;
	}
	// Testing each element of v
	// Once test result evaluated to false, finalResult become false.
	let finalResult = !v.some((item) => {
		return f(item) === false;
	});
	return finalResult;
}

export {
	isBoolean,
	isNumber,
	isBigint,
	isString,
	isSymbol,
	isObject,
	isFunction,
	isRecord,
	isTypedArray,
};
