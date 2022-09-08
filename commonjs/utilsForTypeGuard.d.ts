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
export { isRecord, isTypedArray, };
