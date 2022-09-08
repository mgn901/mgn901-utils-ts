"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateToUnixTime = exports.dateToUnixTimeMillis = exports.unixTimeToDate = exports.unixTimeMillisToDate = exports.unixTimeMillisToUnixTime = exports.unixTimeToUnixTimeMillis = exports.isUnixTimeMillis = exports.isUnixTime = void 0;
/**
 * Test whether `v` is `UnixTime`
 * @param v
 * @returns Is `v` `UnixTime`
 */
const isUnixTime = (v) => {
    if (typeof v === 'number' && Number.isInteger(v)) {
        return true;
    }
    else {
        return false;
    }
};
exports.isUnixTime = isUnixTime;
/**
 * Test whether `v` is `UnixTimeMillis`
 * @param v
 * @returns Is `v` `UnixTimeMillis`
 */
const isUnixTimeMillis = (v) => {
    if (typeof v === 'number' && Number.isInteger(v)) {
        return true;
    }
    else {
        return false;
    }
};
exports.isUnixTimeMillis = isUnixTimeMillis;
/**
 * Convert `UnixTime` to `UnixTimeMillis`
 * @param unixTime
 * @returns `unixTime` in `UnixTimeMillis`
 */
const unixTimeToUnixTimeMillis = (unixTime) => {
    const millis = unixTime * 1000;
    if (!isUnixTimeMillis(millis)) {
        throw new Error('InvalidUnixTime');
    }
    else {
        return millis;
    }
};
exports.unixTimeToUnixTimeMillis = unixTimeToUnixTimeMillis;
/**
 * Convert `UnixTimeMillis` to `UnixTime`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` ins `UnixTime`
 */
const unixTimeMillisToUnixTime = (unixTimeMillis) => {
    const s = Math.floor(unixTimeMillis / 1000);
    if (!isUnixTime(s)) {
        throw new Error('InvalidUnixTimeMillis');
    }
    else {
        return s;
    }
};
exports.unixTimeMillisToUnixTime = unixTimeMillisToUnixTime;
/**
 * Convert `UnixTimeMillis` to `Date`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` in `Date`
 */
const unixTimeMillisToDate = (unixTimeMillis) => {
    if (unixTimeMillis > 100000000 * 24 * 60 * 60 * 1000
        && unixTimeMillis < 100000000 * 24 * 60 * 60 * 1000 * -1) {
        throw new Error('InvalidECMAScriptEpoch: Minimum value of ECMAScript epoch is -8,640,000,000,000,000 and maximum is 8,640,000,000,000,000');
    }
    return new Date(unixTimeMillis);
};
exports.unixTimeMillisToDate = unixTimeMillisToDate;
/**
 * Convert `UnixTime` to `Date`
 * @param unixTime
 * @returns `unixTime` in `Date`
 */
const unixTimeToDate = (unixTime) => {
    return new Date(unixTimeToUnixTimeMillis(unixTime));
};
exports.unixTimeToDate = unixTimeToDate;
/**
 * Convert `Date` to `UnixTimeMillis`
 * @param date
 * @returns `date` in `UnixTimeMillis`
 */
const dateToUnixTimeMillis = (date) => {
    const millis = date.getTime();
    if (!isUnixTimeMillis(millis)) {
        throw new Error('InvalidDateError');
    }
    else {
        return millis;
    }
};
exports.dateToUnixTimeMillis = dateToUnixTimeMillis;
/**
 * Convert `Date` to `UnixTime`
 * @param date
 * @returns `date` in `UnixTime`
 */
const dateToUnixTime = (date) => {
    return unixTimeMillisToUnixTime(dateToUnixTimeMillis(date));
};
exports.dateToUnixTime = dateToUnixTime;
