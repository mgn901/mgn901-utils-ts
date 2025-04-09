import type { NominalPrimitive } from './nominal-primitive.type';

/**
 * エンティティ`E`のID文字列を表す公称プリミティブ型。
 * 16文字の英数字、`-`および`_`から成る。
 */
const symbol = Symbol();
export type Id = NominalPrimitive<string, typeof symbol>;

/**
 * 文字列がIDになりうるかを判定する関数。
 *
 * 文字列が16文字の英数字、`-`および`_`から成るかを判定する。
 *
 * @param value 判定対象の文字列。
 * @returns `value`がIDになりうれば`true`を返し、`value`を`TId<E>`とみなす。そうでなければ`false`を返す。
 */
export const isId = (value: string): value is Id => {
  const regexp = /^[a-zA-Z0-9-_]{16}$/;
  return regexp.test(value);
};

/**
 * 96ビットのIDを生成し、16文字の文字列として返す。
 * @returns 生成されたID文字列。
 */
export const generateId = (): Id => {
  const array = new Uint8Array(12);
  globalThis.crypto.getRandomValues(array);
  const string = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (!isId(string)) {
    throw new IDGenerationFailedError('IDを生成できません。');
  }
  return string;
};

export class IDGenerationFailedError extends Error {
  public readonly name = 'IDGenerationFailedError';
}
