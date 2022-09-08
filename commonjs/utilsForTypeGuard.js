"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTypedArray = exports.isRecord = exports.isFunction = exports.isObject = exports.isSymbol = exports.isString = exports.isBigint = exports.isNumber = exports.isBoolean = void 0;
const isBoolean = (v) => {
    return typeof v === 'boolean';
};
exports.isBoolean = isBoolean;
const isNumber = (v) => {
    return typeof v === 'number';
};
exports.isNumber = isNumber;
const isBigint = (v) => {
    return typeof v === 'bigint';
};
exports.isBigint = isBigint;
const isString = (v) => {
    return typeof v === 'string';
};
exports.isString = isString;
const isSymbol = (v) => {
    return typeof v === 'symbol';
};
exports.isSymbol = isSymbol;
const isObject = (v) => {
    return typeof v === 'object';
};
exports.isObject = isObject;
const isFunction = (v) => {
    return typeof v === 'function';
};
exports.isFunction = isFunction;
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
