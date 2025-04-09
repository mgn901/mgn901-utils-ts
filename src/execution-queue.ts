import type { Client, Server } from './asyncify-events';
import type { Filters, FromRepository, OrderBy } from './repository-utils';
import {
  type TimeWindowRateLimitationRule,
  calculateNextExecutionDate,
} from './time-window-rate-limitation';
import { executeAt } from './timer';
import type { TypedEventTarget } from './typed-event-target';

const executionTypeSymbol = Symbol('execution.type');

export type Execution<
  TId,
  TFunc extends (this: unknown, ...args: never[]) => TReturned,
  TReturned,
> = {
  readonly [executionTypeSymbol]: typeof executionTypeSymbol;
  readonly id: TId;
  readonly args: Readonly<Parameters<TFunc>>;
  readonly executedAt: Date;
  readonly isExecuted: boolean;
};

export const ExecutionReducers = {
  createFactory: <
    TId,
    TFunc extends (this: unknown, ...args: never[]) => TReturned,
    TReturned,
  >(params: { readonly generateId: () => TId }): ((
    params: Pick<Execution<TId, TFunc, TReturned>, 'args' | 'executedAt'>,
  ) => Execution<TId, TFunc, TReturned>) => {
    const { generateId } = params;

    return (params) => ({
      [executionTypeSymbol]: executionTypeSymbol,
      id: generateId() as TId,
      args: params.args,
      executedAt: params.executedAt,
      isExecuted: false,
    });
  },

  toExecuted: <
    S extends Execution<TId, TFunc, TReturned>,
    TId,
    TFunc extends (this: unknown, ...args: never[]) => TReturned,
    TReturned,
  >(
    self: S,
  ): S => ({ ...self, isExecuted: true }),
};

export interface ExecutionRepository<
  TId,
  TFunc extends (this: unknown, ...args: never[]) => TReturned,
  TReturned,
