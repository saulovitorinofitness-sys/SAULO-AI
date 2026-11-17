import type {
  FinancialAccountType,
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialImportBatchStatus,
  FinancialManagementNature,
  FinancialReferenceStatus,
  FinancialSourceSystem,
  PaymentMethodType,
} from "@/generated/prisma/client";

export type {
  FinancialAccountType,
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialImportBatchStatus,
  FinancialManagementNature,
  FinancialReferenceStatus,
  FinancialSourceSystem,
  PaymentMethodType,
} from "@/generated/prisma/client";

export type FinancialAmountInput = string | number;

export const ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE =
  "ACADEMIA_RETIRADA_PROPRIETARIO" as const;

export interface CreateFinancialCategoryInput {
  readonly code: string;
  readonly name: string;
  readonly type: FinancialEntryType;
  readonly businessUnitId?: string;
}

export interface UpdateFinancialCategoryInput {
  readonly code?: string;
  readonly name?: string;
  readonly status?: FinancialReferenceStatus;
}

export interface CreateCostCenterInput {
  readonly code: string;
  readonly name: string;
  readonly businessUnitId: string;
}

export interface UpdateCostCenterInput {
  readonly code?: string;
  readonly name?: string;
  readonly status?: FinancialReferenceStatus;
}

export interface CreateFinancialAccountInput {
  readonly code: string;
  readonly name: string;
  readonly type: FinancialAccountType;
  readonly businessUnitId: string;
}

export interface UpdateFinancialAccountInput {
  readonly code?: string;
  readonly name?: string;
  readonly status?: FinancialReferenceStatus;
}

export interface CreatePaymentMethodInput {
  readonly code: string;
  readonly name: string;
  readonly type: PaymentMethodType;
}

export interface UpdatePaymentMethodInput {
  readonly code?: string;
  readonly name?: string;
  readonly status?: FinancialReferenceStatus;
}

export interface CreateFinancialEntryInput {
  readonly type: FinancialEntryType;
  readonly competence: string;
  readonly dueDate: string;
  readonly amount: FinancialAmountInput;
  readonly description: string;
  readonly observation?: string;
  readonly businessUnitId: string;
  readonly financialCategoryId: string;
  readonly costCenterId?: string;
  readonly financialAccountId?: string;
  readonly paymentMethodId?: string;
  readonly origin?: FinancialEntryOrigin;
  readonly sourceSystem?: FinancialSourceSystem;
  readonly managementNature?: FinancialManagementNature;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly importBatchId?: string;
}

export interface UpdateFinancialEntryInput {
  readonly type?: FinancialEntryType;
  readonly competence?: string;
  readonly dueDate?: string;
  readonly amount?: FinancialAmountInput;
  readonly description?: string;
  readonly observation?: string | null;
  readonly businessUnitId?: string;
  readonly financialCategoryId?: string;
  readonly costCenterId?: string | null;
  readonly financialAccountId?: string | null;
  readonly paymentMethodId?: string | null;
  readonly managementNature?: FinancialManagementNature;
}

export interface FinancialEntryFilters {
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly competenceStart?: string;
  readonly competenceEnd?: string;
  readonly businessUnitId?: string;
  readonly financialCategoryId?: string;
  readonly costCenterId?: string;
  readonly financialAccountId?: string;
  readonly status?: FinancialEntryStatus;
  readonly type?: FinancialEntryType;
  readonly sourceSystem?: FinancialSourceSystem;
  readonly managementNature?: FinancialManagementNature;
}

export interface SettleFinancialEntryInput {
  readonly financialEntryId: string;
  readonly amount: FinancialAmountInput;
  readonly settlementDate: string;
  readonly financialAccountId: string;
  readonly paymentMethodId: string;
  readonly observation?: string;
  readonly idempotencyKey: string;
}

export interface CreateAndSettleFinancialEntryInput {
  readonly entry: CreateFinancialEntryInput;
  readonly settlement: Omit<SettleFinancialEntryInput, "financialEntryId">;
}

export interface RecordAcademyReceiptInput {
  readonly receiptDate: string;
  readonly amount: FinancialAmountInput;
  readonly description: string;
  readonly reference?: string;
  readonly financialAccountId: string;
  readonly paymentMethodId: string;
  readonly idempotencyKey: string;
}

