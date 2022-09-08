"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTypedArray = exports.isRecord = void 0;
/**
 * Test whether `v` is `Record`
 * @param v
 * @returns Is `v` `Record`
 */
const isRecord = (v) => {
    if (typeof v !== 'object' || v === null) {
        return false;
    }
    else {
        return true;
    }
};
exports.isRecord = isRecord;
/**
 * Test whether all elements in `v` passes the Custom Type Guard function (`f`)
 * @param v Arrays tested
 * @param f Custom Type Guard function used for the test
 * @returns Whether all elements in `v` is passed the test
 */
const isTypedArray = (v, f) => {
    if (!Array.isArray(v)) {
        return false;
    }
    // Testing each element of v
    // Once test result evaluated to false, finalResult become false.
    let finalResult = !v.some((item) => {
        return f(item) === false;
    });
    return finalResult;
};
exports.isTypedArray = isTypedArray;
