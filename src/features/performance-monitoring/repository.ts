import {
  Prisma,
  WorkoutExecutionSource as PrismaWorkoutExecutionSource,
  WorkoutExecutionStatus as PrismaWorkoutExecutionStatus,
  WorkoutScheduleStatus as PrismaWorkoutScheduleStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  PerformanceModality,
  WorkoutExecution as WorkoutExecutionContract,
  WorkoutExecutionSource,
  WorkoutExecutionStatus,
  WorkoutScheduledSession as WorkoutScheduledSessionContract,
  WorkoutScheduleStatus,
} from "./contracts";
import type {
  WorkoutImportResult,
  WorkoutImportStore,
} from "./workout-import/contracts";

const WORKOUT_PLAN_ENTRY_TYPE = "WORKOUT_PLAN";
const MIN_RPE = 0;
const MAX_RPE = 10;

const scheduledSessionSelect = {
  id: true,
  workoutPlanEntryId: true,
  workoutPlanVersionId: true,
  sessionId: true,
  masterRecordId: true,
  title: true,
  modality: true,
  scheduledStartAt: true,
  plannedDurationSeconds: true,
  timeZone: true,
  status: true,
  responsibleUserId: true,
  notes: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkoutScheduledSessionSelect;

const executionSelect = {
  id: true,
  scheduledSessionId: true,
  masterRecordId: true,
  workoutPlanEntryId: true,
  workoutPlanVersionId: true,
  sessionId: true,
  modality: true,
  source: true,
  actualStartAt: true,
  actualEndAt: true,
  executedDurationSeconds: true,
  status: true,
  executedRpe: true,
  notes: true,
  executorUserId: true,
  importArtifactId: true,
  importProvider: true,
  importExternalIdentifier: true,
  distanceMeters: true,
  deviceConnectionId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkoutExecutionSelect;

type ScheduledSessionRow = Prisma.WorkoutScheduledSessionGetPayload<{
  select: typeof scheduledSessionSelect;
}>;

type ExecutionRow = Prisma.WorkoutExecutionGetPayload<{
  select: typeof executionSelect;
}>;

type DateInput = Date | string;

type ScheduledSessionContractFields = Pick<
  WorkoutScheduledSessionContract,
  | "id"
  | "masterRecordId"
  | "workoutPlanEntryId"
  | "workoutPlanVersionId"
  | "title"
  | "modality"
  | "scheduledStartAt"
  | "plannedDurationSeconds"
  | "timeZone"
  | "status"
  | "revision"
  | "createdAt"
  | "updatedAt"
>;

export interface PersistedWorkoutScheduledSession
  extends ScheduledSessionContractFields {
  readonly sessionId?: string;
  readonly scheduledEndAt?: string;
  readonly responsibleUserId?: string;
  readonly notes?: string;
}

type ExecutionContractFields = Pick<
  WorkoutExecutionContract,
  | "id"
  | "scheduledSessionId"
  | "masterRecordId"
  | "workoutPlanEntryId"
  | "workoutPlanVersionId"
  | "sessionId"
  | "modality"
  | "actualStartAt"
  | "actualEndAt"
  | "executedDurationSeconds"
  | "status"
  | "executedRpe"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

export interface PersistedWorkoutExecution extends ExecutionContractFields {
  readonly source: WorkoutExecutionSource;
  readonly executorUserId?: string;
  readonly importArtifactId?: string;
  readonly importProvider?: string;
  readonly importExternalIdentifier?: string;
  readonly distanceMeters?: number;
  readonly deviceConnectionId?: string;
}

export type PerformanceMonitoringRepositoryErrorCode =
  | "CONFLICT"
  | "IMMUTABLE"
  | "INVALID_ARGUMENT"
  | "INVALID_STATE"
  | "NOT_FOUND";

export class PerformanceMonitoringRepositoryError extends Error {
  constructor(
    readonly code: PerformanceMonitoringRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PerformanceMonitoringRepositoryError";
  }
}

export interface PerformanceMonitoringDateRange {
  readonly from: DateInput;
  readonly to: DateInput;
}

export interface CreateScheduledSessionInput {
  readonly masterRecordId: string;
  readonly workoutPlanEntryId: string;
  readonly workoutPlanVersionId: string;
  readonly sessionId?: string;
  readonly title: string;
  readonly modality: PerformanceModality;
  readonly scheduledStartAt: DateInput;
  readonly plannedDurationSeconds?: number;
  readonly timeZone: string;
  readonly responsibleUserId?: string;
  readonly notes?: string;
}

export interface UpdateScheduledSessionChanges {
  readonly title?: string;
  readonly modality?: PerformanceModality;
  readonly scheduledStartAt?: DateInput;
  readonly plannedDurationSeconds?: number | null;
  readonly timeZone?: string;
  readonly responsibleUserId?: string | null;
  readonly notes?: string | null;
}

export interface UpdateScheduledSessionInput {
  readonly id: string;
  readonly masterRecordId: string;
  readonly expectedRevision: number;
  readonly changes: UpdateScheduledSessionChanges;
}

export interface ChangeScheduledSessionStatusInput {
  readonly id: string;
  readonly masterRecordId: string;
  readonly expectedRevision: number;
  readonly status: WorkoutScheduleStatus;
}

interface CreateManualExecutionCommonInput {
  readonly masterRecordId: string;
  readonly actualStartAt: DateInput;
  readonly executorUserId: string;
  readonly notes?: string;
}

interface CreateManualLinkedExecutionInput
  extends CreateManualExecutionCommonInput {
  readonly scheduledSessionId: string;
  readonly modality?: never;
  readonly workoutPlanEntryId?: never;
  readonly workoutPlanVersionId?: never;
  readonly sessionId?: never;
}

interface CreateManualSpontaneousExecutionWithoutPlanInput
  extends CreateManualExecutionCommonInput {
  readonly scheduledSessionId?: undefined;
  readonly modality: PerformanceModality;
  readonly workoutPlanEntryId?: undefined;
  readonly workoutPlanVersionId?: undefined;
  readonly sessionId?: undefined;
}

interface CreateManualSpontaneousExecutionFromPlanInput
  extends CreateManualExecutionCommonInput {
  readonly scheduledSessionId?: undefined;
  readonly modality: PerformanceModality;
  readonly workoutPlanEntryId: string;
  readonly workoutPlanVersionId: string;
  readonly sessionId?: string;
}

export type CreateManualExecutionInput =
  | CreateManualLinkedExecutionInput
  | CreateManualSpontaneousExecutionWithoutPlanInput
  | CreateManualSpontaneousExecutionFromPlanInput;

export interface UpdateInProgressExecutionChanges {
  readonly actualStartAt?: DateInput;
  readonly executedDurationSeconds?: number | null;
  readonly executedRpe?: number | null;
  readonly notes?: string | null;
}

export interface UpdateInProgressExecutionInput {
  readonly id: string;
  readonly masterRecordId: string;
  readonly changes: UpdateInProgressExecutionChanges;
}

export interface CompleteExecutionInput {
  readonly id: string;
  readonly masterRecordId: string;
  readonly actualEndAt: DateInput;
  readonly executedDurationSeconds?: number;
  readonly executedRpe?: number;
  readonly notes?: string | null;
}

export interface CancelExecutionInput {
  readonly id: string;
  readonly masterRecordId: string;
  readonly actualEndAt?: DateInput;
  readonly executedDurationSeconds?: number;
  readonly notes?: string | null;
}

function invalidArgument(message: string): never {
  throw new PerformanceMonitoringRepositoryError("INVALID_ARGUMENT", message);
}

function requiredText(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) invalidArgument(`${fieldName} deve ser informado.`);
  return normalized;
}

function dateValue(value: DateInput, fieldName: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    invalidArgument(`${fieldName} possui uma data inválida.`);
  }
  return date;
}

