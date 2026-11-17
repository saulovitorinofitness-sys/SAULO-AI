import {
  canAccess,
  mvpService,
  type FrontendAccessSnapshot,
} from "@/features/mvp";
import type { AccessAction } from "@/modules/permissions";

import {
  PerformanceMonitoringRepositoryError,
  performanceMonitoringRepository,
  workoutImportStore,
  type CancelExecutionInput,
  type ChangeScheduledSessionStatusInput,
  type CompleteExecutionInput,
  type CreateManualExecutionInput,
  type CreateScheduledSessionInput,
  type PerformanceMonitoringDateRange,
  type PersistedWorkoutExecution,
  type PersistedWorkoutScheduledSession,
  type UpdateInProgressExecutionInput,
  type UpdateScheduledSessionChanges,
  type UpdateScheduledSessionInput,
} from "./repository";
import { AppleHealthWorkoutXmlError } from "./workout-import/apple-health-xml";
import {
  importSelectedAppleHealthWorkouts,
  previewAppleHealthWorkouts,
  WorkoutImportSelectionError,
} from "./workout-import/service";

export type PerformanceMonitoringServiceErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "NOT_FOUND"
  | "PERSISTENCE_ERROR";

export class PerformanceMonitoringServiceError extends Error {
  constructor(
    readonly code: PerformanceMonitoringServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PerformanceMonitoringServiceError";
  }
}

export type CreateScheduledSessionServiceInput = Omit<
  CreateScheduledSessionInput,
  "responsibleUserId"
>;

type EditableScheduledSessionChanges = Omit<
  UpdateScheduledSessionChanges,
  "responsibleUserId"
>;

export interface UpdateScheduledSessionServiceInput
  extends Omit<UpdateScheduledSessionInput, "changes"> {
  readonly changes: EditableScheduledSessionChanges;
}

type WithoutExecutor<T> = T extends { readonly executorUserId: string }
  ? Omit<T, "executorUserId">
  : never;

export type StartManualExecutionInput = WithoutExecutor<
  CreateManualExecutionInput
>;

export type StartExecutionFromScheduledSessionInput = Extract<
  StartManualExecutionInput,
  { readonly scheduledSessionId: string }
>;

export type StartSpontaneousExecutionInput = Extract<
  StartManualExecutionInput,
  { readonly scheduledSessionId?: undefined }
>;

async function resolveAuthorizedSession(
  action: AccessAction,
): Promise<FrontendAccessSnapshot> {
  let access: FrontendAccessSnapshot;

  try {
    access = await mvpService.getSession();
  } catch {
    throw new PerformanceMonitoringServiceError(
      "AUTHENTICATION_REQUIRED",
      "Sessão autenticada válida é obrigatória.",
    );
  }

  if (
    access.user.status !== "ACTIVE" ||
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "WORKOUT_PLAN", action)
  ) {
    throw new PerformanceMonitoringServiceError(
      "FORBIDDEN",
      "A sessão atual não possui permissão para esta operação de Performance.",
    );
  }

  return access;
}

function translatedRepositoryError(error: PerformanceMonitoringRepositoryError) {
  const codeByRepositoryError = {
    CONFLICT: "CONFLICT",
    IMMUTABLE: "INVALID_STATE",
    INVALID_ARGUMENT: "INVALID_INPUT",
    INVALID_STATE: "INVALID_STATE",
    NOT_FOUND: "NOT_FOUND",
  } as const satisfies Record<
    PerformanceMonitoringRepositoryError["code"],
    PerformanceMonitoringServiceErrorCode
  >;

  return new PerformanceMonitoringServiceError(
    codeByRepositoryError[error.code],
    error.message,
  );
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PerformanceMonitoringRepositoryError) {
      throw translatedRepositoryError(error);
    }

    const technicalCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    console.error(
      `[performance-monitoring.repository] persistence failure ${JSON.stringify({
        errorName: error instanceof Error ? error.name : typeof error,
        technicalCode: technicalCode ?? "UNAVAILABLE",
      })}`,
    );

    throw new PerformanceMonitoringServiceError(
      "PERSISTENCE_ERROR",
      "Não foi possível concluir a operação de monitoramento de Performance.",
    );
  }
}

function assertMasterRecordContext(
  actualMasterRecordId: string,
  expectedMasterRecordId: string,
) {
  if (actualMasterRecordId !== expectedMasterRecordId) {
    throw new PerformanceMonitoringServiceError(
      "NOT_FOUND",
      "Registro de Performance não encontrado no prontuário informado.",
    );
  }
}

async function authorizedScheduledSession(input: {
  readonly id: string;
  readonly masterRecordId: string;
}) {
  const scheduledSession = await repositoryOperation(() =>
    performanceMonitoringRepository.findScheduledSessionById(input.id),
  );

  if (!scheduledSession) {
    throw new PerformanceMonitoringServiceError(
      "NOT_FOUND",
      "Sessão programada não encontrada.",
    );
  }

  assertMasterRecordContext(
    scheduledSession.masterRecordId,
    input.masterRecordId,
  );
  return scheduledSession;
}

async function authorizedExecution(input: {
  readonly id: string;
  readonly masterRecordId: string;
}) {
  const execution = await repositoryOperation(() =>
    performanceMonitoringRepository.findExecutionById(input.id),
  );

  if (!execution) {
    throw new PerformanceMonitoringServiceError(
      "NOT_FOUND",
      "Execução de treino não encontrada.",
    );
  }

  assertMasterRecordContext(execution.masterRecordId, input.masterRecordId);
  return execution;
}

