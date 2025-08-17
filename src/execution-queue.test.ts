import { afterEach } from 'node:test';
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  type Enqueue,
  type Execution,
  type ExecutionId,
  type ExecutionRepository,
  calculateExecutionDateFunctionFromTimeWindowRateLimitationRules,
  executionQueueFrom,
} from './execution-queue.js';
import { generateId } from './random-values.js';
import {
  type Filters,
  type FromRepository,
  type OrderBy,
  repositorySymbol,
} from './repository-utils.js';
import { type SchedulableFunction, schedulableFunctionFromFunction } from './timer.js';

class ExecutionRepositoryMock<
  TFunc extends SchedulableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = Awaited<ReturnType<TFunc>>,
> implements ExecutionRepository<TFunc, TArgs, TReturned>
{
  public readonly underlyingMap = new Map<ExecutionId, Execution<TArgs>>();

  public async getOneById(id: ExecutionId): Promise<FromRepository<Execution<TArgs>> | undefined> {
    const latestVersion = this.underlyingMap.get(id);
    if (latestVersion === undefined) {
      return undefined;
    }
    return { ...latestVersion, [repositorySymbol.latestVersion]: latestVersion };
  }

  public async getMany(params: {
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
    readonly orderBy: OrderBy<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
    readonly offset?: number | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly FromRepository<Execution<TArgs>>[] | readonly []> {
    return (await this.getExecutionsBase(params))
      .sort(
        (a, b) =>
          (params.orderBy.executedAt === 'asc' ? 1 : -1) *
          (a.executedAt.getTime() - b.executedAt.getTime()),
      )
      .slice(
        params.offset ?? 0,
        params.limit !== undefined ? (params.offset ?? 0) + params.limit : undefined,
      )
      .map((item) => ({ ...item, [repositorySymbol.latestVersion]: item }));
  }

  public async count(params: {
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
  }): Promise<number> {
    return (await this.getExecutionsBase(params)).length;
  }

  private async getExecutionsBase(params: {
    readonly filters?: Filters<Pick<Execution<TArgs>, 'executedAt' | 'status'>>;
  }): Promise<Execution<TArgs>[]> {
    return [...this.underlyingMap.entries()]
      .filter(([_, execution]) => {
        const conditions = [
          params.filters?.executedAt instanceof Date === false ||
            execution.executedAt.getTime() === params.filters.executedAt.getTime(),

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.[0] !== 'lte' ||
            params.filters.executedAt[1] <= execution.executedAt,

          params.filters?.executedAt instanceof Date === true ||
            params.filters?.executedAt?.[0] !== 'gte' ||
            execution.executedAt <= params.filters.executedAt[1],

          // 文字列の他のクエリは使わないので未サポート
          typeof params.filters?.status !== 'string' || execution.status === params.filters?.status,
        ];

        return !conditions.some((condition) => condition === false);
      })
      .map(([_, execution]) => execution);
  }

  public async createOne(execution: Execution<TArgs>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async updateOne(execution: Execution<TArgs>): Promise<void> {
    this.underlyingMap.set(execution.id, execution);
  }

  public async deleteOneById(id: ExecutionId): Promise<void> {
    this.underlyingMap.delete(id);
  }
}

const timeWindowRateLimitationRules = [
  { timeWindowMs: 5000, executionCountPerTimeWindow: 10 },
  { timeWindowMs: 10000, executionCountPerTimeWindow: 15 },
  { timeWindowMs: 20000, executionCountPerTimeWindow: 20 },
];

beforeAll(async () => {
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');
  jest.spyOn(global, 'setInterval');
});

describe('execution-queue', () => {
  describe('enqueue', () => {
    const expectedExecutionDateMap = new Map<number, Date>();
    const actualExecutionDateMap = new Map<number, Date>();
    const func = (id: number) => {
      const actualExecutedDate = new Date();
      actualExecutionDateMap.set(id, actualExecutedDate);
      return actualExecutedDate;
    };
    const schedulableFunction = schedulableFunctionFromFunction(func);
    const executionRepository = new ExecutionRepositoryMock<SchedulableFunction<[number], Date>>();
    let executionQueue: Awaited<ReturnType<typeof executionQueueFrom<typeof schedulableFunction>>>;

    beforeAll(async () => {
      executionQueue = await executionQueueFrom({
        schedulableFunction,
        calculateExecutionDate: calculateExecutionDateFunctionFromTimeWindowRateLimitationRules(
          timeWindowRateLimitationRules,
        ),
        executionQueueEventTarget: new EventTarget(),
        executionRepository,
      });

      for (let i = 0; i < 100; i += 1) {
        const { executedAt } = await executionQueue.enqueue(i);
        expectedExecutionDateMap.set(i, executedAt);
      }

      await jest.advanceTimersByTimeAsync(100000);
    });

    test('rate limitations should not be exceeded', async () => {
      const executions = await executionRepository.getMany({
        orderBy: { executedAt: 'asc' },
      });

      for (const rule of timeWindowRateLimitationRules) {
        for (let i = 0; i < executions.length - rule.executionCountPerTimeWindow; i += 1) {
          const { executedAt: firstExecutionDate } = executions[i];
          const { executedAt: lastExecutionDate } =
            executions[i + rule.executionCountPerTimeWindow];

          expect(lastExecutionDate.getTime() - firstExecutionDate.getTime()).toBeGreaterThanOrEqual(
            rule.timeWindowMs,
          );
        }
      }
    });

    test('enqueued executions should be executed on time', async () => {
      [...expectedExecutionDateMap.entries()].map(([id, expectedExecutionDate]) => {
        const actualExecutionDate = actualExecutionDateMap.get(id);
        expect(actualExecutionDate?.getTime()).toBeDefined();
        if (actualExecutionDate?.getTime() === undefined) {
          throw Error(`Execution date for ID ${id} is undefined`);
        }
        expect(
          Math.abs(actualExecutionDate?.getTime() - expectedExecutionDate.getTime()),
        ).toBeLessThanOrEqual(1);
      });
      expect(await executionRepository.count({ filters: { status: 'completed' } })).toEqual(100);
    });
  });

  describe('cancel', () => {
    const returnedValues: number[] = [];
    const executionIds: Awaited<ReturnType<Enqueue<[number]>>>[] = [];
    const func = jest.fn((id: number) => {
      returnedValues.push(id);
    });
    const schedulableFunction = schedulableFunctionFromFunction(func);
    const executionQueueEventTarget = new EventTarget();
    let executionQueue: Awaited<ReturnType<typeof executionQueueFrom<typeof schedulableFunction>>>;

    beforeAll(async () => {
      executionQueue = await executionQueueFrom<typeof schedulableFunction>({
        schedulableFunction,
        calculateExecutionDate: calculateExecutionDateFunctionFromTimeWindowRateLimitationRules(
          timeWindowRateLimitationRules,
        ),
        executionQueueEventTarget,
        executionRepository: new ExecutionRepositoryMock(),
      });
    });

    test('canceled executions should not be executed', async () => {
      for (let i = 0; i < 100; i += 1) {
        const returned = await executionQueue.enqueue(i);
        executionIds.push(returned);
      }
      await jest.advanceTimersByTimeAsync(45500);
      for (let i = 50; i < 100; i += 1) {
        executionQueue.cancel(executionIds[i].executionId);
      }
      await jest.advanceTimersByTimeAsync(50000);

      for (let i = 0; i < 50; i += 1) {
        expect(func).toHaveBeenCalledWith(i);
      }
      for (let i = 50; i < 100; i += 1) {
        expect(func).not.toHaveBeenCalledWith(i);
      }
    });
  });

  describe('execution queue event', () => {
    const schedulableFunction = jest.fn(
      schedulableFunctionFromFunction((id: number, shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error(id.toString());
        }
        return id;
      }),
    );
    const executionQueueEventTarget = new EventTarget();
    let executionQueue: Awaited<ReturnType<typeof executionQueueFrom<typeof schedulableFunction>>>;
    let executionQueueWithDelayedInitialization: Awaited<
      ReturnType<typeof executionQueueFrom<typeof schedulableFunction>>
    >;
    const startedHandler = jest.fn();
    const completedHandler = jest.fn();
    const failedHandler = jest.fn();
    const scheduleUpdatedHandler = jest.fn();

    beforeAll(() => {
      executionQueueEventTarget.addEventListener('started', startedHandler);
      executionQueueEventTarget.addEventListener('completed', completedHandler);
      executionQueueEventTarget.addEventListener('failed', failedHandler);
      executionQueueEventTarget.addEventListener('scheduleUpdated', scheduleUpdatedHandler);
    });

    beforeEach(async () => {
      executionQueue = await executionQueueFrom({
        schedulableFunction: schedulableFunction,
        calculateExecutionDate: calculateExecutionDateFunctionFromTimeWindowRateLimitationRules(
          timeWindowRateLimitationRules,
        ),
        executionQueueEventTarget,
        executionRepository: new ExecutionRepositoryMock(),
      });
    });

    test('queue should dispatch ExecutionQueueStartedEvent and ExecutionQueueCompletedEvent', async () => {
      const { executionId } = await executionQueue.enqueue(1, false);
      await jest.advanceTimersByTimeAsync(1);

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'started',
          detail: expect.objectContaining({
            type: 'started',
            executionId,
            args: expect.arrayContaining([1, false]),
          }),
        }),
      );
      expect(completedHandler).toHaveBeenCalledTimes(1);
      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'completed',
          detail: expect.objectContaining({
            type: 'completed',
            executionId,
            args: expect.arrayContaining([1, false]),
            value: 1,
          }),
        }),
      );
    });

    test('queue should dispatch ExecutionQueueFailedEvent', async () => {
      const { executionId } = await executionQueue.enqueue(1, true);
      await jest.advanceTimersByTimeAsync(1);

      expect(completedHandler).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failed',
          detail: expect.objectContaining({ executionId }),
        }),
      );
      expect(failedHandler).toHaveBeenCalledTimes(1);
      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failed',
          detail: expect.objectContaining({
            type: 'failed',
            executionId,
            args: expect.arrayContaining([1, true]),
            value: expect.objectContaining({ message: '1' }),
          }),
        }),
      );
    });

    test('queue should dispatch ExecutionQueuescheduleUpdatedEvent', async () => {
      const executionRepository = new ExecutionRepositoryMock<typeof schedulableFunction>();
      const executionId = generateId() as ExecutionId;
      const executedAt = new Date();
      executionRepository.createOne({
        id: executionId,
        args: [1, false],
        executedAt,
        status: 'pending',
      });
      await jest.advanceTimersByTimeAsync(10000);

      executionQueueWithDelayedInitialization = await executionQueueFrom({
        schedulableFunction: schedulableFunction,
        calculateExecutionDate: calculateExecutionDateFunctionFromTimeWindowRateLimitationRules(
          timeWindowRateLimitationRules,
        ),
        executionQueueEventTarget,
        executionRepository,
      });

      expect(scheduleUpdatedHandler).toHaveBeenCalledTimes(1);
      expect(scheduleUpdatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scheduleUpdated',
          detail: expect.objectContaining({
            type: 'scheduleUpdated',
            executionId,
            args: expect.arrayContaining([1]),
            previousExecutedAt: executedAt,
            newExecutedAt: expect.any(Date),
          }),
        }),
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    afterAll(() => {
      executionQueueEventTarget.removeEventListener('started', startedHandler);
      executionQueueEventTarget.removeEventListener('completed', completedHandler);
      executionQueueEventTarget.removeEventListener('failed', failedHandler);
      executionQueueEventTarget.removeEventListener('scheduleUpdated', scheduleUpdatedHandler);
    });
  });

  describe('association with ExecutionRepository', () => {
    const schedulableFunction = schedulableFunctionFromFunction(
      (id: number, shouldFail: boolean) =>
        new Promise<number>((resolve, reject) => {
          setTimeout(() => {
            if (shouldFail) {
              reject(new Error(id.toString()));
              return;
            }
            resolve(id);
          }, 1000);
        }),
    );
    let executionQueue: Awaited<ReturnType<typeof executionQueueFrom<typeof schedulableFunction>>>;
    const executionRepository = new ExecutionRepositoryMock<typeof schedulableFunction>();

    beforeEach(async () => {
      executionQueue = await executionQueueFrom<typeof schedulableFunction>({
        schedulableFunction,
        calculateExecutionDate: calculateExecutionDateFunctionFromTimeWindowRateLimitationRules(
          timeWindowRateLimitationRules,
        ),
        executionQueueEventTarget: new EventTarget(),
        executionRepository,
      });
    });

    test('execution queue should create an execution in the repository when enqueued', async () => {
      const { executionId } = await executionQueue.enqueue(1, false);
      const execution = await executionRepository.getOneById(executionId);

      expect(execution).toBeDefined();
      expect(execution?.args).toEqual([1, false]);
      expect(execution?.status).toEqual('pending');
    });

    test('execution queue should update the execution in the repository when completed', async () => {
      const { executionId } = await executionQueue.enqueue(1, false);

      await jest.advanceTimersByTimeAsync(500);
      const executionRunning = await executionRepository.getOneById(executionId);

      expect(executionRunning).toBeDefined();
      expect(executionRunning?.args).toEqual([1, false]);
      expect(executionRunning?.status).toEqual('running');

      await jest.advanceTimersByTimeAsync(1000);
      const executionCompleted = await executionRepository.getOneById(executionId);

      expect(executionCompleted).toBeDefined();
      expect(executionCompleted?.args).toEqual([1, false]);
      expect(executionCompleted?.status).toEqual('completed');
    });

    test('execution queue should update the execution in the repository when failed', async () => {
      const { executionId } = await executionQueue.enqueue(1, true);
      await executionQueue.cancel(executionId);
      await jest.advanceTimersByTimeAsync(1000);

      const execution = await executionRepository.getOneById(executionId);

      expect(execution).toBeDefined();
      expect(execution?.args).toEqual([1, true]);
      expect(execution?.status).toEqual('failed');
    });
  });
});
