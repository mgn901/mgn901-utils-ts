import { Nominal } from './Nominal';
/**
 * Nominal type for Unix Time
 */
declare type UnixTime = Nominal<number, 'UnixTime'>;
/**
 * Test whether `v` is `UnixTime`
 * @param v
 * @returns Is `v` `UnixTime`
 */
declare const isUnixTime: (v: unknown) => v is UnixTime;
/**
 * Nominal type for Unix Time in milliseconds
 */
declare type UnixTimeMillis = Nominal<number, 'UnixTimeMillis'>;
/**
 * Test whether `v` is `UnixTimeMillis`
 * @param v
 * @returns Is `v` `UnixTimeMillis`
 */
declare const isUnixTimeMillis: (v: unknown) => v is UnixTimeMillis;
/**
 * Convert `UnixTime` to `UnixTimeMillis`
 * @param unixTime
 * @returns `unixTime` in `UnixTimeMillis`
 */
declare const unixTimeToUnixTimeMillis: (unixTime: UnixTime) => UnixTimeMillis;
/**
 * Convert `UnixTimeMillis` to `UnixTime`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` ins `UnixTime`
 */
declare const unixTimeMillisToUnixTime: (unixTimeMillis: UnixTimeMillis) => UnixTime;
/**
 * Convert `UnixTimeMillis` to `Date`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` in `Date`
 */
declare const unixTimeMillisToDate: (unixTimeMillis: UnixTimeMillis) => Date;
/**
 * Convert `UnixTime` to `Date`
 * @param unixTime
 * @returns `unixTime` in `Date`
 */
declare const unixTimeToDate: (unixTime: UnixTime) => Date;
/**
 * Convert `Date` to `UnixTimeMillis`
 * @param date
 * @returns `date` in `UnixTimeMillis`
 */
declare const dateToUnixTimeMillis: (date: Date) => UnixTimeMillis;
/**
 * Convert `Date` to `UnixTime`
 * @param date
 * @returns `date` in `UnixTime`
 */
declare const dateToUnixTime: (date: Date) => UnixTime;
export { UnixTime, isUnixTime, UnixTimeMillis, isUnixTimeMillis, unixTimeToUnixTimeMillis, unixTimeMillisToUnixTime, unixTimeMillisToDate, unixTimeToDate, dateToUnixTimeMillis, dateToUnixTime, };