> {
  getOneById(
    this: ExecutionRepository<TId, TFunc, TReturned>,
    id: TId,
  ): Promise<FromRepository<Execution<TId, TFunc, TReturned>> | undefined>;

  getMany(
    this: ExecutionRepository<TId, TFunc, TReturned>,
    params: {
      readonly filters?: Filters<
        Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'> // `id`の型が不定なので取り除いている。以下同様。
      >;
      readonly orderBy: OrderBy<
        Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>
      >;
      readonly offset?: number | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<readonly FromRepository<Execution<TId, TFunc, TReturned>>[] | readonly []>;

  count(
    this: ExecutionRepository<TId, TFunc, TReturned>,
    params: {
      readonly filters?: Filters<
        Pick<Execution<TId, TFunc, TReturned>, 'executedAt' | 'isExecuted'>
      >;
    },
  ): Promise<number>;

  createOne(
    this: ExecutionRepository<TId, TFunc, TReturned>,
    execution: Execution<TId, TFunc, TReturned>,
  ): Promise<void>;

  updateOne(
    this: ExecutionRepository<TId, TFunc, TReturned>,
    execution: FromRepository<Execution<TId, TFunc, TReturned>>,
  ): Promise<void>;

  deleteOneById(this: ExecutionRepository<TId, TFunc, TReturned>, id: TId): Promise<void>;
}

//#region ExecutionQueueEvent
class ScheduleChangeEvent extends Event {
  public readonly newSchedule: Date;

  public constructor(
    params: { readonly newSchedule: Date },
    eventInitDict?: EventInit | undefined,
  ) {
    super('scheduleChange', eventInitDict);
    this.newSchedule = params.newSchedule;
  }
}

type ExecutionQueueEvent = ScheduleChangeEvent;

type ExecutionQueueEventTarget = TypedEventTarget<ExecutionQueueEvent>;
//#endregion

export interface ExecutionQueue<
  TId,
  TFunc extends (this: unknown, ...args: never[]) => TReturned,
  TReturned,
> {
  enqueue(
    this: ExecutionQueue<TId, TFunc, TReturned>,
    args: Readonly<Parameters<TFunc>>,
  ): Promise<Execution<TId, TFunc, TReturned>>;

  cancel(this: ExecutionQueue<TId, TFunc, TReturned>, id: TId): Promise<void>;
}

//#region Implementations of `ExecutionQueue`
export class ExecutionQueueWithTimeWindowRateLimitation<
  TId,
  TFunc extends (this: unknown, ...args: never[]) => TReturned,
  TReturned,
> implements ExecutionQueue<TId, TFunc, TReturned>
{
  private readonly client: Client<Server<TFunc, TReturned>, TReturned, TFunc>;
  private readonly timeWindowRateLimitationRulesSorted: readonly TimeWindowRateLimitationRule[];
  private readonly executionFactory: (
    this: unknown,
    params: Pick<Execution<TId, TFunc, TReturned>, 'args' | 'executedAt'>,
  ) => Execution<TId, TFunc, TReturned>;

  private readonly executionRepository: ExecutionRepository<TId, TFunc, TReturned>;
  private readonly reservationEventTarget: EventTarget;
  private registeredExecution: Execution<TId, TFunc, TReturned> | undefined;
  private registeredExecutionAbortController: AbortController | undefined;

  public async enqueue(
    this: ExecutionQueueWithTimeWindowRateLimitation<TId, TFunc, TReturned>,
    args: Readonly<Parameters<TFunc>>,
  ): Promise<Execution<TId, TFunc, TReturned>> {
    const executedAt = await calculateNextExecutionDate({
      timeWindowRateLimitationRules: this.timeWindowRateLimitationRulesSorted,
      getNewestExecutionDateInLatestTimeWindow: async () =>
        (await this.executionRepository.getMany({ orderBy: { executedAt: 'desc' }, limit: 1 }))[0]
          ?.executedAt ?? new Date(),
      getOldestExecutionDateInLatestTimeWindow: async (startOfLastTimeWindow: Date) =>
        (
          await this.executionRepository.getMany({
            filters: { executedAt: { from: startOfLastTimeWindow } },
            orderBy: { executedAt: 'asc' },
            limit: 1,
          })
        )[0]?.executedAt,
      countExecutionsInLatestTimeWindow: (startOfLastTimeWindow: Date) =>
        this.executionRepository.count({
          filters: { executedAt: { from: startOfLastTimeWindow } },
        }),
    });

    const execution = this.executionFactory({ args, executedAt });
    await this.executionRepository.createOne(execution);
    this.reservationEventTarget.dispatchEvent(new Event('enqueue'));

    return execution;
  }

  public async cancel(
    this: ExecutionQueueWithTimeWindowRateLimitation<TId, TFunc, TReturned>,
    id: TId,
  ): Promise<void> {
    if (id === this.registeredExecution?.id) {
      this.registeredExecutionAbortController?.abort();
    }

    const execution = await this.executionRepository.getOneById(id);
    if (execution?.isExecuted === false) {
      await this.executionRepository.deleteOneById(id);
      this.reservationEventTarget.dispatchEvent(new Event('cancel'));
    }
  }

  /**
   * 新しい{@linkcode ExecutionQueueWithTimeWindowRateLimitation}を作成して返す。
   */
  public static create<
    TId,
    TFunc extends (this: unknown, ...args: never[]) => TReturned,
    TReturned,
  >(
    this: unknown,
    params: {
      readonly client: Client<Server<TFunc, TReturned>, TReturned, TFunc>;
      readonly timeWindowRateLimitationRules: readonly TimeWindowRateLimitationRule[];
      readonly executionFactory: (
        this: unknown,
        params: Pick<Execution<TId, TFunc, TReturned>, 'args' | 'executedAt'>,
      ) => Execution<TId, TFunc, TReturned>;
      readonly executionRepository: ExecutionRepository<TId, TFunc, TReturned>;
    },
  ): ExecutionQueueWithTimeWindowRateLimitation<TId, TFunc, TReturned> {
    return new ExecutionQueueWithTimeWindowRateLimitation(params);
  }

  private constructor(params: {
    /** 目的の処理を呼び出せるような{@linkcode Client}を指定する。 */
    readonly client: Client<Server<TFunc, TReturned>, TReturned, TFunc>;
    /** ウィンドウごとの実行回数制限を指定する。 */
    readonly timeWindowRateLimitationRules: readonly TimeWindowRateLimitationRule[];
    /** 実行を作成する関数を指定する。 */
    readonly executionFactory: (
      this: unknown,
      params: Pick<Execution<TId, TFunc, TReturned>, 'args' | 'executedAt'>,
    ) => Execution<TId, TFunc, TReturned>;
    /** 実行を永続化するリポジトリを指定する。実行の型に合ったものを指定する。 */
    readonly executionRepository: ExecutionRepository<TId, TFunc, TReturned>;
  }) {
    // 予約された実行がない場合は、次の実行待ちを予約する関数
    const registerIfNextExecutionNonregistered = async () => {
      if (this.registeredExecution !== undefined) {
        return;
      }

      // 次の実行待ちを取り出す。
      const [nextExecution] = await this.executionRepository.getMany({
        filters: { isExecuted: false },
        orderBy: { executedAt: 'asc' },
        limit: 1,
      });
      if (nextExecution === undefined) {
        return;
      }

      // 次の実行待ちをフィールドに割り当てて予約する。
      this.registeredExecution = nextExecution;
      this.registeredExecutionAbortController = new AbortController();
      const executionDate = new Date(Math.max(nextExecution.executedAt.getTime(), Date.now()));

      executeAt({
        date: executionDate,
        func: async () => {
          await this.client.request(...nextExecution.args);

          await this.executionRepository.updateOne(ExecutionReducers.toExecuted(nextExecution));

          // 実行が完了したら、フィールドに割り当てた実行を取り除く。
          this.registeredExecution = undefined;
          this.registeredExecutionAbortController = undefined;
          this.reservationEventTarget.dispatchEvent(new Event('complete'));
        },
        abortSignal: this.registeredExecutionAbortController.signal,
      });
    };

    this.client = params.client;
    this.timeWindowRateLimitationRulesSorted = params.timeWindowRateLimitationRules;
    this.executionFactory = params.executionFactory;
    this.executionRepository = params.executionRepository;
    this.reservationEventTarget = new EventTarget();

    this.reservationEventTarget.addEventListener('complete', registerIfNextExecutionNonregistered);
    this.reservationEventTarget.addEventListener('enqueue', registerIfNextExecutionNonregistered);
    this.reservationEventTarget.addEventListener('cancel', registerIfNextExecutionNonregistered);

    registerIfNextExecutionNonregistered();
  }
}
