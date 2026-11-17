import { Prisma } from "@/generated/prisma/client";

import type {
  CreateAndSettleFinancialEntryInput,
  CreateCostCenterInput,
  CreateFinancialAccountInput,
  CreateFinancialCategoryInput,
  CreateFinancialEntryInput,
  CreatePaymentMethodInput,
  FinancialEntryFilters,
  FinancialEntryView,
  FinancialSummary,
  RecordAcademyReceiptInput,
  SettleFinancialEntryInput,
  UpdateCostCenterInput,
  UpdateFinancialAccountInput,
  UpdateFinancialCategoryInput,
  UpdateFinancialEntryInput,
  UpdatePaymentMethodInput,
} from "./contracts";
import {
  ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE,
  FinancialError,
} from "./contracts";
import {
  financialRepository,
  type FinancialReferenceSnapshot,
  type FinancialRepository,
} from "./repository";

const ENTRY_TYPES = ["REVENUE", "EXPENSE"] as const;
const SOURCE_SYSTEMS = ["NEXTFIT", "CLINICA_SV", "GESTAO_SV"] as const;
const MANAGEMENT_NATURES = ["PLANNED", "FORECAST", "REALIZED"] as const;
const REFERENCE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
const ACCOUNT_TYPES = ["CASH", "BANK", "DIGITAL_WALLET", "OTHER"] as const;
const PAYMENT_METHOD_TYPES = [
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "BOLETO",
  "OTHER",
] as const;
const ENTRY_STATUSES = [
  "PENDING",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "CANCELLED",
] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACADEMY_RECEIPT_CATEGORY_CODE = "ACADEMIA_MENSALIDADES";
const ACADEMY_RECEIPT_ACCOUNT_BY_METHOD = {
  PIX: "NUBANK",
  BANK_TRANSFER: "NUBANK",
  DEBIT_CARD: "SUMUP",
  CREDIT_CARD: "SUMUP",
  CASH: "CAIXA_FISICO",
} as const;

