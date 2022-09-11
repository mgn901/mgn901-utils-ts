declare type PartiallyPartial<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;
export { PartiallyPartial };
