export const defaultCompareFn = <T>(a: Readonly<T>, b: Readonly<T>): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * 渡された配列から、重複した要素を排除したものを新たな配列として返す。
 * @param array 重複排除の対象の配列。
 * @param compareFn 重複判定に用いる比較関数。第1引数と第2引数を比較し、第1引数の方が前に来るならば-1以下の値を返し、第2引数の方が前に来るならば1以上の値を返し、等しければ0を返すような関数。
 * @returns 重複を排除した配列。
 */
export const dedupe = <T>(
  array: readonly T[],
  compareFn: (a: Readonly<T>, b: Readonly<T>) => number = defaultCompareFn,
): T[] =>
  [...array].sort(compareFn).reduce<T[]>((result, current) => {
    // current: この回の呼び出しで読んでいる配列の値。

    // 前に結果に追加した値とcurrentとを比較する。
    // 等しければ何もしない。
    // 等しくなければcurrentを結果に追加する。
    if (result.length !== 0 && compareFn(current, result[result.length - 1]) === 0) {
      return result;
    }
    result.push(current);
    return result;
  }, []);

/**
 * 2つの配列の共通部分を新たな配列として返す。
 * @param a 1つ目の配列。
 * @param b 2つ目の配列。
 * @param compareFn 比較関数。第1引数と第2引数を比較し、第1引数の方が前に来るならば-1以下の値を返し、第2引数の方が前に来るならば1以上の値を返し、等しければ0を返すような関数。
 * @returns 2つの配列の共通部分。
 */
export const intersect = <T>(
  a: readonly T[],
  b: readonly T[],
  compareFn: (a: Readonly<T>, b: Readonly<T>) => number = defaultCompareFn,
): T[] => {
  const as = dedupe(a, compareFn).sort(compareFn);
  const bs = dedupe(b, compareFn).sort(compareFn);

  return as.reduce<T[]>((result, current) => {
    // current: この回の呼び出しで読んでいる1つ目の配列の値。

    // 2つ目の配列の先頭がcurrentまたはcurrentより大きくなるまで、2つ目の配列の先頭を取り除く。
    while (bs.length !== 0 && compareFn(current, bs[0]) > 0) {
      bs.shift();
    }

    // 2つ目の配列が空になったら、何もしない。
    if (bs.length === 0) {
      return result;
    }

    // currentと2つ目の配列の先頭とを比較する。
    // 等しくなければ何もしない。
    // 等しければcurrentを結果に追加して2つ目の配列の先頭を取り除く。
    if (compareFn(current, bs[0]) !== 0) {
      return result;
    }
    // biome-ignore lint/style/noNonNullAssertion: bs[0]の存在は28行目で確認している。
    result.push(bs.shift()!);
    return result;
  }, []);
};

/**
 * 2つの配列の和を新たな配列として返す。
 * @param a 1つ目の配列。
 * @param b 2つ目の配列。
 * @param compareFn 第1引数と第2引数を比較し、第1引数の方が前に来るならば-1以下の値を返し、第2引数の方が前に来るならば1以上の値を返し、等しければ0を返すような関数。
 * @returns 2つの配列の和。
 */
export const union = <T>(
  a: readonly T[],
  b: readonly T[],
  compareFn: (a: Readonly<T>, b: Readonly<T>) => number = defaultCompareFn,
): T[] => dedupe([...a, ...b], compareFn);

/**
 * 2つの配列の差集合を新たな配列として返す。
 * @param minuned 引かれる集合を表す配列。
 * @param subtrahend 引く集合を表す配列。
 * @param compareFn 比較関数。第1引数と第2引数を比較し、第1引数の方が前に来るならば-1以下の値を返し、第2引数の方が前に来るならば1以上の値を返し、等しければ0を返すような関数。
 * @returns `minuined`から`subtrahend`を引いた差集合。
 */
export const except = <T>(
  minuned: readonly T[],
  subtrahend: readonly T[],
  compareFn: (a: Readonly<T>, b: Readonly<T>) => number = defaultCompareFn,
): T[] => {
  const m = dedupe(minuned, compareFn).sort(compareFn);
  const s = dedupe(subtrahend, compareFn).sort(compareFn);
  const intersection = intersect(m, s, compareFn);

  return m.reduce<T[]>((result, current, currentIndex) => {
    // current: この回の呼び出しで読んでいる1つ目の配列の値。

    // 共通部分が空になったら、1つ目の配列のcurrent以降の値を結果に追加する。
    if (intersection.length === 0) {
      result.push(...m.splice(currentIndex));
      return result;
    }

    // currentと共通部分の先頭とを比較する。
    // 等しければ共通部分の先頭を取り除く。
    // 等しくなければcurrentを結果に追加する。
    if (compareFn(current, intersection[0]) === 0) {
      intersection.shift();
      return result;
    }
    result.push(current);
    return result;
  }, []);
};
