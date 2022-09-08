declare const isBoolean: (v: unknown) => v is boolean;
declare const isNumber: (v: unknown) => v is number;
declare const isBigint: (v: unknown) => v is bigint;
declare const isString: (v: unknown) => v is string;
declare const isSymbol: (v: unknown) => v is symbol;
declare const isObject: (v: unknown) => v is object;
declare const isFunction: (v: unknown) => v is (...args: any[]) => any;
/**
 * Test whether `v` is `Record`
 * @param v
 * @returns Is `v` `Record`
 */
declare const isRecord: (v: unknown) => v is Record<string, unknown>;
/**
 * Test whether all elements in `v` passes the Custom Type Guard function (`f`)
 * @param v Arrays tested
 * @param f Custom Type Guard function used for the test
 * @returns Whether all elements in `v` is passed the test
 */
declare const isTypedArray: <T>(v: unknown, f: (w: unknown) => w is T) => v is T[];
export { isBoolean, isNumber, isBigint, isString, isSymbol, isObject, isFunction, isRecord, isTypedArray, };