export interface FinancialSettlementView {
  readonly id: string;
  readonly amount: string;
  readonly settlementDate: string;
  readonly financialAccount: FinancialReferenceView;
  readonly paymentMethod: FinancialReferenceView;
  readonly observation?: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export interface FinancialReferenceView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FinancialImportBatchView {
  readonly id: string;
  readonly sourceSystem: FinancialSourceSystem;
  readonly competence: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly importedAt: string;
  readonly importedByUserId: string;
  readonly status: FinancialImportBatchStatus;
  readonly externalId?: string;
}

export interface FinancialCatalogItem extends FinancialReferenceView {
  readonly status: FinancialReferenceStatus;
  readonly businessUnitId?: string;
  readonly entryType?: FinancialEntryType;
  readonly accountType?: FinancialAccountType;
  readonly paymentMethodType?: PaymentMethodType;
}

export interface FinancialCatalog {
  readonly businessUnits: readonly FinancialCatalogItem[];
  readonly categories: readonly FinancialCatalogItem[];
  readonly costCenters: readonly FinancialCatalogItem[];
  readonly financialAccounts: readonly FinancialCatalogItem[];
  readonly paymentMethods: readonly FinancialCatalogItem[];
}

export interface FinancialEntryView {
  readonly id: string;
  readonly type: FinancialEntryType;
  readonly competence: string;
  readonly dueDate: string;
  readonly amount: string;
  readonly settledAmount: string;
  readonly remainingAmount: string;
  readonly description: string;
  readonly observation?: string;
  readonly status: FinancialEntryStatus;
  readonly origin: FinancialEntryOrigin;
  readonly sourceSystem: FinancialSourceSystem;
  readonly managementNature: FinancialManagementNature;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly importBatch?: FinancialImportBatchView;
  readonly businessUnit: FinancialReferenceView;
  readonly financialCategory: FinancialReferenceView;
  readonly costCenter?: FinancialReferenceView;
  readonly financialAccount?: FinancialReferenceView;
  readonly paymentMethod?: FinancialReferenceView;
  readonly settlements: readonly FinancialSettlementView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FinancialUnitResult {
  readonly businessUnitId: string;
  readonly businessUnitCode: string;
  readonly totalReceivable: string;
  readonly totalReceived: string;
  readonly totalPayable: string;
  readonly totalPaid: string;
  readonly ownerWithdrawal: string;
  readonly ownerWithdrawalPaid: string;
  readonly ownerWithdrawalOpen: string;
  readonly accrualRevenue: string;
  readonly accrualExpense: string;
  readonly overdueReceivable: string;
  readonly overduePayable: string;
  readonly openReceivable: string;
  readonly openPayable: string;
  readonly openBalance: string;
  readonly realizedBalance: string;
  readonly accrualResult: string;
}

export interface FinancialSummary {
  readonly totalReceivable: string;
  readonly totalReceived: string;
  readonly totalPayable: string;
  readonly totalPaid: string;
  readonly ownerWithdrawal: string;
  readonly ownerWithdrawalPaid: string;
  readonly ownerWithdrawalOpen: string;
  readonly accrualRevenue: string;
  readonly accrualExpense: string;
  readonly overdueReceivable: string;
  readonly overduePayable: string;
  readonly overdueTotal: string;
  readonly openReceivable: string;
  readonly openPayable: string;
  readonly openBalance: string;
  readonly realizedBalance: string;
  readonly accrualResult: string;
  readonly accountBalances: readonly {
    readonly financialAccount: FinancialReferenceView;
    readonly totalReceived: string;
    readonly totalPaid: string;
    readonly realizedBalance: string;
  }[];
  readonly totalAvailable: string;
  readonly byBusinessUnit: readonly FinancialUnitResult[];
}

export type FinancialErrorCode =
  | "BUSINESS_UNIT_NOT_FOUND"
  | "BUSINESS_UNIT_INACTIVE"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_INACTIVE"
  | "CATEGORY_TYPE_MISMATCH"
  | "CATEGORY_UNIT_MISMATCH"
  | "COST_CENTER_NOT_FOUND"
  | "COST_CENTER_INACTIVE"
  | "COST_CENTER_UNIT_MISMATCH"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_UNIT_MISMATCH"
  | "ACADEMY_RECEIPT_ACCOUNT_MISMATCH"
  | "PAYMENT_METHOD_NOT_FOUND"
  | "PAYMENT_METHOD_INACTIVE"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_CANCELLED"
  | "ENTRY_ALREADY_SETTLED"
  | "ENTRY_HAS_SETTLEMENTS"
  | "INVALID_AMOUNT"
  | "INVALID_DATE"
  | "INVALID_PERIOD"
  | "INVALID_DESCRIPTION"
  | "INVALID_IDEMPOTENCY_KEY"
  | "SETTLEMENT_EXCEEDS_BALANCE"
  | "IDEMPOTENCY_CONFLICT"
  | "REFERENCE_NOT_FOUND"
  | "INVALID_REFERENCE_CODE"
  | "INVALID_REFERENCE_NAME"
  | "INVALID_REFERENCE_STATUS"
  | "INVALID_ACCOUNT_TYPE"
  | "INVALID_PAYMENT_METHOD_TYPE"
  | "DUPLICATE_REFERENCE_CODE"
  | "INVALID_FINANCIAL_SOURCE"
  | "INVALID_MANAGEMENT_NATURE"
  | "ACADEMY_REVENUE_REQUIRES_NEXTFIT"
  | "ACADEMY_EXPENSE_REQUIRES_MANUAL_SOURCE"
  | "NEXTFIT_IMPORT_METADATA_REQUIRED"
  | "CLINIC_REALIZED_SOURCE_MISMATCH"
  | "PLANNED_SETTLEMENT_NOT_ALLOWED"
  | "ACADEMY_SETTLEMENT_NOT_ALLOWED";

export class FinancialError extends Error {
  constructor(
    readonly code: FinancialErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FinancialError";
  }
}