function normalizedDate(value: string, fieldName: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new FinancialError("INVALID_DATE", `${fieldName} deve usar AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new FinancialError("INVALID_DATE", `${fieldName} é inválida.`);
  }
  return value;
}

function normalizedAmount(value: string | number) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new FinancialError("INVALID_AMOUNT", "Informe um valor financeiro válido.");
  }
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
    throw new FinancialError("INVALID_AMOUNT", "O valor deve ser maior que zero.");
  }
  if (amount.decimalPlaces() > 2) {
    throw new FinancialError("INVALID_AMOUNT", "O valor deve possuir no máximo duas casas decimais.");
  }
  return amount.toFixed(2);
}

function requiredText(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new FinancialError(
      "INVALID_DESCRIPTION",
      `${fieldName} é obrigatória.`,
    );
  }
  return normalized;
}

function normalizedReferenceCode(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (normalized.length < 2) {
    throw new FinancialError(
      "INVALID_REFERENCE_CODE",
      "Informe um código com pelo menos dois caracteres.",
    );
  }
  return normalized;
}

function normalizedReferenceName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 120);
  if (normalized.length < 2) {
    throw new FinancialError(
      "INVALID_REFERENCE_NAME",
      "Informe um nome com pelo menos dois caracteres.",
    );
  }
  return normalized;
}

function normalizedReferenceStatus(value: string) {
  if (!REFERENCE_STATUSES.includes(value as (typeof REFERENCE_STATUSES)[number])) {
    throw new FinancialError(
      "INVALID_REFERENCE_STATUS",
      "Situação do cadastro financeiro inválida.",
    );
  }
  return value as (typeof REFERENCE_STATUSES)[number];
}

async function assertActiveBusinessUnit(
  repository: FinancialRepository,
  businessUnitId: string,
) {
  const catalog = await repository.listCatalog();
  const unit = catalog.businessUnits.find((item) => item.id === businessUnitId);
  if (!unit) {
    throw new FinancialError(
      "BUSINESS_UNIT_NOT_FOUND",
      "Unidade empresarial não encontrada.",
    );
  }
  if (unit.status !== "ACTIVE") {
    throw new FinancialError("BUSINESS_UNIT_INACTIVE", "Unidade empresarial inativa.");
  }
}

function optionalText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.trim() || null;
}

function assertEntryType(value: string) {
  if (!ENTRY_TYPES.includes(value as (typeof ENTRY_TYPES)[number])) {
    throw new FinancialError("CATEGORY_TYPE_MISMATCH", "Tipo financeiro inválido.");
  }
}

function validateReferences(
  references: FinancialReferenceSnapshot,
  input: {
    readonly type: "REVENUE" | "EXPENSE";
    readonly businessUnitId: string;
    readonly costCenterId?: string;
    readonly financialAccountId?: string;
    readonly paymentMethodId?: string;
  },
) {
  if (!references.businessUnit) {
    throw new FinancialError("BUSINESS_UNIT_NOT_FOUND", "Unidade empresarial não encontrada.");
  }
  if (references.businessUnit.status !== "ACTIVE") {
    throw new FinancialError("BUSINESS_UNIT_INACTIVE", "Unidade empresarial inativa.");
  }
  if (!references.category) {
    throw new FinancialError("CATEGORY_NOT_FOUND", "Categoria financeira não encontrada.");
  }
  if (references.category.status !== "ACTIVE") {
    throw new FinancialError("CATEGORY_INACTIVE", "Categoria financeira inativa.");
  }
  if (references.category.type !== input.type) {
    throw new FinancialError(
      "CATEGORY_TYPE_MISMATCH",
      "A categoria não corresponde ao tipo do lançamento.",
    );
  }
  if (
    references.category.businessUnitId &&
    references.category.businessUnitId !== input.businessUnitId
  ) {
    throw new FinancialError(
      "CATEGORY_UNIT_MISMATCH",
      "A categoria pertence a outra unidade empresarial.",
    );
  }

  if (input.costCenterId && !references.costCenter) {
    throw new FinancialError("COST_CENTER_NOT_FOUND", "Centro de custo não encontrado.");
  }
  if (references.costCenter?.status === "INACTIVE") {
    throw new FinancialError("COST_CENTER_INACTIVE", "Centro de custo inativo.");
  }
  if (
    references.costCenter &&
    references.costCenter.businessUnitId !== input.businessUnitId
  ) {
    throw new FinancialError(
      "COST_CENTER_UNIT_MISMATCH",
      "O centro de custo pertence a outra unidade empresarial.",
    );
  }

  if (input.financialAccountId && !references.financialAccount) {
    throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta financeira não encontrada.");
  }
  if (references.financialAccount?.status === "INACTIVE") {
    throw new FinancialError("ACCOUNT_INACTIVE", "Conta financeira inativa.");
  }
  if (
    references.financialAccount &&
    references.businessUnit.code !== "PERSONAL" &&
    references.financialAccount.businessUnitId !== input.businessUnitId
  ) {
    throw new FinancialError(
      "ACCOUNT_UNIT_MISMATCH",
      "A conta financeira pertence a outra unidade empresarial.",
    );
  }

  if (input.paymentMethodId && !references.paymentMethod) {
    throw new FinancialError(
      "PAYMENT_METHOD_NOT_FOUND",
      "Forma de pagamento não encontrada.",
    );
  }
  if (references.paymentMethod?.status === "INACTIVE") {
    throw new FinancialError(
      "PAYMENT_METHOD_INACTIVE",
      "Forma de pagamento inativa.",
    );
  }
}

function validateFilters(filters: FinancialEntryFilters) {
  const normalized: FinancialEntryFilters = {
    ...filters,
    periodStart: filters.periodStart
      ? normalizedDate(filters.periodStart, "Data inicial")
      : undefined,
    periodEnd: filters.periodEnd
      ? normalizedDate(filters.periodEnd, "Data final")
      : undefined,
    competenceStart: filters.competenceStart
      ? normalizedDate(filters.competenceStart, "Competência inicial")
      : undefined,
    competenceEnd: filters.competenceEnd
      ? normalizedDate(filters.competenceEnd, "Competência final")
      : undefined,
  };

  if (
    normalized.periodStart &&
    normalized.periodEnd &&
    normalized.periodStart > normalized.periodEnd
  ) {
    throw new FinancialError("INVALID_PERIOD", "O período informado é inválido.");
  }
  if (
    normalized.competenceStart &&
    normalized.competenceEnd &&
    normalized.competenceStart > normalized.competenceEnd
  ) {
    throw new FinancialError("INVALID_PERIOD", "O período de competência é inválido.");
  }
  if (filters.type) assertEntryType(filters.type);
  if (
    filters.sourceSystem &&
    !SOURCE_SYSTEMS.includes(filters.sourceSystem)
  ) {
    throw new FinancialError(
      "INVALID_FINANCIAL_SOURCE",
      "Origem financeira inválida.",
    );
  }
  if (
    filters.managementNature &&
    !MANAGEMENT_NATURES.includes(filters.managementNature)
  ) {
    throw new FinancialError(
      "INVALID_MANAGEMENT_NATURE",
      "Natureza gerencial inválida.",
    );
  }
  if (
    filters.status &&
    !ENTRY_STATUSES.includes(filters.status as (typeof ENTRY_STATUSES)[number])
  ) {
    throw new FinancialError("INVALID_PERIOD", "Situação financeira inválida.");
  }
  return normalized;
}

function normalizeCreateInput(
  input: CreateFinancialEntryInput,
): CreateFinancialEntryInput {
  assertEntryType(input.type);
  return {
    ...input,
    managementNature: input.managementNature ?? "FORECAST",
    competence: normalizedDate(input.competence, "Competência"),
    dueDate: normalizedDate(input.dueDate, "Vencimento"),
    amount: normalizedAmount(input.amount),
    description: requiredText(input.description, "Descrição"),
    observation: optionalText(input.observation) ?? undefined,
    sourceType: optionalText(input.sourceType) ?? undefined,
    sourceId: optionalText(input.sourceId) ?? undefined,
  };
}

function normalizeSettlementInput(
  input: Omit<SettleFinancialEntryInput, "financialEntryId">,
) {
  const normalized = {
    ...input,
    amount: normalizedAmount(input.amount),
    settlementDate: normalizedDate(input.settlementDate, "Data da liquidação"),
    observation: optionalText(input.observation) ?? undefined,
    idempotencyKey: input.idempotencyKey.trim(),
  };
  if (!normalized.idempotencyKey) {
    throw new FinancialError(
      "INVALID_IDEMPOTENCY_KEY",
      "A chave de idempotência é obrigatória.",
    );
  }
  return normalized;
}

function assertSettlementAllowed(entry: {
  readonly managementNature: CreateFinancialEntryInput["managementNature"];
  readonly businessUnitCode: string;
  readonly type: CreateFinancialEntryInput["type"];
  readonly sourceSystem: CreateFinancialEntryInput["sourceSystem"];
  readonly origin: CreateFinancialEntryInput["origin"];
}) {
  if (entry.managementNature !== "REALIZED") {
    throw new FinancialError(
      "PLANNED_SETTLEMENT_NOT_ALLOWED",
      "Planejamento e previsão não podem ser liquidados.",
    );
  }
  if (
    entry.businessUnitCode === "ACADEMIA" &&
    (entry.type !== "EXPENSE" ||
      entry.sourceSystem !== "GESTAO_SV" ||
      entry.origin !== "MANUAL")
  ) {
    throw new FinancialError(
      "ACADEMY_SETTLEMENT_NOT_ALLOWED",
      "Somente despesas e retiradas manuais da Academia podem ser liquidadas.",
    );
  }
}

async function validateEntryReferences(
  repository: FinancialRepository,
  input: CreateFinancialEntryInput,
) {
  const references = await repository.getReferences(input);
  validateReferences(references, input);
  const unitCode = references.businessUnit!.code;
  const managementNature = input.managementNature ?? "FORECAST";
  const origin = input.origin ?? "MANUAL";
  const sourceSystem =
    input.sourceSystem ??
    (managementNature === "REALIZED" && unitCode === "CLINICA"
      ? "CLINICA_SV"
      : "GESTAO_SV");

  if (!MANAGEMENT_NATURES.includes(managementNature)) {
    throw new FinancialError(
      "INVALID_MANAGEMENT_NATURE",
      "Natureza gerencial inválida.",
    );
  }
  if (!SOURCE_SYSTEMS.includes(sourceSystem)) {
    throw new FinancialError(
      "INVALID_FINANCIAL_SOURCE",
      "Origem financeira inválida.",
    );
  }
  if (managementNature !== "REALIZED" && sourceSystem !== "GESTAO_SV") {
    throw new FinancialError(
      "INVALID_FINANCIAL_SOURCE",
      "Planejamento e previsão devem ter origem Gestão SV.",
    );
  }
  if (unitCode === "ACADEMIA" && input.type === "REVENUE") {
    if (
      sourceSystem !== "NEXTFIT" ||
      origin !== "EXTERNAL_IMPORT" ||
      managementNature !== "REALIZED"
    ) {
      throw new FinancialError(
        "ACADEMY_REVENUE_REQUIRES_NEXTFIT",
        "Receitas da Academia devem vir exclusivamente do NextFit.",
      );
    }
    if (
      !input.sourceType ||
      !input.sourceId ||
      !input.importBatchId
    ) {
      throw new FinancialError(
        "NEXTFIT_IMPORT_METADATA_REQUIRED",
        "Movimentação NextFit exige lote, tipo e identificador externo.",
      );
    }
  }
  if (unitCode === "ACADEMIA" && input.type === "EXPENSE") {
    if (
      sourceSystem !== "GESTAO_SV" ||
      origin !== "MANUAL" ||
      managementNature !== "REALIZED" ||
      input.importBatchId ||
      input.sourceType ||
      input.sourceId
    ) {
      throw new FinancialError(
        "ACADEMY_EXPENSE_REQUIRES_MANUAL_SOURCE",
        "Despesas e retiradas da Academia devem ser registradas manualmente no SAULO-AI.",
      );
    }
    if (
      references.category?.code === ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE &&
      references.category.type !== "EXPENSE"
    ) {
      throw new FinancialError(
        "CATEGORY_TYPE_MISMATCH",
        "Retirada do proprietário deve ser uma saída financeira.",
      );
    }
  }
  if (
    unitCode === "CLINICA" &&
    managementNature === "REALIZED" &&
    sourceSystem !== "CLINICA_SV"
  ) {
    throw new FinancialError(
      "CLINIC_REALIZED_SOURCE_MISMATCH",
      "Movimentação realizada da Clínica deve ter origem Clínica SV.",
    );
  }
  if (sourceSystem === "NEXTFIT" && unitCode !== "ACADEMIA") {
    throw new FinancialError(
      "INVALID_FINANCIAL_SOURCE",
      "NextFit só pode originar movimentações da Academia.",
    );
  }
  if (sourceSystem === "CLINICA_SV" && unitCode !== "CLINICA") {
    throw new FinancialError(
      "INVALID_FINANCIAL_SOURCE",
      "Clínica SV só pode originar movimentações da Clínica.",
    );
  }
  if (input.importBatchId) {
    if (!references.importBatch) {
      throw new FinancialError(
        "NEXTFIT_IMPORT_METADATA_REQUIRED",
        "Lote de importação não encontrado.",
      );
    }
    if (
      references.importBatch.sourceSystem !== sourceSystem ||
      references.importBatch.status === "FAILED" ||
      references.importBatch.status === "CANCELLED"
    ) {
      throw new FinancialError(
        "NEXTFIT_IMPORT_METADATA_REQUIRED",
        "O lote não é compatível com a origem do lançamento.",
      );
    }
  }
  return { ...input, sourceSystem, managementNature };
}

export function createFinancialService(
  repository: FinancialRepository = financialRepository,
) {
  return {
    async createCategory(input: CreateFinancialCategoryInput) {
      assertEntryType(input.type);
      if (input.businessUnitId) {
        await assertActiveBusinessUnit(repository, input.businessUnitId);
      }
      return repository.createCategory({
        ...input,
        code: normalizedReferenceCode(input.code),
        name: normalizedReferenceName(input.name),
      });
    },

    async updateCategory(id: string, input: UpdateFinancialCategoryInput) {
      return repository.updateCategory(id, {
        ...(input.code !== undefined
          ? { code: normalizedReferenceCode(input.code) }
          : {}),
        ...(input.name !== undefined
          ? { name: normalizedReferenceName(input.name) }
          : {}),
        ...(input.status !== undefined
          ? { status: normalizedReferenceStatus(input.status) }
          : {}),
      });
    },

    async createCostCenter(input: CreateCostCenterInput) {
      await assertActiveBusinessUnit(repository, input.businessUnitId);
      return repository.createCostCenter({
        ...input,
        code: normalizedReferenceCode(input.code),
        name: normalizedReferenceName(input.name),
      });
    },

    async updateCostCenter(id: string, input: UpdateCostCenterInput) {
      return repository.updateCostCenter(id, {
        ...(input.code !== undefined
          ? { code: normalizedReferenceCode(input.code) }
          : {}),
        ...(input.name !== undefined
          ? { name: normalizedReferenceName(input.name) }
          : {}),
        ...(input.status !== undefined
          ? { status: normalizedReferenceStatus(input.status) }
          : {}),
      });
    },

    async createAccount(input: CreateFinancialAccountInput) {
      if (!ACCOUNT_TYPES.includes(input.type)) {
        throw new FinancialError("INVALID_ACCOUNT_TYPE", "Tipo de conta inválido.");
      }
      await assertActiveBusinessUnit(repository, input.businessUnitId);
      return repository.createAccount({
        ...input,
        code: normalizedReferenceCode(input.code),
        name: normalizedReferenceName(input.name),
      });
    },

    async updateAccount(id: string, input: UpdateFinancialAccountInput) {
      return repository.updateAccount(id, {
        ...(input.code !== undefined
          ? { code: normalizedReferenceCode(input.code) }
          : {}),
        ...(input.name !== undefined
          ? { name: normalizedReferenceName(input.name) }
          : {}),
        ...(input.status !== undefined
          ? { status: normalizedReferenceStatus(input.status) }
          : {}),
      });
    },

    async createPaymentMethod(input: CreatePaymentMethodInput) {
      if (!PAYMENT_METHOD_TYPES.includes(input.type)) {
        throw new FinancialError(
          "INVALID_PAYMENT_METHOD_TYPE",
          "Tipo de forma de pagamento inválido.",
        );
      }
      return repository.createPaymentMethod({
        ...input,
        code: normalizedReferenceCode(input.code),
        name: normalizedReferenceName(input.name),
      });
    },

    async updatePaymentMethod(id: string, input: UpdatePaymentMethodInput) {
      return repository.updatePaymentMethod(id, {
        ...(input.code !== undefined
          ? { code: normalizedReferenceCode(input.code) }
          : {}),
        ...(input.name !== undefined
          ? { name: normalizedReferenceName(input.name) }
          : {}),
        ...(input.status !== undefined
          ? { status: normalizedReferenceStatus(input.status) }
          : {}),
      });
    },

    async create(input: CreateFinancialEntryInput): Promise<FinancialEntryView> {
      const normalized = normalizeCreateInput(input);
      const governed = await validateEntryReferences(repository, normalized);
      return repository.create(governed);
    },

    async createAndSettle(
      input: CreateAndSettleFinancialEntryInput,
    ): Promise<FinancialEntryView> {
      const normalizedEntry = normalizeCreateInput(input.entry);
      const governed = await validateEntryReferences(repository, normalizedEntry);
      const catalog = await repository.listCatalog();
      const businessUnit = catalog.businessUnits.find(
        (unit) => unit.id === governed.businessUnitId,
      );
      assertSettlementAllowed({
        managementNature: governed.managementNature,
        businessUnitCode: businessUnit?.code ?? "",
        type: governed.type,
        sourceSystem: governed.sourceSystem,
        origin: governed.origin ?? "MANUAL",
      });

      return repository.createAndSettle({
        entry: governed,
        settlement: normalizeSettlementInput(input.settlement),
      });
    },

    async findById(id: string): Promise<FinancialEntryView | null> {
      return repository.findById(id);
    },

    async list(
      filters: FinancialEntryFilters = {},
    ): Promise<readonly FinancialEntryView[]> {
      return repository.list(validateFilters(filters));
    },

    async update(
      id: string,
      input: UpdateFinancialEntryInput,
    ): Promise<FinancialEntryView> {
      const current = await repository.findById(id);
      if (!current) {
        throw new FinancialError("ENTRY_NOT_FOUND", "Lançamento financeiro não encontrado.");
      }
      if (current.status === "CANCELLED") {
        throw new FinancialError("ENTRY_CANCELLED", "Lançamento cancelado não pode ser alterado.");
      }

      const merged = normalizeCreateInput({
        type: input.type ?? current.type,
        competence: input.competence ?? current.competence,
        dueDate: input.dueDate ?? current.dueDate,
        amount: input.amount ?? current.amount,
        description: input.description ?? current.description,
        observation:
          input.observation === undefined
            ? current.observation
            : input.observation ?? undefined,
        businessUnitId: input.businessUnitId ?? current.businessUnit.id,
        financialCategoryId:
          input.financialCategoryId ?? current.financialCategory.id,
        costCenterId:
          input.costCenterId === undefined
            ? current.costCenter?.id
            : input.costCenterId ?? undefined,
        financialAccountId:
          input.financialAccountId === undefined
            ? current.financialAccount?.id
            : input.financialAccountId ?? undefined,
        paymentMethodId:
          input.paymentMethodId === undefined
            ? current.paymentMethod?.id
            : input.paymentMethodId ?? undefined,
        origin: current.origin,
        sourceType: current.sourceType,
        sourceId: current.sourceId,
        sourceSystem: current.sourceSystem,
        managementNature:
          input.managementNature ?? current.managementNature,
        importBatchId: current.importBatch?.id,
      });

      if (current.settlements.length > 0) {
        const changesFinancialIdentity =
          merged.type !== current.type ||
          merged.amount !== current.amount ||
          merged.businessUnitId !== current.businessUnit.id ||
          merged.financialCategoryId !== current.financialCategory.id ||
          merged.costCenterId !== current.costCenter?.id ||
          merged.financialAccountId !== current.financialAccount?.id ||
          merged.paymentMethodId !== current.paymentMethod?.id ||
          merged.managementNature !== current.managementNature;
        if (changesFinancialIdentity) {
          throw new FinancialError(
            "ENTRY_HAS_SETTLEMENTS",
            "A identidade financeira não pode ser alterada após uma liquidação.",
          );
        }
      }

      await validateEntryReferences(repository, merged);
      return repository.update(id, {
        ...input,
        ...(input.competence !== undefined
          ? { competence: merged.competence }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: merged.dueDate } : {}),
        ...(input.amount !== undefined ? { amount: merged.amount } : {}),
        ...(input.description !== undefined
          ? { description: merged.description }
          : {}),
        ...(input.observation !== undefined
          ? { observation: optionalText(input.observation) }
          : {}),
      });
    },

    async cancel(id: string): Promise<FinancialEntryView> {
      const entry = await repository.findById(id);
      if (!entry) {
        throw new FinancialError("ENTRY_NOT_FOUND", "Lançamento financeiro não encontrado.");
      }
      if (entry.status === "CANCELLED") return entry;
      if (entry.settlements.length > 0) {
        throw new FinancialError(
          "ENTRY_HAS_SETTLEMENTS",
          "Lançamento com liquidações exige estorno, ainda não modelado.",
        );
      }
      return repository.cancel(id);
    },

    async settle(input: SettleFinancialEntryInput): Promise<FinancialEntryView> {
      const entry = await repository.findById(input.financialEntryId);
      if (!entry) {
        throw new FinancialError(
          "ENTRY_NOT_FOUND",
          "Lançamento financeiro não encontrado.",
        );
      }
      if (entry.managementNature !== "REALIZED") {
        throw new FinancialError(
          "PLANNED_SETTLEMENT_NOT_ALLOWED",
          "Planejamento e previsão não podem ser liquidados.",
        );
      }
      if (
        entry.businessUnit.code === "ACADEMIA" &&
        (entry.type !== "EXPENSE" ||
          entry.sourceSystem !== "GESTAO_SV" ||
          entry.origin !== "MANUAL")
      ) {
        throw new FinancialError(
          "ACADEMY_SETTLEMENT_NOT_ALLOWED",
          "Somente despesas e retiradas manuais da Academia podem ser liquidadas.",
        );
      }
      const normalized: SettleFinancialEntryInput = {
        ...input,
        amount: normalizedAmount(input.amount),
        settlementDate: normalizedDate(input.settlementDate, "Data da liquidação"),
        observation: optionalText(input.observation) ?? undefined,
        idempotencyKey: input.idempotencyKey.trim(),
      };
      if (!normalized.idempotencyKey) {
        throw new FinancialError(
          "INVALID_IDEMPOTENCY_KEY",
          "A chave de idempotência é obrigatória.",
        );
      }
      return repository.settle(normalized);
    },

    async recordAcademyReceipt(
      input: RecordAcademyReceiptInput,
    ): Promise<FinancialEntryView> {
      const catalog = await repository.listCatalog();
      const unit = catalog.businessUnits.find(
        (item) => item.code === "ACADEMIA" && item.status === "ACTIVE",
      );
      const category = catalog.categories.find(
        (item) =>
          item.code === ACADEMY_RECEIPT_CATEGORY_CODE &&
          item.businessUnitId === unit?.id &&
          item.entryType === "REVENUE" &&
          item.status === "ACTIVE",
      );
      const paymentMethod = catalog.paymentMethods.find(
        (item) => item.id === input.paymentMethodId && item.status === "ACTIVE",
      );
      const expectedAccountCode = paymentMethod?.paymentMethodType
        ? ACADEMY_RECEIPT_ACCOUNT_BY_METHOD[
            paymentMethod.paymentMethodType as keyof typeof ACADEMY_RECEIPT_ACCOUNT_BY_METHOD
          ]
        : undefined;
      const account = catalog.financialAccounts.find(
        (item) =>
          item.id === input.financialAccountId &&
          item.businessUnitId === unit?.id &&
          item.status === "ACTIVE",
      );

      if (!unit) {
        throw new FinancialError("BUSINESS_UNIT_NOT_FOUND", "Academia ativa não encontrada.");
      }
      if (!category) {
        throw new FinancialError(
          "CATEGORY_NOT_FOUND",
          "Categoria institucional de recebimentos da Academia não encontrada.",
        );
      }
      if (!paymentMethod || !expectedAccountCode) {
        throw new FinancialError(
          "PAYMENT_METHOD_NOT_FOUND",
          "Forma de recebimento não permitida para a Academia.",
        );
      }
      if (!account) {
        throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta financeira não encontrada.");
      }
      if (account.code !== expectedAccountCode) {
        throw new FinancialError(
          "ACADEMY_RECEIPT_ACCOUNT_MISMATCH",
          "A conta financeira não corresponde à forma de recebimento.",
        );
      }

      const idempotencyKey = input.idempotencyKey.trim();
      if (!idempotencyKey) {
        throw new FinancialError(
          "INVALID_IDEMPOTENCY_KEY",
          "A chave de idempotência é obrigatória.",
        );
      }
      return repository.recordAcademyReceipt({
        receiptDate: normalizedDate(input.receiptDate, "Data do recebimento"),
        amount: normalizedAmount(input.amount),
        description: requiredText(input.description, "Descrição"),
        reference: optionalText(input.reference) ?? undefined,
        financialAccountId: account.id,
        paymentMethodId: paymentMethod.id,
        idempotencyKey,
        businessUnitId: unit.id,
        financialCategoryId: category.id,
      });
    },

    async summarize(
      filters: FinancialEntryFilters = {},
      asOf?: string,
    ): Promise<FinancialSummary> {
      const date = asOf
        ? new Date(`${normalizedDate(asOf, "Data de referência")}T00:00:00.000Z`)
        : new Date();
      return repository.aggregate(
        validateFilters({
          ...filters,
          managementNature: filters.managementNature ?? "REALIZED",
        }),
        date,
      );
    },

    async catalog() {
      return repository.listCatalog();
    },
  };
}

export const financialService = createFinancialService();
