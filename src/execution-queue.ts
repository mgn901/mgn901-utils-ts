import {
  dispatchFunctionFromEventTarget,
  subscribeHandlersToEventTarget,
} from './custom-event-utils.js';
import type { NominalPrimitive } from './nominal-primitive.type.js';
import { type Id, generateId } from './random-values.js';
import type { Filters, FromRepository, OrderBy } from './repository-utils.js';
import { createState } from './state.js';
import {
  type TimeWindowRateLimitationRule,
  calculateNextExecutionDate,
} from './time-window-rate-limitation.js';
import type { SchedulableFunction } from './timer.js';

//#region interfaces
const executionTypeSymbol = Symbol('executionType');
export type ExecutionId = NominalPrimitive<Id, typeof executionTypeSymbol>;
export type Execution<TArgs extends unknown[]> = {
  readonly id: ExecutionId;
  readonly args: TArgs;
  readonly executedAt: Date;
  readonly status: 'pending' | 'canceled' | 'running' | 'completed' | 'failed';
};

export type Enqueue<TArgs extends unknown[]> = (
  ...args: TArgs
) => Promise<{ readonly executionId: ExecutionId; readonly executedAt: Date }>;
export type Cancel = (executionId: ExecutionId, reason?: unknown) => Promise<void>;

export type CalculateExecutionDate = (
  this: unknown,
  repository: Pick<
    ExecutionRepository<SchedulableFunction<unknown[], unknown>>,
    'getOneById' | 'getMany' | 'count'
  >,
) => Promise<Date>;

export type ExecutionQueueEventData<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> =
  | ExecutionQueueScheduleUpdatedEventData<TFunc, TArgs, TReturned>
  | ExecutionQueueStartedEventData<TFunc, TArgs, TReturned>
  | ExecutionQueueCompletedEventData<TFunc, TArgs, TReturned>
  | ExecutionQueueFailedEventData<TFunc, TArgs, TReturned>
  | ExecutionQueueErrorEventData;
export type ExecutionQueueScheduleUpdatedEventData<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> = {
  readonly type: 'scheduleUpdated';
  readonly executionId: ExecutionId;
  readonly args: TArgs;
  readonly previousExecutedAt: Date;
  readonly newExecutedAt: Date;
};
export type ExecutionQueueStartedEventData<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> = {
  readonly type: 'started';
  readonly executionId: ExecutionId;
  readonly args: TArgs;
};
export type ExecutionQueueCompletedEventData<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> = {
  readonly type: 'completed';
  readonly executionId: ExecutionId;
  readonly args: TArgs;
  readonly value: TReturned;
};
export type ExecutionQueueFailedEventData<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> = {
  readonly type: 'failed';
  readonly executionId: ExecutionId;
  readonly args: TArgs;
  readonly value: unknown;
};
export type ExecutionQueueErrorEventData = { readonly type: 'error'; readonly error: unknown };

