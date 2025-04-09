export interface TimeWindowRateLimitationRule {
  readonly timeWindowMs: number;
  readonly executionCountPerTimeWindow: number;
}

/** 各ルールについて、次回の実行が可能になる時刻を求める。 */
const calculateNextExecutionDateOfEachRule = async (params: {
  readonly timeWindowRateLimitationRules: readonly TimeWindowRateLimitationRule[];
  readonly getNewestExecutionDateInLatestTimeWindow: (this: unknown) => Date | Promise<Date>;
  readonly getOldestExecutionDateInLatestTimeWindow: (
    this: unknown,
    startOfLastTimeWindow: Date,
  ) => Date | undefined | Promise<Date | undefined>;
  readonly countExecutionsInLatestTimeWindow: (
    this: unknown,
    startOfLastTimeWindow: Date,
  ) => number | Promise<number>;
}): Promise<
  readonly {
    readonly rule: TimeWindowRateLimitationRule;
    readonly nextExecutionDate: Date;
    readonly isExceeded: boolean;
  }[]
> => {
  const endOfLatestTimeWindow = Math.max(
    (await params.getNewestExecutionDateInLatestTimeWindow()).getTime(),
    Date.now(),
  );

  return (
    await Promise.all(
      params.timeWindowRateLimitationRules.map(async (rule) => {
        // nextExecutionDateInLatestTimeWindowを求める。

        //#region nextExecutionDateInLatestTimeWindowを求めるのに必要な変数。
        const startOfLatestTimeWindow = new Date(endOfLatestTimeWindow - rule.timeWindowMs);

        const executionCountInLatestTimeWindow =
          await params.countExecutionsInLatestTimeWindow(startOfLatestTimeWindow);

        const oldestExecutionInLatestTimeWindow =
          await params.getOldestExecutionDateInLatestTimeWindow(startOfLatestTimeWindow);

        const oldestExecutionDateInLatestTimeWindow =
          oldestExecutionInLatestTimeWindow?.getTime() ?? Date.now();

        const intervalMs = rule.timeWindowMs / rule.executionCountPerTimeWindow;
        //#endregion

        // 上の変数を使って求める。
        const nextExecutionDateInLatestTimeWindow =
          oldestExecutionDateInLatestTimeWindow + intervalMs * executionCountInLatestTimeWindow;

        return {
          rule,
          nextExecutionDate: new Date(Math.max(Date.now(), nextExecutionDateInLatestTimeWindow)),
          isExceeded: rule.executionCountPerTimeWindow <= executionCountInLatestTimeWindow,
        };
      }),
    )
  ).sort((a, b) => a.nextExecutionDate.getTime() - b.nextExecutionDate.getTime());
};

/** ルールを超越しない範囲で、次回の実行が可能になる最も早い時刻を求める。 */
export const calculateNextExecutionDate = async (params: {
  readonly timeWindowRateLimitationRules: readonly TimeWindowRateLimitationRule[];
  readonly getNewestExecutionDateInLatestTimeWindow: (this: unknown) => Date | Promise<Date>;
  readonly getOldestExecutionDateInLatestTimeWindow: (
    this: unknown,
    startOfLastTimeWindow: Date,
  ) => Date | undefined | Promise<Date | undefined>;
  readonly countExecutionsInLatestTimeWindow: (
    this: unknown,
    startOfLastTimeWindow: Date,
  ) => number | Promise<number>;
}): Promise<Date> => {
  const nextExecutionDateOfEachRule = await calculateNextExecutionDateOfEachRule(params);

  const { nextExecutionDate } = nextExecutionDateOfEachRule.reduceRight(
    (prev, current) => (prev.isExceeded === true ? prev : current),
    nextExecutionDateOfEachRule[nextExecutionDateOfEachRule.length - 1],
  );

  return nextExecutionDate;
};