function dateRangeValue(range: PerformanceMonitoringDateRange) {
  const from = dateValue(range.from, "Início do intervalo");
  const to = dateValue(range.to, "Fim do intervalo");
  if (from.getTime() > to.getTime()) {
    invalidArgument("O início do intervalo não pode ser posterior ao fim.");
  }
  return { from, to };
}

function positiveDuration(value: number | undefined, fieldName: string) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value <= 0) {
    invalidArgument(`${fieldName} deve ser um número inteiro positivo.`);
  }
  return value;
}

function nullablePositiveDuration(
  value: number | null | undefined,
  fieldName: string,
) {
  if (value === null || value === undefined) return value;
  return positiveDuration(value, fieldName);
}

function rpeValue(value: number | null | undefined) {
  if (value === null || value === undefined) return value;
  if (!Number.isFinite(value) || value < MIN_RPE || value > MAX_RPE) {
    invalidArgument(`RPE deve estar entre ${MIN_RPE} e ${MAX_RPE}.`);
  }
  return value;
}

function assertEndAfterStart(start: Date, end: Date) {
  if (end.getTime() < start.getTime()) {
    invalidArgument("O fim real não pode ser anterior ao início real.");
  }
}

function scheduledEndAt(row: ScheduledSessionRow) {
  if (row.plannedDurationSeconds === null) return undefined;
  return new Date(
    row.scheduledStartAt.getTime() + row.plannedDurationSeconds * 1_000,
  ).toISOString();
}

