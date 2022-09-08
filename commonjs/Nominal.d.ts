/**
 * Generate Nominal Type named `K` and based on `T`
 */
declare type Nominal<T, K extends string> = T & {
    __brand: K;
};
export { Nominal };
