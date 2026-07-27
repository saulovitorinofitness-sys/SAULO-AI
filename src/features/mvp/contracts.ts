import type { ConsultationType } from "@/modules/attendance";
import type { ContinuityStepStatus } from "@/modules/master-record";
import type {
  MaritalStatus,
  Patient,
  PatientSex,
  PatientStatus,
  PhoneType,
} from "@/modules/patients";
import type {
  AccessAction,
  PermissionGrant,
} from "@/modules/permissions";
import type {
  EntityId,
  ISODate,
  ISODateTime,
  ModuleKey,
} from "@/modules/shared";
import type { User } from "@/modules/users";

export type SessionUser = Pick<
  User,
  "id" | "fullName" | "email" | "status"
> & {
  readonly roleName: string;
};

export interface FrontendAccessSnapshot {
  readonly user: SessionUser;
  readonly grantsAllModules: boolean;
  readonly allowsNutritionModules: boolean;
  readonly overrides: readonly PermissionGrant[];
}

export type PatientWorkflowStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING_PROFESSIONAL"
  | "PENDING_REVIEW"
  | "COMPLETED";

export interface PatientListItem {
  readonly patient: Pick<
    Patient,
    "id" | "fullName" | "cpf" | "status"
  >;

  readonly code: string;
  readonly age: number;
  readonly primaryPhone: string;
  readonly mainObjective?: string;
  readonly lastAttendanceAt?: ISODateTime;
  readonly masterRecordId: EntityId;
  readonly openAttendanceId?: EntityId;
  readonly completionPercentage?: number;

  /**
   * Campo legado mantido enquanto o novo fluxo é implantado.
   */
  readonly nextPendingStep?: string;

  /**
   * Etapa em que o paciente se encontra dentro do atendimento atual.
   * Exemplo: Avaliação Física.
   */
  readonly currentStep?: string;

  /**
   * Profissional responsável pela próxima ação do atendimento.
   * Exemplo: Maria de Lourdes Gomes.
   */
  readonly currentResponsibleName?: string;

  /**
   * Etapa que será realizada após a etapa atual.
   */
  readonly nextStep?: string;

  /**
   * Situação geral do fluxo do paciente.
   */
  readonly workflowStatus?: PatientWorkflowStatus;

  /**
   * Quantidade total de etapas ainda pendentes.
   */
  readonly pendingStepsCount?: number;

  /**
   * Data da movimentação mais recente no fluxo.
   */
  readonly workflowUpdatedAt?: ISODateTime;
}

export interface ContinuityStepView {
  readonly id: EntityId;
  readonly key: string;
  readonly title: string;
  readonly moduleKey: ModuleKey;
  readonly status: ContinuityStepStatus;
  readonly completedAt?: ISODateTime;
}

export interface TimelineItemView {
  readonly id: EntityId;
  readonly title: string;
  readonly detail?: string;
  readonly occurredAt: ISODateTime;
  readonly actorName: string;
}

export interface MasterRecordSummaryView {
  readonly patient: PatientListItem;
  readonly birthDate: ISODate;
  readonly cpfMasked: string;
  readonly email: string;
  readonly alerts: readonly string[];
  readonly responsibleProfessionalName: string;
  readonly lastActivityAt?: ISODateTime;
  readonly lastConsultationType?: ConsultationType;
  readonly completedSteps: readonly ContinuityStepView[];
  readonly pendingSteps: readonly ContinuityStepView[];
  readonly nextSuggestedStep?: ContinuityStepView;
  readonly timeline: readonly TimelineItemView[];
}

export interface AttendanceContinuityView {
  readonly id: EntityId;
  readonly patientId: EntityId;
  readonly patientName: string;
  readonly masterRecordId: EntityId;
  readonly professionalName: string;
  readonly consultationType: ConsultationType;
  readonly lastCompletedStep?: ContinuityStepView;
  readonly pendingSteps: readonly ContinuityStepView[];
  readonly lastActivityAt?: ISODateTime;
}

export interface PatientSearchInput {
  readonly query?: string;
}

export interface SaveActivityInput {
  readonly attendanceId: EntityId;
  readonly stepId: EntityId;
  readonly note: string;
}

export interface SaveActivityResult {
  readonly savedAt: ISODateTime;
  readonly persisted: boolean;
}

export const patientSelectOptions: {
  sexes: readonly {
    value: PatientSex;
    label: string;
  }[];

  maritalStatuses: readonly {
    value: MaritalStatus;
    label: string;
  }[];

  phoneTypes: readonly {
    value: PhoneType;
    label: string;
  }[];

  statuses: Readonly<Record<PatientStatus, string>>;
} = {
  sexes: [
    {
      value: "FEMALE",
      label: "Feminino",
    },
    {
      value: "MALE",
      label: "Masculino",
    },
    {
      value: "INTERSEX",
      label: "Intersexo",
    },
    {
      value: "NOT_INFORMED",
      label: "Prefere não informar",
    },
  ],

  maritalStatuses: [
    {
      value: "SINGLE",
      label: "Solteiro(a)",
    },
    {
      value: "MARRIED",
      label: "Casado(a)",
    },
    {
      value: "DIVORCED",
      label: "Divorciado(a)",
    },
    {
      value: "WIDOWED",
      label: "Viúvo(a)",
    },
    {
      value: "SEPARATED",
      label: "Separado(a)",
    },
    {
      value: "DOMESTIC_PARTNERSHIP",
      label: "União estável",
    },
    {
      value: "NOT_INFORMED",
      label: "Prefere não informar",
    },
  ],

  phoneTypes: [
    {
      value: "MOBILE",
      label: "Celular",
    },
    {
      value: "HOME",
      label: "Residencial",
    },
    {
      value: "WORK",
      label: "Trabalho",
    },
    {
      value: "OTHER",
      label: "Outro",
    },
  ],

  statuses: {
    ACTIVE: "Ativo",
    INACTIVE: "Inativo",
    ARCHIVED: "Arquivado",
  },
};

export function canAccess(
  snapshot: FrontendAccessSnapshot,
  moduleKey: ModuleKey,
  action: AccessAction,
): boolean {
  const override = snapshot.overrides.find(
    (item) =>
      item.moduleKey === moduleKey &&
      item.action === action,
  );

  if (override) {
    return override.effect === "ALLOW";
  }

  if (
    (moduleKey === "MEAL_PLAN" ||
      moduleKey === "NUTRITION_STRATEGY" ||
      moduleKey === "NUTRITION_EVOLUTION") &&
    !snapshot.allowsNutritionModules
  ) {
    return false;
  }

  return snapshot.grantsAllModules;
}