function toScheduledSession(
  row: ScheduledSessionRow,
): PersistedWorkoutScheduledSession {
  return {
    id: row.id,
    masterRecordId: row.masterRecordId,
    workoutPlanEntryId: row.workoutPlanEntryId,
    workoutPlanVersionId: row.workoutPlanVersionId,
    sessionId: row.sessionId ?? undefined,
    title: row.title,
    modality: row.modality,
    scheduledStartAt: row.scheduledStartAt.toISOString(),
    scheduledEndAt: scheduledEndAt(row),
    plannedDurationSeconds: row.plannedDurationSeconds ?? undefined,
    timeZone: row.timeZone,
    status: row.status,
    responsibleUserId: row.responsibleUserId ?? undefined,
    notes: row.notes ?? undefined,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExecution(row: ExecutionRow): PersistedWorkoutExecution {
  return {
    id: row.id,
    scheduledSessionId: row.scheduledSessionId ?? undefined,
    masterRecordId: row.masterRecordId,
    workoutPlanEntryId: row.workoutPlanEntryId ?? undefined,
    workoutPlanVersionId: row.workoutPlanVersionId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    modality: row.modality,
    source: row.source,
    actualStartAt: row.actualStartAt.toISOString(),
    actualEndAt: row.actualEndAt?.toISOString(),
    executedDurationSeconds: row.executedDurationSeconds ?? undefined,
    status: row.status,
    executedRpe: row.executedRpe?.toNumber(),
    notes: row.notes ?? undefined,
    executorUserId: row.executorUserId ?? undefined,
    importArtifactId: row.importArtifactId ?? undefined,
    importProvider: row.importProvider ?? undefined,
    importExternalIdentifier: row.importExternalIdentifier ?? undefined,
    distanceMeters: row.distanceMeters ?? undefined,
    deviceConnectionId: row.deviceConnectionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertImmutableWorkoutPlanVersion(
  transaction: Prisma.TransactionClient,
  input: {
    masterRecordId: string;
    workoutPlanEntryId: string;
    workoutPlanVersionId: string;
  },
) {
  const workoutPlan = await transaction.workoutPlanRecord.findFirst({
    where: {
      entryId: input.workoutPlanEntryId,
      entry: {
        masterRecordId: input.masterRecordId,
        type: WORKOUT_PLAN_ENTRY_TYPE,
        status: { not: "VOIDED" },
        deletedAt: null,
      },
    },
    select: { entryId: true },
  });
  if (!workoutPlan) {
    throw new PerformanceMonitoringRepositoryError(
      "NOT_FOUND",
      "Plano de treino não encontrado no prontuário informado.",
    );
  }

  const version = await transaction.recordVersion.findFirst({
    where: {
      id: input.workoutPlanVersionId,
      entityType: WORKOUT_PLAN_ENTRY_TYPE,
      entityId: input.workoutPlanEntryId,
      status: "FINALIZED",
    },
    select: { id: true },
  });
  if (!version) {
    throw new PerformanceMonitoringRepositoryError(
      "NOT_FOUND",
      "Versão finalizada do plano de treino não encontrada.",
    );
  }
}

function assertExpectedRevision(actual: number, expected: number) {
  if (!Number.isInteger(expected) || expected < 1) {
    invalidArgument("A revisão esperada deve ser um inteiro positivo.");
  }
  if (actual !== expected) {
    throw new PerformanceMonitoringRepositoryError(
      "CONFLICT",
      "A programação foi alterada por outra operação.",
    );
  }
}

function assertMutableSchedule(status: WorkoutScheduleStatus) {
  if (
    status === PrismaWorkoutScheduleStatus.COMPLETED ||
    status === PrismaWorkoutScheduleStatus.SKIPPED ||
    status === PrismaWorkoutScheduleStatus.CANCELLED
  ) {
    throw new PerformanceMonitoringRepositoryError(
      "IMMUTABLE",
      "Uma programação encerrada não pode ser alterada.",
    );
  }
}

async function findScheduledSessionForMutation(
  transaction: Prisma.TransactionClient,
  id: string,
  masterRecordId: string,
) {
  const scheduledSession = await transaction.workoutScheduledSession.findFirst({
    where: { id, masterRecordId },
    select: scheduledSessionSelect,
  });
  if (!scheduledSession) {
    throw new PerformanceMonitoringRepositoryError(
      "NOT_FOUND",
      "Sessão programada não encontrada no prontuário informado.",
    );
  }
  return scheduledSession;
}

async function findExecutionForMutation(
  transaction: Prisma.TransactionClient,
  id: string,
  masterRecordId: string,
) {
  const execution = await transaction.workoutExecution.findFirst({
    where: { id, masterRecordId },
    select: executionSelect,
  });
  if (!execution) {
    throw new PerformanceMonitoringRepositoryError(
      "NOT_FOUND",
      "Execução não encontrada no prontuário informado.",
    );
  }
  return execution;
}

function assertExecutionInProgress(status: WorkoutExecutionStatus) {
  if (status === PrismaWorkoutExecutionStatus.COMPLETED) {
    throw new PerformanceMonitoringRepositoryError(
      "IMMUTABLE",
      "Uma execução concluída não pode ser sobrescrita.",
    );
  }
  if (status === PrismaWorkoutExecutionStatus.ABORTED) {
    throw new PerformanceMonitoringRepositoryError(
      "INVALID_STATE",
      "Uma execução cancelada não pode ser alterada ou concluída.",
    );
  }
}

async function updateScheduledStatus(
  input: ChangeScheduledSessionStatusInput,
  targetStatus: WorkoutScheduleStatus,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await findScheduledSessionForMutation(
      transaction,
      input.id,
      input.masterRecordId,
    );
    assertExpectedRevision(current.revision, input.expectedRevision);

    if (current.status === targetStatus) return toScheduledSession(current);
    assertMutableSchedule(current.status);

    const updated = await transaction.workoutScheduledSession.updateMany({
      where: {
        id: current.id,
        masterRecordId: current.masterRecordId,
        revision: current.revision,
        status: current.status,
      },
      data: {
        status: targetStatus,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new PerformanceMonitoringRepositoryError(
        "CONFLICT",
        "A programação foi alterada por outra operação.",
      );
    }

    const result = await transaction.workoutScheduledSession.findUniqueOrThrow({
      where: { id: current.id },
      select: scheduledSessionSelect,
    });
    return toScheduledSession(result);
  });
}

export const performanceMonitoringRepository = {
  async createScheduledSession(
    input: CreateScheduledSessionInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    const scheduledStartAt = dateValue(
      input.scheduledStartAt,
      "Início programado",
    );
    const plannedDurationSeconds = positiveDuration(
      input.plannedDurationSeconds,
      "Duração planejada",
    );
    const title = requiredText(input.title, "Título");
    const timeZone = requiredText(input.timeZone, "Fuso horário");

    return prisma.$transaction(async (transaction) => {
      await assertImmutableWorkoutPlanVersion(transaction, input);
      const created = await transaction.workoutScheduledSession.create({
        data: {
          masterRecordId: input.masterRecordId,
          workoutPlanEntryId: input.workoutPlanEntryId,
          workoutPlanVersionId: input.workoutPlanVersionId,
          sessionId: input.sessionId,
          title,
          modality: input.modality,
          scheduledStartAt,
          plannedDurationSeconds,
          timeZone,
          status: PrismaWorkoutScheduleStatus.SCHEDULED,
          responsibleUserId: input.responsibleUserId,
          notes: input.notes,
        },
        select: scheduledSessionSelect,
      });
      return toScheduledSession(created);
    });
  },

  async findScheduledSessionById(
    id: string,
  ): Promise<PersistedWorkoutScheduledSession | null> {
    const row = await prisma.workoutScheduledSession.findUnique({
      where: { id },
      select: scheduledSessionSelect,
    });
    return row ? toScheduledSession(row) : null;
  },

  async listScheduledSessions(
    masterRecordId: string,
    range: PerformanceMonitoringDateRange,
  ): Promise<readonly PersistedWorkoutScheduledSession[]> {
    const { from, to } = dateRangeValue(range);
    const rows = await prisma.workoutScheduledSession.findMany({
      where: {
        masterRecordId,
        scheduledStartAt: { gte: from, lte: to },
      },
      select: scheduledSessionSelect,
      orderBy: [{ scheduledStartAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toScheduledSession);
  },

  async updateScheduledSession(
    input: UpdateScheduledSessionInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    return prisma.$transaction(async (transaction) => {
      const current = await findScheduledSessionForMutation(
        transaction,
        input.id,
        input.masterRecordId,
      );
      assertExpectedRevision(current.revision, input.expectedRevision);
      assertMutableSchedule(current.status);

      const data: Prisma.WorkoutScheduledSessionUpdateManyMutationInput = {
        revision: { increment: 1 },
      };
      let changedFields = 0;

      if (input.changes.title !== undefined) {
        data.title = requiredText(input.changes.title, "Título");
        changedFields += 1;
      }
      if (input.changes.modality !== undefined) {
        data.modality = input.changes.modality;
        changedFields += 1;
      }
      if (input.changes.scheduledStartAt !== undefined) {
        data.scheduledStartAt = dateValue(
          input.changes.scheduledStartAt,
          "Início programado",
        );
        changedFields += 1;
      }
      if (input.changes.plannedDurationSeconds !== undefined) {
        data.plannedDurationSeconds = nullablePositiveDuration(
          input.changes.plannedDurationSeconds,
          "Duração planejada",
        );
        changedFields += 1;
      }
      if (input.changes.timeZone !== undefined) {
        data.timeZone = requiredText(input.changes.timeZone, "Fuso horário");
        changedFields += 1;
      }
      if (input.changes.responsibleUserId !== undefined) {
        data.responsibleUserId = input.changes.responsibleUserId;
        changedFields += 1;
      }
      if (input.changes.notes !== undefined) {
        data.notes = input.changes.notes;
        changedFields += 1;
      }
      if (changedFields === 0) {
        invalidArgument("Informe ao menos um campo da programação para atualizar.");
      }

      const updated = await transaction.workoutScheduledSession.updateMany({
        where: {
          id: current.id,
          masterRecordId: current.masterRecordId,
          revision: current.revision,
          status: current.status,
        },
        data,
      });
      if (updated.count !== 1) {
        throw new PerformanceMonitoringRepositoryError(
          "CONFLICT",
          "A programação foi alterada por outra operação.",
        );
      }

      const result = await transaction.workoutScheduledSession.findUniqueOrThrow({
        where: { id: current.id },
        select: scheduledSessionSelect,
      });
      return toScheduledSession(result);
    });
  },

  async changeScheduledSessionStatus(
    input: ChangeScheduledSessionStatusInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    return updateScheduledStatus(input, input.status);
  },

  async cancelScheduledSession(
    input: Omit<ChangeScheduledSessionStatusInput, "status">,
  ): Promise<PersistedWorkoutScheduledSession> {
    return updateScheduledStatus(
      { ...input, status: PrismaWorkoutScheduleStatus.CANCELLED },
      PrismaWorkoutScheduleStatus.CANCELLED,
    );
  },

  async createManualExecution(
    input: CreateManualExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    const actualStartAt = dateValue(input.actualStartAt, "Início real");
    const executorUserId = requiredText(input.executorUserId, "Executor");

    return prisma.$transaction(async (transaction) => {
      let scheduledSessionId: string | undefined;
      let workoutPlanEntryId: string | undefined;
      let workoutPlanVersionId: string | undefined;
      let sessionId: string | undefined;
      let modality: PerformanceModality;

      if (input.scheduledSessionId !== undefined) {
        const scheduled = await findScheduledSessionForMutation(
          transaction,
          input.scheduledSessionId,
          input.masterRecordId,
        );
        assertMutableSchedule(scheduled.status);
        scheduledSessionId = scheduled.id;
        workoutPlanEntryId = scheduled.workoutPlanEntryId;
        workoutPlanVersionId = scheduled.workoutPlanVersionId;
        sessionId = scheduled.sessionId ?? undefined;
        modality = scheduled.modality;
      } else {
        modality = input.modality;
        workoutPlanEntryId = input.workoutPlanEntryId;
        workoutPlanVersionId = input.workoutPlanVersionId;
        sessionId = input.sessionId;

        if (workoutPlanEntryId && workoutPlanVersionId) {
          await assertImmutableWorkoutPlanVersion(transaction, {
            masterRecordId: input.masterRecordId,
            workoutPlanEntryId,
            workoutPlanVersionId,
          });
        }
      }

      const created = await transaction.workoutExecution.create({
        data: {
          scheduledSessionId,
          masterRecordId: input.masterRecordId,
          workoutPlanEntryId,
          workoutPlanVersionId,
          sessionId,
          modality,
          source: PrismaWorkoutExecutionSource.MANUAL,
          actualStartAt,
          status: PrismaWorkoutExecutionStatus.IN_PROGRESS,
          executorUserId,
          notes: input.notes,
        },
        select: executionSelect,
      });
      return toExecution(created);
    });
  },

  async findExecutionById(
    id: string,
  ): Promise<PersistedWorkoutExecution | null> {
    const row = await prisma.workoutExecution.findUnique({
      where: { id },
      select: executionSelect,
    });
    return row ? toExecution(row) : null;
  },

  async listExecutions(
    masterRecordId: string,
    range: PerformanceMonitoringDateRange,
  ): Promise<readonly PersistedWorkoutExecution[]> {
    const { from, to } = dateRangeValue(range);
    const rows = await prisma.workoutExecution.findMany({
      where: {
        masterRecordId,
        actualStartAt: { gte: from, lte: to },
      },
      select: executionSelect,
      orderBy: [{ actualStartAt: "desc" }, { id: "asc" }],
    });
    return rows.map(toExecution);
  },

  async updateInProgressExecution(
    input: UpdateInProgressExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    return prisma.$transaction(async (transaction) => {
      const current = await findExecutionForMutation(
        transaction,
        input.id,
        input.masterRecordId,
      );
      assertExecutionInProgress(current.status);

      const data: Prisma.WorkoutExecutionUpdateManyMutationInput = {};
      let changedFields = 0;

      if (input.changes.actualStartAt !== undefined) {
        const actualStartAt = dateValue(
          input.changes.actualStartAt,
          "Início real",
        );
        if (current.actualEndAt) {
          assertEndAfterStart(actualStartAt, current.actualEndAt);
        }
        data.actualStartAt = actualStartAt;
        changedFields += 1;
      }
      if (input.changes.executedDurationSeconds !== undefined) {
        data.executedDurationSeconds = nullablePositiveDuration(
          input.changes.executedDurationSeconds,
          "Duração executada",
        );
        changedFields += 1;
      }
      if (input.changes.executedRpe !== undefined) {
        data.executedRpe = rpeValue(input.changes.executedRpe);
        changedFields += 1;
      }
      if (input.changes.notes !== undefined) {
        data.notes = input.changes.notes;
        changedFields += 1;
      }
      if (changedFields === 0) {
        invalidArgument("Informe ao menos um campo da execução para atualizar.");
      }

      const updated = await transaction.workoutExecution.updateMany({
        where: {
          id: current.id,
          masterRecordId: current.masterRecordId,
          status: PrismaWorkoutExecutionStatus.IN_PROGRESS,
        },
        data,
      });
      if (updated.count !== 1) {
        throw new PerformanceMonitoringRepositoryError(
          "CONFLICT",
          "A execução foi alterada por outra operação.",
        );
      }

      const result = await transaction.workoutExecution.findUniqueOrThrow({
        where: { id: current.id },
        select: executionSelect,
      });
      return toExecution(result);
    });
  },

  async completeExecution(
    input: CompleteExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    const actualEndAt = dateValue(input.actualEndAt, "Fim real");
    const executedDurationSeconds = positiveDuration(
      input.executedDurationSeconds,
      "Duração executada",
    );
    const executedRpe = rpeValue(input.executedRpe);

    return prisma.$transaction(async (transaction) => {
      const current = await findExecutionForMutation(
        transaction,
        input.id,
        input.masterRecordId,
      );
      assertExecutionInProgress(current.status);
      assertEndAfterStart(current.actualStartAt, actualEndAt);

      const updated = await transaction.workoutExecution.updateMany({
        where: {
          id: current.id,
          masterRecordId: current.masterRecordId,
          status: PrismaWorkoutExecutionStatus.IN_PROGRESS,
        },
        data: {
          actualEndAt,
          executedDurationSeconds,
          executedRpe,
          notes: input.notes,
          status: PrismaWorkoutExecutionStatus.COMPLETED,
        },
      });
      if (updated.count !== 1) {
        throw new PerformanceMonitoringRepositoryError(
          "CONFLICT",
          "A execução foi alterada por outra operação.",
        );
      }

      if (current.scheduledSessionId) {
        await transaction.workoutScheduledSession.updateMany({
          where: {
            id: current.scheduledSessionId,
            masterRecordId: current.masterRecordId,
            status: {
              in: [
                PrismaWorkoutScheduleStatus.SCHEDULED,
                PrismaWorkoutScheduleStatus.RESCHEDULED,
              ],
            },
          },
          data: {
            status: PrismaWorkoutScheduleStatus.COMPLETED,
            revision: { increment: 1 },
          },
        });
      }

      const result = await transaction.workoutExecution.findUniqueOrThrow({
        where: { id: current.id },
        select: executionSelect,
      });
      return toExecution(result);
    });
  },

  async cancelExecution(
    input: CancelExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    const actualEndAt = input.actualEndAt
      ? dateValue(input.actualEndAt, "Fim real")
      : undefined;
    const executedDurationSeconds = positiveDuration(
      input.executedDurationSeconds,
      "Duração executada",
    );

    return prisma.$transaction(async (transaction) => {
      const current = await findExecutionForMutation(
        transaction,
        input.id,
        input.masterRecordId,
      );
      assertExecutionInProgress(current.status);
      if (actualEndAt) assertEndAfterStart(current.actualStartAt, actualEndAt);

      const updated = await transaction.workoutExecution.updateMany({
        where: {
          id: current.id,
          masterRecordId: current.masterRecordId,
          status: PrismaWorkoutExecutionStatus.IN_PROGRESS,
        },
        data: {
          actualEndAt,
          executedDurationSeconds,
          notes: input.notes,
          status: PrismaWorkoutExecutionStatus.ABORTED,
        },
      });
      if (updated.count !== 1) {
        throw new PerformanceMonitoringRepositoryError(
          "CONFLICT",
          "A execução foi alterada por outra operação.",
        );
      }

      const result = await transaction.workoutExecution.findUniqueOrThrow({
        where: { id: current.id },
        select: executionSelect,
      });
      return toExecution(result);
    });
  },
};

export const workoutImportStore: WorkoutImportStore = {
  async importWorkouts(input): Promise<WorkoutImportResult> {
    const identifiers = input.workouts.map(
      (workout) => workout.externalIdentifier,
    );

    return prisma.$transaction(async (transaction) => {
      const masterRecord = await transaction.masterRecord.findFirst({
        where: { id: input.masterRecordId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!masterRecord) {
        throw new PerformanceMonitoringRepositoryError(
          "NOT_FOUND",
          "Prontuário ativo do aluno não encontrado.",
        );
      }

      const existing = await transaction.workoutExecution.findMany({
        where: {
          masterRecordId: input.masterRecordId,
          importProvider: "APPLE_HEALTH",
          importExternalIdentifier: { in: identifiers },
        },
        select: { importExternalIdentifier: true },
      });
      const duplicateIdentifiers = new Set(
        existing.flatMap((row) =>
          row.importExternalIdentifier ? [row.importExternalIdentifier] : [],
        ),
      );
      const newWorkouts = input.workouts.filter(
        (workout) => !duplicateIdentifiers.has(workout.externalIdentifier),
      );

      if (newWorkouts.length > 0) {
        await transaction.workoutExecution.createMany({
          data: newWorkouts.map((workout) => ({
            masterRecordId: input.masterRecordId,
            modality: workout.modality,
            source: PrismaWorkoutExecutionSource.FILE_IMPORT,
            actualStartAt: new Date(workout.startedAt),
            actualEndAt: workout.endedAt ? new Date(workout.endedAt) : null,
            executedDurationSeconds: workout.durationSeconds,
            distanceMeters: workout.distanceMeters,
            status: PrismaWorkoutExecutionStatus.COMPLETED,
            executorUserId: input.importedByUserId,
            importProvider: workout.provider,
            importExternalIdentifier: workout.externalIdentifier,
          })),
          skipDuplicates: true,
        });
      }

      const persisted = await transaction.workoutExecution.findMany({
        where: {
          masterRecordId: input.masterRecordId,
          importProvider: "APPLE_HEALTH",
          importExternalIdentifier: { in: identifiers },
        },
        select: { importExternalIdentifier: true },
      });
      const persistedIdentifiers = new Set(
        persisted.flatMap((row) =>
          row.importExternalIdentifier ? [row.importExternalIdentifier] : [],
        ),
      );

      return {
        importedIds: input.workouts
          .filter(
            (workout) =>
              !duplicateIdentifiers.has(workout.externalIdentifier) &&
              persistedIdentifiers.has(workout.externalIdentifier),
          )
          .map((workout) => workout.id),
        duplicateIds: input.workouts
          .filter((workout) =>
            duplicateIdentifiers.has(workout.externalIdentifier),
          )
          .map((workout) => workout.id),
      };
    });
  },
};
