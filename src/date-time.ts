import type { NominalPrimitive } from './nominal-primitive.type';

const unixTimeTypeSymbol = Symbol('UnixTime');

/**
 * Nominal type for Unix Time
 */
type UnixTime = NominalPrimitive<number, typeof unixTimeTypeSymbol>;

/**
 * Test whether `v` is `UnixTime`
 * @param v
 * @returns Is `v` `UnixTime`
 */
const isUnixTime = (v: unknown): v is UnixTime => {
  if (typeof v === 'number' && Number.isInteger(v)) {
    return true;
  }
  return false;
};

export const unixTimeMillisTypeSymbol = Symbol('UnixTimeMillis');

/**
 * Nominal type for Unix Time in milliseconds
 */
type UnixTimeMillis = NominalPrimitive<number, typeof unixTimeMillisTypeSymbol>;

/**
 * Test whether `v` is `UnixTimeMillis`
 * @param v
 * @returns Is `v` `UnixTimeMillis`
 */
const isUnixTimeMillis = (v: unknown): v is UnixTimeMillis => {
  if (typeof v === 'number' && Number.isInteger(v)) {
    return true;
  }
  return false;
};

/**
 * Convert `UnixTime` to `UnixTimeMillis`
 * @param unixTime
 * @returns `unixTime` in `UnixTimeMillis`
 */
const unixTimeToUnixTimeMillis = (unixTime: UnixTime): UnixTimeMillis => {
  const millis = unixTime * 1000;
  if (!isUnixTimeMillis(millis)) {
    throw new Error('InvalidUnixTime');
  }
  return millis;
};

/**
 * Convert `UnixTimeMillis` to `UnixTime`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` ins `UnixTime`
 */
const unixTimeMillisToUnixTime = (unixTimeMillis: UnixTimeMillis): UnixTime => {
  const s = Math.floor(unixTimeMillis / 1000);
  if (!isUnixTime(s)) {
    throw new Error('InvalidUnixTimeMillis');
  }
  return s;
};

/**
 * Convert `UnixTimeMillis` to `Date`
 * @param unixTimeMillis
 * @returns `unixTimeMillis` in `Date`
 */
const unixTimeMillisToDate = (unixTimeMillis: UnixTimeMillis) => {
  if (
    unixTimeMillis > 100000000 * 24 * 60 * 60 * 1000 &&
    unixTimeMillis < 100000000 * 24 * 60 * 60 * 1000 * -1
  ) {
    throw new Error(
      'InvalidECMAScriptEpoch: Minimum value of ECMAScript epoch is -8,640,000,000,000,000 and maximum is 8,640,000,000,000,000',
    );
  }
  return new Date(unixTimeMillis);
};

/**
 * Convert `UnixTime` to `Date`
 * @param unixTime
 * @returns `unixTime` in `Date`
 */
const unixTimeToDate = (unixTime: UnixTime) => {
  return new Date(unixTimeToUnixTimeMillis(unixTime));
};

/**
 * Convert `Date` to `UnixTimeMillis`
 * @param date
 * @returns `date` in `UnixTimeMillis`
 */
const dateToUnixTimeMillis = (date: Date) => {
  const millis = date.getTime();
  if (!isUnixTimeMillis(millis)) {
    throw new Error('InvalidDateError');
  }
  return millis;
};

/**
 * Convert `Date` to `UnixTime`
 * @param date
 * @returns `date` in `UnixTime`
 */
const dateToUnixTime = (date: Date) => {
  return unixTimeMillisToUnixTime(dateToUnixTimeMillis(date));
};

export {
  type UnixTime,
  isUnixTime,
  type UnixTimeMillis,
  isUnixTimeMillis,
  unixTimeToUnixTimeMillis,
  unixTimeMillisToUnixTime,
  unixTimeMillisToDate,
  unixTimeToDate,
  dateToUnixTimeMillis,
  dateToUnixTime,
};