export type ExecutionRepository<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> = {
  getOneById(this: unknown, id: ExecutionId): Promise<FromRepository<Execution<TArgs>> | undefined>;
  getMany(
    this: unknown,
    params: {
      readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
      readonly orderBy: OrderBy<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
      readonly offset?: number | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<readonly FromRepository<Execution<TArgs>>[] | readonly []>;
  count(
    this: unknown,
    params: { readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>> },
  ): Promise<number>;
  createOne(this: unknown, execution: Execution<TArgs>): Promise<void>;
  updateOne(this: unknown, execution: FromRepository<Execution<TArgs>>): Promise<void>;
  deleteOneById(this: unknown, executionId: ExecutionId): Promise<void>;
};
//#endregion

type StateValue<TArgs extends unknown[]> =
  | {
      readonly status: 'running';
      readonly execution: FromRepository<Execution<TArgs>>;
      readonly abortController: AbortController;
    }
  | { readonly status: 'idle' };

type ControlEventData<TArgs extends unknown[]> =
  | ControlPopEventData
  | ControlRunEventData<TArgs>
  | ControlSuspendEventData;
type ControlPopEventData = { readonly type: 'pop' };
type ControlRunEventData<TArgs extends unknown[]> = {
  readonly type: 'run';
  readonly execution: FromRepository<Execution<TArgs>>;
  readonly abortController: AbortController;
};
type ControlSuspendEventData = { readonly type: 'suspend' };
//#endregion

export const executionQueue = async <
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
>(params: {
  readonly schedulableFunction: TFunc;
  readonly calculateExecutionDate: CalculateExecutionDate;
  readonly executionQueueEventTarget: EventTarget;
  readonly executionRepository: ExecutionRepository<TFunc, TArgs, TReturned>;
}): Promise<{ readonly enqueue: Enqueue<TArgs>; readonly cancel: Cancel }> => {
  const queueState = createState<StateValue<TArgs>>({ status: 'idle' });
  const controlEventTarget = new EventTarget();
  let unsubscribeControlEventHandlers: (() => void) | undefined;

  const dispatchExecutionQueueEvent = dispatchFunctionFromEventTarget<
    ExecutionQueueEventData<TFunc, TArgs, TReturned>
  >(params.executionQueueEventTarget);
  const dispatchControlEvent =
    dispatchFunctionFromEventTarget<ControlEventData<TArgs>>(controlEventTarget);

  const handleRun = async (event: CustomEvent<ControlRunEventData<TArgs>>) => {
    const { execution, abortController } = event.detail;

    try {
      // 取り出した実行待ちの状態をrepository内でrunningに更新する。
      await params.executionRepository.updateOne({ ...execution, status: 'running' });

      try {
        // 実行開始イベントを発火する。
        dispatchExecutionQueueEvent('started', {
          type: 'started',
          executionId: execution.id,
          args: execution.args,
        });

        // 取り出した実行待ちを実行する。
        const executionDate = new Date(Math.max(execution.executedAt.getTime(), Date.now()));
        const returned = await params.schedulableFunction(
          execution.args,
          executionDate,
          abortController.signal,
        );

        // 実行に成功した場合は、完了イベントを発火する。
        dispatchExecutionQueueEvent('completed', {
          type: 'completed',
          executionId: execution.id,
          args: execution.args,
          value: returned,
        });
      } catch (error: unknown) {
        // 実行に失敗した場合は、失敗イベントを発火する。
        dispatchExecutionQueueEvent('failed', {
          type: 'failed',
          executionId: execution.id,
          args: execution.args,
          value: error,
        });

        // repositoryを更新する。
        await params.executionRepository.updateOne({ ...execution, status: 'failed' });

        return;
      }

      // repositoryを更新する。
      await params.executionRepository.updateOne({ ...execution, status: 'completed' });
    } catch (error: unknown) {
      // repositoryの更新でエラーが発生した場合は、エラーイベントを発火する。
      dispatchExecutionQueueEvent('error', { type: 'error', error });
    } finally {
      queueState.set({ status: 'idle' });
      dispatchControlEvent('pop', { type: 'pop' });
    }
  };
  const handlePop = async () => {
    try {
      // 次の実行待ちを取り出す。
      const [nextExecution] = await params.executionRepository.getMany({
        filters: { status: 'pending' },
        orderBy: { executedAt: 'asc' },
        limit: 1,
      });

      // 実行待ちがない場合は、何もしない。
      if (nextExecution === undefined) {
        dispatchControlEvent('suspend', { type: 'suspend' });
        return;
      }

      const abortController = new AbortController();
      queueState.set({ status: 'running', execution: nextExecution, abortController });
      dispatchControlEvent('run', { type: 'run', execution: nextExecution, abortController });
    } catch (error: unknown) {
      // repositoryなどでエラーが発生した場合は、エラーイベントを発火する。
      dispatchExecutionQueueEvent('error', { type: 'error', error });
    }
  };
  const handleSuspend = async () => {
    unsubscribeControlEventHandlers?.();
  };
  const subscribeIfNeeded = () => {
    if (unsubscribeControlEventHandlers === undefined) {
      unsubscribeControlEventHandlers = subscribeHandlersToEventTarget<ControlEventData<TArgs>>(
        { run: handleRun, pop: handlePop, suspend: handleSuspend },
        controlEventTarget,
      );
    }
  };

  //#region 初期化
  const waitingExecutionsBeforeStart = await params.executionRepository.getMany({
    filters: { status: 'pending' },
    orderBy: { executedAt: 'asc' },
  });
  if (waitingExecutionsBeforeStart.length > 0) {
    for (const execution of waitingExecutionsBeforeStart) {
      const newExecutedAt = await params.calculateExecutionDate(params.executionRepository);
      await params.executionRepository.updateOne({ ...execution, executedAt: newExecutedAt });
      dispatchExecutionQueueEvent('scheduleUpdated', {
        type: 'scheduleUpdated',
        executionId: execution.id,
        args: execution.args,
        previousExecutedAt: execution.executedAt,
        newExecutedAt,
      });
    }
    subscribeIfNeeded();
    dispatchControlEvent('pop', { type: 'pop' });
  }
  //#endregion

  return {
    enqueue: async (...args) => {
      const execution = {
        id: generateId() as ExecutionId,
        args,
        executedAt: await params.calculateExecutionDate(params.executionRepository),
        status: 'pending',
      } satisfies Execution<TArgs>;
      await params.executionRepository.createOne(execution);
      subscribeIfNeeded();
      dispatchControlEvent('pop', { type: 'pop' });
      return { executionId: execution.id, executedAt: execution.executedAt };
    },

    cancel: async (executionId, reason) => {
      const queueStateValue = queueState.get();
      if (queueStateValue.status === 'running' && queueStateValue?.execution.id === executionId) {
        queueStateValue.abortController.abort(reason);
      } else {
        await params.executionRepository.deleteOneById(executionId);
        subscribeIfNeeded();
        dispatchControlEvent('pop', { type: 'pop' });
      }
    },
  };
};

export const createCalculateExecutionDateFromTimeWindowRateLimitationRules =
  (rules: readonly TimeWindowRateLimitationRule[]): CalculateExecutionDate =>
  async (repository) =>
    calculateNextExecutionDate({
      timeWindowRateLimitationRules: rules,
      getNewestExecutionDateInLatestTimeWindow: async () =>
        (await repository.getMany({ orderBy: { executedAt: 'desc' }, limit: 1 }))[0]?.executedAt ??
        new Date(),
      getOldestExecutionDateInLatestTimeWindow: async (startOfLastTimeWindow: Date) =>
        (
          await repository.getMany({
            filters: { executedAt: ['lte', startOfLastTimeWindow] },
            orderBy: { executedAt: 'asc' },
            limit: 1,
          })
        )[0]?.executedAt,
      countExecutionsInLatestTimeWindow: (startOfLastTimeWindow: Date) =>
        repository.count({ filters: { executedAt: ['lte', startOfLastTimeWindow] } }),
    });