async function startManualExecutionForCurrentSession(
  input: StartManualExecutionInput,
): Promise<PersistedWorkoutExecution> {
  const access = await resolveAuthorizedSession("CREATE");

  if (input.scheduledSessionId !== undefined) {
    await authorizedScheduledSession({
      id: input.scheduledSessionId,
      masterRecordId: input.masterRecordId,
    });

    return repositoryOperation(() =>
      performanceMonitoringRepository.createManualExecution({
        masterRecordId: input.masterRecordId,
        scheduledSessionId: input.scheduledSessionId,
        actualStartAt: input.actualStartAt,
        executorUserId: access.user.id,
        notes: input.notes,
      }),
    );
  }

  if (input.workoutPlanEntryId !== undefined) {
    return repositoryOperation(() =>
      performanceMonitoringRepository.createManualExecution({
        masterRecordId: input.masterRecordId,
        modality: input.modality,
        workoutPlanEntryId: input.workoutPlanEntryId,
        workoutPlanVersionId: input.workoutPlanVersionId,
        sessionId: input.sessionId,
        actualStartAt: input.actualStartAt,
        executorUserId: access.user.id,
        notes: input.notes,
      }),
    );
  }

  return repositoryOperation(() =>
    performanceMonitoringRepository.createManualExecution({
      masterRecordId: input.masterRecordId,
      modality: input.modality,
      actualStartAt: input.actualStartAt,
      executorUserId: access.user.id,
      notes: input.notes,
    }),
  );
}

export const performanceMonitoringService = {
  async previewAppleHealthImport(xml: string) {
    await resolveAuthorizedSession("READ");
    try {
      return previewAppleHealthWorkouts(xml);
    } catch (error) {
      if (error instanceof AppleHealthWorkoutXmlError) {
        throw new PerformanceMonitoringServiceError(
          "INVALID_INPUT",
          error.message,
        );
      }
      throw error;
    }
  },

  async importAppleHealthWorkouts(input: {
    readonly xml: string;
    readonly selectedIds: readonly string[];
    readonly masterRecordId: string;
  }) {
    const access = await resolveAuthorizedSession("CREATE");
    try {
      return await importSelectedAppleHealthWorkouts(
        { ...input, importedByUserId: access.user.id },
        workoutImportStore,
      );
    } catch (error) {
      if (error instanceof PerformanceMonitoringRepositoryError) {
        throw translatedRepositoryError(error);
      }
      if (
        error instanceof AppleHealthWorkoutXmlError ||
        error instanceof WorkoutImportSelectionError
      ) {
        throw new PerformanceMonitoringServiceError(
          "INVALID_INPUT",
          error.message,
        );
      }
      throw new PerformanceMonitoringServiceError(
        "PERSISTENCE_ERROR",
        "Não foi possível importar os treinos.",
      );
    }
  },

  async createScheduledSession(
    input: CreateScheduledSessionServiceInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    const access = await resolveAuthorizedSession("CREATE");

    return repositoryOperation(() =>
      performanceMonitoringRepository.createScheduledSession({
        ...input,
        responsibleUserId: access.user.id,
      }),
    );
  },

  async getScheduledSession(input: {
    readonly id: string;
    readonly masterRecordId: string;
  }): Promise<PersistedWorkoutScheduledSession> {
    await resolveAuthorizedSession("READ");
    return authorizedScheduledSession(input);
  },

  async listCalendar(
    masterRecordId: string,
    range: PerformanceMonitoringDateRange,
  ): Promise<readonly PersistedWorkoutScheduledSession[]> {
    await resolveAuthorizedSession("READ");
    return repositoryOperation(() =>
      performanceMonitoringRepository.listScheduledSessions(
        masterRecordId,
        range,
      ),
    );
  },

  async updateScheduledSession(
    input: UpdateScheduledSessionServiceInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedScheduledSession(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.updateScheduledSession(input),
    );
  },

  async changeScheduledSessionStatus(
    input: ChangeScheduledSessionStatusInput,
  ): Promise<PersistedWorkoutScheduledSession> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedScheduledSession(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.changeScheduledSessionStatus(input),
    );
  },

  async cancelScheduledSession(
    input: Omit<ChangeScheduledSessionStatusInput, "status">,
  ): Promise<PersistedWorkoutScheduledSession> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedScheduledSession(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.cancelScheduledSession(input),
    );
  },

  async startManualExecution(
    input: StartManualExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    return startManualExecutionForCurrentSession(input);
  },

  async startExecutionFromScheduledSession(
    input: StartExecutionFromScheduledSessionInput,
  ): Promise<PersistedWorkoutExecution> {
    return startManualExecutionForCurrentSession(input);
  },

  async startSpontaneousExecution(
    input: StartSpontaneousExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    return startManualExecutionForCurrentSession(input);
  },

  async getExecution(input: {
    readonly id: string;
    readonly masterRecordId: string;
  }): Promise<PersistedWorkoutExecution> {
    await resolveAuthorizedSession("READ");
    return authorizedExecution(input);
  },

  async listExecutionHistory(
    masterRecordId: string,
    range: PerformanceMonitoringDateRange,
  ): Promise<readonly PersistedWorkoutExecution[]> {
    await resolveAuthorizedSession("READ");
    return repositoryOperation(() =>
      performanceMonitoringRepository.listExecutions(masterRecordId, range),
    );
  },

  async updateInProgressExecution(
    input: UpdateInProgressExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedExecution(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.updateInProgressExecution(input),
    );
  },

  async completeExecution(
    input: CompleteExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedExecution(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.completeExecution(input),
    );
  },

  async cancelExecution(
    input: CancelExecutionInput,
  ): Promise<PersistedWorkoutExecution> {
    await resolveAuthorizedSession("UPDATE");
    await authorizedExecution(input);

    return repositoryOperation(() =>
      performanceMonitoringRepository.cancelExecution(input),
    );
  },
};
