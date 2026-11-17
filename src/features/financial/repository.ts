import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  CreateCostCenterInput,
  CreateAndSettleFinancialEntryInput,
  CreateFinancialAccountInput,
  CreateFinancialCategoryInput,
  CreateFinancialEntryInput,
  CreatePaymentMethodInput,
  FinancialCatalog,
  FinancialCatalogItem,
  FinancialEntryFilters,
  FinancialEntryView,
  RecordAcademyReceiptInput,
  FinancialSummary,
  FinancialUnitResult,
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

const financialEntryInclude = {
  businessUnit: { select: { id: true, code: true, name: true } },
  financialCategory: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  financialAccount: { select: { id: true, code: true, name: true } },
  paymentMethod: { select: { id: true, code: true, name: true } },
  importBatch: {
    select: {
      id: true,
      sourceSystem: true,
      competence: true,
      fileName: true,
      fileHash: true,
      importedAt: true,
      importedByUserId: true,
      status: true,
      externalId: true,
    },
  },
  settlements: {
    include: {
      financialAccount: { select: { id: true, code: true, name: true } },
      paymentMethod: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ settlementDate: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.FinancialEntryInclude;

type FinancialEntryRecord = Prisma.FinancialEntryGetPayload<{
  include: typeof financialEntryInclude;
}>;

export interface FinancialReferenceSnapshot {
  readonly businessUnit: {
    readonly id: string;
    readonly code: string;
    readonly status: "ACTIVE" | "INACTIVE";
  } | null;
  readonly category: {
    readonly id: string;
    readonly code: string;
    readonly type: "REVENUE" | "EXPENSE";
    readonly businessUnitId: string | null;
    readonly status: "ACTIVE" | "INACTIVE";
  } | null;
  readonly costCenter: {
    readonly id: string;
    readonly businessUnitId: string;
    readonly status: "ACTIVE" | "INACTIVE";
  } | null;
  readonly financialAccount: {
    readonly id: string;
    readonly businessUnitId: string;
    readonly status: "ACTIVE" | "INACTIVE";
  } | null;
  readonly paymentMethod: {
    readonly id: string;
    readonly status: "ACTIVE" | "INACTIVE";
  } | null;
  readonly importBatch: {
    readonly id: string;
    readonly sourceSystem: "NEXTFIT" | "CLINICA_SV" | "GESTAO_SV";
    readonly status: "PENDING" | "VALIDATED" | "IMPORTED" | "FAILED" | "CANCELLED";
  } | null;
}

export interface FinancialRepository {
  createCategory(input: CreateFinancialCategoryInput): Promise<FinancialCatalogItem>;
  updateCategory(id: string, input: UpdateFinancialCategoryInput): Promise<FinancialCatalogItem>;
  createCostCenter(input: CreateCostCenterInput): Promise<FinancialCatalogItem>;
  updateCostCenter(id: string, input: UpdateCostCenterInput): Promise<FinancialCatalogItem>;
  createAccount(input: CreateFinancialAccountInput): Promise<FinancialCatalogItem>;
  updateAccount(id: string, input: UpdateFinancialAccountInput): Promise<FinancialCatalogItem>;
  createPaymentMethod(input: CreatePaymentMethodInput): Promise<FinancialCatalogItem>;
  updatePaymentMethod(id: string, input: UpdatePaymentMethodInput): Promise<FinancialCatalogItem>;
  create(input: CreateFinancialEntryInput): Promise<FinancialEntryView>;
  createAndSettle(
    input: CreateAndSettleFinancialEntryInput,
  ): Promise<FinancialEntryView>;
  findById(id: string): Promise<FinancialEntryView | null>;
  list(filters?: FinancialEntryFilters): Promise<readonly FinancialEntryView[]>;
  update(id: string, input: UpdateFinancialEntryInput): Promise<FinancialEntryView>;
  cancel(id: string): Promise<FinancialEntryView>;
  settle(input: SettleFinancialEntryInput): Promise<FinancialEntryView>;
  recordAcademyReceipt(
    input: RecordAcademyReceiptInput & {
      readonly businessUnitId: string;
      readonly financialCategoryId: string;
    },
  ): Promise<FinancialEntryView>;
  aggregate(filters?: FinancialEntryFilters, asOf?: Date): Promise<FinancialSummary>;
  getReferences(input: {
    readonly businessUnitId: string;
    readonly financialCategoryId: string;
    readonly costCenterId?: string;
    readonly financialAccountId?: string;
    readonly paymentMethodId?: string;
    readonly importBatchId?: string;
  }): Promise<FinancialReferenceSnapshot>;
  listCatalog(): Promise<FinancialCatalog>;
}

async function translateReferenceConflict<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FinancialError(
        "DUPLICATE_REFERENCE_CODE",
        "Já existe um cadastro financeiro com este código no mesmo escopo.",
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new FinancialError(
        "REFERENCE_NOT_FOUND",
        "Cadastro financeiro não encontrado.",
      );
    }
    throw error;
  }
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function nullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toView(entry: FinancialEntryRecord): FinancialEntryView {
  const settledAmount = entry.settlements.reduce(
    (total, settlement) => total.plus(settlement.amount),
    new Prisma.Decimal(0),
  );

  return {
    id: entry.id,
    type: entry.type,
    competence: isoDate(entry.competence),
    dueDate: isoDate(entry.dueDate),
    amount: money(entry.amount),
    settledAmount: money(settledAmount),
    remainingAmount: money(entry.amount.minus(settledAmount)),
    description: entry.description,
    observation: entry.observation ?? undefined,
    status: entry.status,
    origin: entry.origin,
    sourceSystem: entry.sourceSystem,
    managementNature: entry.managementNature,
    sourceType: entry.sourceType ?? undefined,
    sourceId: entry.sourceId ?? undefined,
    importBatch: entry.importBatch
      ? {
          ...entry.importBatch,
          competence: isoDate(entry.importBatch.competence),
          importedAt: entry.importBatch.importedAt.toISOString(),
          externalId: entry.importBatch.externalId ?? undefined,
        }
      : undefined,
    businessUnit: entry.businessUnit,
    financialCategory: entry.financialCategory,
    costCenter: entry.costCenter ?? undefined,
    financialAccount: entry.financialAccount ?? undefined,
    paymentMethod: entry.paymentMethod ?? undefined,
    settlements: entry.settlements.map((settlement) => ({
      id: settlement.id,
      amount: money(settlement.amount),
      settlementDate: isoDate(settlement.settlementDate),
      financialAccount: settlement.financialAccount,
      paymentMethod: settlement.paymentMethod,
      observation: settlement.observation ?? undefined,
      idempotencyKey: settlement.idempotencyKey,
      createdAt: settlement.createdAt.toISOString(),
    })),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function financialEntryWhere(
  filters: FinancialEntryFilters = {},
): Prisma.FinancialEntryWhereInput {
  return {
    ...(filters.businessUnitId
      ? { businessUnitId: filters.businessUnitId }
      : {}),
    ...(filters.financialCategoryId
      ? { financialCategoryId: filters.financialCategoryId }
      : {}),
    ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.sourceSystem ? { sourceSystem: filters.sourceSystem } : {}),
    ...(filters.managementNature
      ? { managementNature: filters.managementNature }
      : {}),
    ...(filters.periodStart || filters.periodEnd
      ? {
          dueDate: {
            ...(filters.periodStart ? { gte: dateOnly(filters.periodStart) } : {}),
            ...(filters.periodEnd ? { lte: dateOnly(filters.periodEnd) } : {}),
          },
        }
      : {}),
    ...(filters.competenceStart || filters.competenceEnd
      ? {
          competence: {
            ...(filters.competenceStart
              ? { gte: dateOnly(filters.competenceStart) }
              : {}),
            ...(filters.competenceEnd
              ? { lte: dateOnly(filters.competenceEnd) }
              : {}),
          },
        }
      : {}),
    ...(filters.financialAccountId
      ? {
          OR: [
            { financialAccountId: filters.financialAccountId },
            {
              settlements: {
                some: { financialAccountId: filters.financialAccountId },
              },
            },
          ],
        }
      : {}),
  };
}

interface SummaryAccumulator {
  businessUnitId: string;
  businessUnitCode: string;
  totalReceivable: Prisma.Decimal;
  totalReceived: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  ownerWithdrawal: Prisma.Decimal;
  ownerWithdrawalPaid: Prisma.Decimal;
  overdueReceivable: Prisma.Decimal;
  overduePayable: Prisma.Decimal;
}

function emptyAccumulator(
  businessUnitId = "CONSOLIDATED",
  businessUnitCode = "GRUPO_SV",
): SummaryAccumulator {
  return {
    businessUnitId,
    businessUnitCode,
    totalReceivable: new Prisma.Decimal(0),
    totalReceived: new Prisma.Decimal(0),
    totalPayable: new Prisma.Decimal(0),
    totalPaid: new Prisma.Decimal(0),
    ownerWithdrawal: new Prisma.Decimal(0),
    ownerWithdrawalPaid: new Prisma.Decimal(0),
    overdueReceivable: new Prisma.Decimal(0),
    overduePayable: new Prisma.Decimal(0),
  };
}

function addEntryToSummary(
  accumulator: SummaryAccumulator,
  entry: FinancialEntryView,
  asOfDate: string,
) {
  if (entry.status === "CANCELLED") return;
  if (entry.managementNature !== "REALIZED") return;

  const amount = new Prisma.Decimal(entry.amount);
  const settled = new Prisma.Decimal(entry.settledAmount);
  const remaining = amount.minus(settled);
  const overdue = entry.dueDate < asOfDate && remaining.greaterThan(0);

  if (entry.type === "REVENUE") {
    accumulator.totalReceivable = accumulator.totalReceivable.plus(amount);
    accumulator.totalReceived = accumulator.totalReceived.plus(settled);
    if (overdue) {
      accumulator.overdueReceivable =
        accumulator.overdueReceivable.plus(remaining);
    }
    return;
  }

  if (entry.financialCategory.code === ACADEMY_OWNER_WITHDRAWAL_CATEGORY_CODE) {
    accumulator.ownerWithdrawal = accumulator.ownerWithdrawal.plus(amount);
    accumulator.ownerWithdrawalPaid = accumulator.ownerWithdrawalPaid.plus(settled);
    return;
  }

  accumulator.totalPayable = accumulator.totalPayable.plus(amount);
  accumulator.totalPaid = accumulator.totalPaid.plus(settled);
  if (overdue) {
    accumulator.overduePayable = accumulator.overduePayable.plus(remaining);
  }
}

function toUnitResult(accumulator: SummaryAccumulator): FinancialUnitResult {
  const openReceivable = accumulator.totalReceivable.minus(
    accumulator.totalReceived,
  );
  const openPayable = accumulator.totalPayable.minus(accumulator.totalPaid);
  const ownerWithdrawalOpen = accumulator.ownerWithdrawal.minus(
    accumulator.ownerWithdrawalPaid,
  );

  return {
    businessUnitId: accumulator.businessUnitId,
    businessUnitCode: accumulator.businessUnitCode,
    totalReceivable: money(openReceivable),
    totalReceived: money(accumulator.totalReceived),
    totalPayable: money(openPayable),
    totalPaid: money(accumulator.totalPaid),
    ownerWithdrawal: money(accumulator.ownerWithdrawal),
    ownerWithdrawalPaid: money(accumulator.ownerWithdrawalPaid),
    ownerWithdrawalOpen: money(ownerWithdrawalOpen),
    accrualRevenue: money(accumulator.totalReceivable),
    accrualExpense: money(accumulator.totalPayable),
    overdueReceivable: money(accumulator.overdueReceivable),
    overduePayable: money(accumulator.overduePayable),
    openReceivable: money(openReceivable),
    openPayable: money(openPayable),
    openBalance: money(openReceivable.minus(openPayable).minus(ownerWithdrawalOpen)),
    realizedBalance: money(
      accumulator.totalReceived
        .minus(accumulator.totalPaid)
        .minus(accumulator.ownerWithdrawalPaid),
    ),
    accrualResult: money(
      accumulator.totalReceivable.minus(accumulator.totalPayable),
    ),
  };
}

export function buildFinancialSummary(
  entries: readonly FinancialEntryView[],
  asOf: Date,
): FinancialSummary {
  const consolidated = emptyAccumulator();
  const units = new Map<string, SummaryAccumulator>();
  const asOfDate = isoDate(asOf);

  for (const entry of entries) {
    let unit = units.get(entry.businessUnit.id);
    if (!unit) {
      unit = emptyAccumulator(entry.businessUnit.id, entry.businessUnit.code);
      units.set(entry.businessUnit.id, unit);
    }
    addEntryToSummary(unit, entry, asOfDate);
    addEntryToSummary(consolidated, entry, asOfDate);
  }

  const accountBalances = buildFinancialAccountBalances(entries);
  const totalAvailable = accountBalances
    .filter((account) => ["NUBANK", "SUMUP", "CAIXA_FISICO"].includes(account.financialAccount.code))
    .reduce(
      (total, account) => total.plus(account.realizedBalance),
      new Prisma.Decimal(0),
    );

  const totals = toUnitResult(consolidated);
  return {
    totalReceivable: totals.totalReceivable,
    totalReceived: totals.totalReceived,
    totalPayable: totals.totalPayable,
    totalPaid: totals.totalPaid,
    ownerWithdrawal: totals.ownerWithdrawal,
    ownerWithdrawalPaid: totals.ownerWithdrawalPaid,
    ownerWithdrawalOpen: totals.ownerWithdrawalOpen,
    accrualRevenue: totals.accrualRevenue,
    accrualExpense: totals.accrualExpense,
    overdueReceivable: totals.overdueReceivable,
    overduePayable: totals.overduePayable,
    overdueTotal: money(
      consolidated.overdueReceivable.plus(consolidated.overduePayable),
    ),
    openReceivable: totals.openReceivable,
    openPayable: totals.openPayable,
    openBalance: totals.openBalance,
    realizedBalance: totals.realizedBalance,
    accrualResult: totals.accrualResult,
    accountBalances,
    totalAvailable: money(totalAvailable),
    byBusinessUnit: [...units.values()]
      .sort((left, right) =>
        left.businessUnitCode.localeCompare(right.businessUnitCode),
      )
      .map(toUnitResult),
  };
}

export function buildFinancialAccountBalances(
  entries: readonly FinancialEntryView[],
): FinancialSummary["accountBalances"] {
  const accounts = new Map<string, {
    financialAccount: FinancialEntryView["settlements"][number]["financialAccount"];
    totalReceived: Prisma.Decimal;
    totalPaid: Prisma.Decimal;
  }>();

  for (const entry of entries) {
    if (entry.status === "CANCELLED" || entry.managementNature !== "REALIZED") continue;
    for (const settlement of entry.settlements) {
      const current = accounts.get(settlement.financialAccount.id) ?? {
        financialAccount: settlement.financialAccount,
        totalReceived: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
      };
      const amount = new Prisma.Decimal(settlement.amount);
      if (entry.type === "REVENUE") {
        current.totalReceived = current.totalReceived.plus(amount);
      } else {
        current.totalPaid = current.totalPaid.plus(amount);
      }
      accounts.set(settlement.financialAccount.id, current);
    }
  }

  return [...accounts.values()]
    .sort((left, right) => left.financialAccount.code.localeCompare(right.financialAccount.code))
    .map((account) => ({
      financialAccount: account.financialAccount,
      totalReceived: money(account.totalReceived),
      totalPaid: money(account.totalPaid),
      realizedBalance: money(account.totalReceived.minus(account.totalPaid)),
    }));
}

export function calculateSettlementState(
  entryAmountInput: string | Prisma.Decimal,
  settledAmountInput: string | Prisma.Decimal,
  settlementAmountInput: string | Prisma.Decimal,
) {
  const entryAmount = new Prisma.Decimal(entryAmountInput);
  const settledAmount = new Prisma.Decimal(settledAmountInput);
  const settlementAmount = new Prisma.Decimal(settlementAmountInput);
  const remainingBefore = entryAmount.minus(settledAmount);

  if (settlementAmount.lessThanOrEqualTo(0)) {
    throw new FinancialError("INVALID_AMOUNT", "O valor deve ser maior que zero.");
  }
  if (settlementAmount.greaterThan(remainingBefore)) {
    throw new FinancialError(
      "SETTLEMENT_EXCEEDS_BALANCE",
      "O valor da liquidação é superior ao saldo do lançamento.",
    );
  }

  const totalSettled = settledAmount.plus(settlementAmount);
  return {
    totalSettled: money(totalSettled),
    remainingAmount: money(entryAmount.minus(totalSettled)),
    status: totalSettled.equals(entryAmount)
      ? ("SETTLED" as const)
      : ("PARTIALLY_SETTLED" as const),
  };
}

async function findRecord(id: string) {
  return prisma.financialEntry.findUnique({
    where: { id },
    include: financialEntryInclude,
  });
}

export const financialRepository: FinancialRepository = {
  async createCategory(input) {
    return translateReferenceConflict(async () => {
      const category = await prisma.financialCategory.create({
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          businessUnitId: input.businessUnitId,
        },
      });
      return {
        id: category.id,
        code: category.code,
        name: category.name,
        status: category.status,
        businessUnitId: category.businessUnitId ?? undefined,
        entryType: category.type,
      };
    });
  },

  async updateCategory(id, input) {
    return translateReferenceConflict(async () => {
      const category = await prisma.financialCategory.update({
        where: { id },
        data: input,
      });
      return {
        id: category.id,
        code: category.code,
        name: category.name,
        status: category.status,
        businessUnitId: category.businessUnitId ?? undefined,
        entryType: category.type,
      };
    });
  },

  async createCostCenter(input) {
    return translateReferenceConflict(async () => {
      const costCenter = await prisma.costCenter.create({ data: input });
      return {
        id: costCenter.id,
        code: costCenter.code,
        name: costCenter.name,
        status: costCenter.status,
        businessUnitId: costCenter.businessUnitId,
      };
    });
  },

  async updateCostCenter(id, input) {
    return translateReferenceConflict(async () => {
      const costCenter = await prisma.costCenter.update({
        where: { id },
        data: input,
      });
      return {
        id: costCenter.id,
        code: costCenter.code,
        name: costCenter.name,
        status: costCenter.status,
        businessUnitId: costCenter.businessUnitId,
      };
    });
  },

  async createAccount(input) {
    return translateReferenceConflict(async () => {
      const account = await prisma.financialAccount.create({ data: input });
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        status: account.status,
        businessUnitId: account.businessUnitId,
        accountType: account.type,
      };
    });
  },

  async updateAccount(id, input) {
    return translateReferenceConflict(async () => {
      const account = await prisma.financialAccount.update({
        where: { id },
        data: input,
      });
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        status: account.status,
        businessUnitId: account.businessUnitId,
        accountType: account.type,
      };
    });
  },

  async createPaymentMethod(input) {
    return translateReferenceConflict(async () => {
      const paymentMethod = await prisma.paymentMethod.create({ data: input });
      return {
        id: paymentMethod.id,
        code: paymentMethod.code,
        name: paymentMethod.name,
        status: paymentMethod.status,
        paymentMethodType: paymentMethod.type,
      };
    });
  },

  async updatePaymentMethod(id, input) {
    return translateReferenceConflict(async () => {
      const paymentMethod = await prisma.paymentMethod.update({
        where: { id },
        data: input,
      });
      return {
        id: paymentMethod.id,
        code: paymentMethod.code,
        name: paymentMethod.name,
        status: paymentMethod.status,
        paymentMethodType: paymentMethod.type,
      };
    });
  },

  async create(input) {
    const entry = await prisma.financialEntry.create({
      data: {
        type: input.type,
        competence: dateOnly(input.competence),
        dueDate: dateOnly(input.dueDate),
        amount: new Prisma.Decimal(input.amount),
        description: input.description.trim(),
        observation: nullableText(input.observation),
        origin: input.origin ?? "MANUAL",
        sourceSystem: input.sourceSystem ?? "GESTAO_SV",
        managementNature: input.managementNature ?? "FORECAST",
        sourceType: nullableText(input.sourceType),
        sourceId: nullableText(input.sourceId),
        importBatchId: input.importBatchId,
        businessUnitId: input.businessUnitId,
        financialCategoryId: input.financialCategoryId,
        costCenterId: input.costCenterId,
        financialAccountId: input.financialAccountId,
        paymentMethodId: input.paymentMethodId,
      },
      include: financialEntryInclude,
    });
    return toView(entry);
  },

  async createAndSettle(input) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${input.settlement.idempotencyKey}))
        `;

        const settlementDate = dateOnly(input.settlement.settlementDate);
        const settlementAmount = new Prisma.Decimal(input.settlement.amount);
        const existing = await transaction.financialSettlement.findUnique({
          where: { idempotencyKey: input.settlement.idempotencyKey },
          include: {
            financialEntry: { include: financialEntryInclude },
          },
        });

        if (existing) {
          const entry = existing.financialEntry;
          const sameOperation =
            existing.amount.equals(settlementAmount) &&
            existing.settlementDate.getTime() === settlementDate.getTime() &&
            existing.financialAccountId === input.settlement.financialAccountId &&
            existing.paymentMethodId === input.settlement.paymentMethodId &&
            entry.type === input.entry.type &&
            entry.competence.getTime() === dateOnly(input.entry.competence).getTime() &&
            entry.dueDate.getTime() === dateOnly(input.entry.dueDate).getTime() &&
            entry.amount.equals(new Prisma.Decimal(input.entry.amount)) &&
            entry.description === input.entry.description.trim() &&
            entry.observation === (nullableText(input.entry.observation) ?? null) &&
            entry.origin === (input.entry.origin ?? "MANUAL") &&
            entry.sourceSystem === (input.entry.sourceSystem ?? "GESTAO_SV") &&
            entry.managementNature === (input.entry.managementNature ?? "FORECAST") &&
            entry.sourceType === (nullableText(input.entry.sourceType) ?? null) &&
            entry.sourceId === (nullableText(input.entry.sourceId) ?? null) &&
            entry.importBatchId === (input.entry.importBatchId ?? null) &&
            entry.businessUnitId === input.entry.businessUnitId &&
            entry.financialCategoryId === input.entry.financialCategoryId &&
            entry.costCenterId === (input.entry.costCenterId ?? null) &&
            entry.financialAccountId ===
              (input.entry.financialAccountId ?? null) &&
            entry.paymentMethodId === (input.entry.paymentMethodId ?? null);

          if (!sameOperation) {
            throw new FinancialError(
              "IDEMPOTENCY_CONFLICT",
              "A chave de idempotência já identifica outra criação com liquidação.",
            );
          }

          return toView(entry);
        }

        const [businessUnit, account, paymentMethod] = await Promise.all([
          transaction.businessUnit.findUnique({
            where: { id: input.entry.businessUnitId },
            select: { code: true },
          }),
          transaction.financialAccount.findUnique({
            where: { id: input.settlement.financialAccountId },
            select: { id: true, businessUnitId: true, status: true },
          }),
          transaction.paymentMethod.findUnique({
            where: { id: input.settlement.paymentMethodId },
            select: { id: true, status: true },
          }),
        ]);

        if (!account) {
          throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta financeira não encontrada.");
        }
        if (account.status !== "ACTIVE") {
          throw new FinancialError("ACCOUNT_INACTIVE", "Conta financeira inativa.");
        }
        if (
          businessUnit?.code !== "PERSONAL" &&
          account.businessUnitId !== input.entry.businessUnitId
        ) {
          throw new FinancialError(
            "ACCOUNT_UNIT_MISMATCH",
            "A conta financeira pertence a outra unidade empresarial.",
          );
        }
        if (!paymentMethod) {
          throw new FinancialError(
            "PAYMENT_METHOD_NOT_FOUND",
            "Forma de pagamento não encontrada.",
          );
        }
        if (paymentMethod.status !== "ACTIVE") {
          throw new FinancialError(
            "PAYMENT_METHOD_INACTIVE",
            "Forma de pagamento inativa.",
          );
        }

        const settlementState = calculateSettlementState(
          String(input.entry.amount),
          "0",
          settlementAmount,
        );
        const entry = await transaction.financialEntry.create({
          data: {
            type: input.entry.type,
            competence: dateOnly(input.entry.competence),
            dueDate: dateOnly(input.entry.dueDate),
            amount: new Prisma.Decimal(input.entry.amount),
            description: input.entry.description.trim(),
            observation: nullableText(input.entry.observation),
            status: settlementState.status,
            origin: input.entry.origin ?? "MANUAL",
            sourceSystem: input.entry.sourceSystem ?? "GESTAO_SV",
            managementNature: input.entry.managementNature ?? "FORECAST",
            sourceType: nullableText(input.entry.sourceType),
            sourceId: nullableText(input.entry.sourceId),
            importBatchId: input.entry.importBatchId,
            businessUnitId: input.entry.businessUnitId,
            financialCategoryId: input.entry.financialCategoryId,
            costCenterId: input.entry.costCenterId,
            financialAccountId: input.entry.financialAccountId,
            paymentMethodId: input.entry.paymentMethodId,
            settlements: {
              create: {
                amount: settlementAmount,
                settlementDate,
                financialAccountId: input.settlement.financialAccountId,
                paymentMethodId: input.settlement.paymentMethodId,
                observation: nullableText(input.settlement.observation),
                idempotencyKey: input.settlement.idempotencyKey,
              },
            },
          },
          include: financialEntryInclude,
        });

        return toView(entry);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async findById(id) {
    const entry = await findRecord(id);
    return entry ? toView(entry) : null;
  },

  async list(filters = {}) {
    const entries = await prisma.financialEntry.findMany({
      where: financialEntryWhere(filters),
      include: financialEntryInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    return entries.map(toView);
  },

  async update(id, input) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${id}))
        `;
        const current = await transaction.financialEntry.findUnique({
          where: { id },
          include: financialEntryInclude,
        });
        if (!current) {
          throw new FinancialError(
            "ENTRY_NOT_FOUND",
            "Lançamento financeiro não encontrado.",
          );
        }
        if (current.status === "CANCELLED") {
          throw new FinancialError(
            "ENTRY_CANCELLED",
            "Lançamento cancelado não pode ser alterado.",
          );
        }
        if (current.settlements.length > 0) {
          const changesFinancialIdentity =
            (input.type !== undefined && input.type !== current.type) ||
            (input.amount !== undefined &&
              !current.amount.equals(new Prisma.Decimal(input.amount))) ||
            (input.businessUnitId !== undefined &&
              input.businessUnitId !== current.businessUnitId) ||
            (input.financialCategoryId !== undefined &&
              input.financialCategoryId !== current.financialCategoryId) ||
            (input.costCenterId !== undefined &&
              input.costCenterId !== current.costCenterId) ||
            (input.financialAccountId !== undefined &&
              input.financialAccountId !== current.financialAccountId) ||
            (input.paymentMethodId !== undefined &&
              input.paymentMethodId !== current.paymentMethodId) ||
            (input.managementNature !== undefined &&
              input.managementNature !== current.managementNature);
          if (changesFinancialIdentity) {
            throw new FinancialError(
              "ENTRY_HAS_SETTLEMENTS",
              "A identidade financeira não pode ser alterada após uma liquidação.",
            );
          }
        }

        const entry = await transaction.financialEntry.update({
          where: { id },
          data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.competence !== undefined
          ? { competence: dateOnly(input.competence) }
          : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: dateOnly(input.dueDate) }
          : {}),
        ...(input.amount !== undefined
          ? { amount: new Prisma.Decimal(input.amount) }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() }
          : {}),
        ...(input.observation !== undefined
          ? { observation: nullableText(input.observation) }
          : {}),
        ...(input.businessUnitId !== undefined
          ? { businessUnitId: input.businessUnitId }
          : {}),
        ...(input.financialCategoryId !== undefined
          ? { financialCategoryId: input.financialCategoryId }
          : {}),
        ...(input.costCenterId !== undefined
          ? { costCenterId: input.costCenterId }
          : {}),
        ...(input.financialAccountId !== undefined
          ? { financialAccountId: input.financialAccountId }
          : {}),
        ...(input.paymentMethodId !== undefined
          ? { paymentMethodId: input.paymentMethodId }
          : {}),
        ...(input.managementNature !== undefined
          ? { managementNature: input.managementNature }
          : {}),
          },
          include: financialEntryInclude,
        });
        return toView(entry);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async cancel(id) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${id}))
        `;
        const current = await transaction.financialEntry.findUnique({
          where: { id },
          include: financialEntryInclude,
        });
        if (!current) {
          throw new FinancialError(
            "ENTRY_NOT_FOUND",
            "Lançamento financeiro não encontrado.",
          );
        }
        if (current.status === "CANCELLED") return toView(current);
        if (current.settlements.length > 0) {
          throw new FinancialError(
            "ENTRY_HAS_SETTLEMENTS",
            "Lançamento com liquidações exige estorno, ainda não modelado.",
          );
        }
        const entry = await transaction.financialEntry.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: financialEntryInclude,
        });
        return toView(entry);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async settle(input) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${input.financialEntryId}))
        `;
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))
        `;

        const entry = await transaction.financialEntry.findUnique({
          where: { id: input.financialEntryId },
          include: financialEntryInclude,
        });
        if (!entry) {
          throw new FinancialError(
            "ENTRY_NOT_FOUND",
            "Lançamento financeiro não encontrado.",
          );
        }

        const settlementDate = dateOnly(input.settlementDate);
        const settlementAmount = new Prisma.Decimal(input.amount);
        const existing = await transaction.financialSettlement.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          const sameOperation =
            existing.financialEntryId === input.financialEntryId &&
            existing.amount.equals(settlementAmount) &&
            existing.settlementDate.getTime() === settlementDate.getTime() &&
            existing.financialAccountId === input.financialAccountId &&
            existing.paymentMethodId === input.paymentMethodId;

          if (!sameOperation) {
            throw new FinancialError(
              "IDEMPOTENCY_CONFLICT",
              "A chave de idempotência já identifica outra liquidação.",
            );
          }

          return toView(entry);
        }

        if (entry.status === "CANCELLED") {
          throw new FinancialError(
            "ENTRY_CANCELLED",
            "Lançamento cancelado não pode ser liquidado.",
          );
        }
        if (entry.status === "SETTLED") {
          throw new FinancialError(
            "ENTRY_ALREADY_SETTLED",
            "Lançamento já está integralmente liquidado.",
          );
        }

        const [account, paymentMethod, settled] = await Promise.all([
          transaction.financialAccount.findUnique({
            where: { id: input.financialAccountId },
            select: { id: true, businessUnitId: true, status: true },
          }),
          transaction.paymentMethod.findUnique({
            where: { id: input.paymentMethodId },
            select: { id: true, status: true },
          }),
          transaction.financialSettlement.aggregate({
            where: { financialEntryId: entry.id },
            _sum: { amount: true },
          }),
        ]);

        if (!account) {
          throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta financeira não encontrada.");
        }
        if (account.status !== "ACTIVE") {
          throw new FinancialError("ACCOUNT_INACTIVE", "Conta financeira inativa.");
        }
        if (
          entry.businessUnit.code !== "PERSONAL" &&
          account.businessUnitId !== entry.businessUnitId
        ) {
          throw new FinancialError(
            "ACCOUNT_UNIT_MISMATCH",
            "A conta financeira pertence a outra unidade empresarial.",
          );
        }
        if (!paymentMethod) {
          throw new FinancialError(
            "PAYMENT_METHOD_NOT_FOUND",
            "Forma de pagamento não encontrada.",
          );
        }
        if (paymentMethod.status !== "ACTIVE") {
          throw new FinancialError(
            "PAYMENT_METHOD_INACTIVE",
            "Forma de pagamento inativa.",
          );
        }

        const settledBefore = settled._sum.amount ?? new Prisma.Decimal(0);
        const settlementState = calculateSettlementState(
          entry.amount,
          settledBefore,
          settlementAmount,
        );

        await transaction.financialSettlement.create({
          data: {
            financialEntryId: entry.id,
            amount: settlementAmount,
            settlementDate,
            financialAccountId: input.financialAccountId,
            paymentMethodId: input.paymentMethodId,
            observation: nullableText(input.observation),
            idempotencyKey: input.idempotencyKey,
          },
        });

        const updated = await transaction.financialEntry.update({
          where: { id: entry.id },
          data: { status: settlementState.status },
          include: financialEntryInclude,
        });
        return toView(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async recordAcademyReceipt(input) {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))
        `;

        const existing = await transaction.financialEntry.findUnique({
          where: {
            businessUnitId_sourceType_sourceId: {
              businessUnitId: input.businessUnitId,
              sourceType: "ACADEMIA_RECEBIMENTO_REAL",
              sourceId: input.idempotencyKey,
            },
          },
          include: financialEntryInclude,
        });
        if (existing) {
          const existingSettlement = existing.settlements[0];
          const sameOperation =
            existing.amount.equals(new Prisma.Decimal(input.amount)) &&
            isoDate(existing.dueDate) === input.receiptDate &&
            existing.description === input.description &&
            existingSettlement?.financialAccountId === input.financialAccountId &&
            existingSettlement.paymentMethodId === input.paymentMethodId;
          if (!sameOperation) {
            throw new FinancialError(
              "IDEMPOTENCY_CONFLICT",
              "A chave de idempotência já identifica outro recebimento.",
            );
          }
          return toView(existing);
        }

        const [unit, category, account, paymentMethod] = await Promise.all([
          transaction.businessUnit.findUnique({
            where: { id: input.businessUnitId },
            select: { code: true, status: true },
          }),
          transaction.financialCategory.findUnique({
            where: { id: input.financialCategoryId },
            select: { type: true, businessUnitId: true, status: true },
          }),
          transaction.financialAccount.findUnique({
            where: { id: input.financialAccountId },
            select: { businessUnitId: true, status: true },
          }),
          transaction.paymentMethod.findUnique({
            where: { id: input.paymentMethodId },
            select: { status: true },
          }),
        ]);
        if (!unit || unit.code !== "ACADEMIA" || unit.status !== "ACTIVE") {
          throw new FinancialError("BUSINESS_UNIT_NOT_FOUND", "Academia ativa não encontrada.");
        }
        if (
          !category ||
          category.type !== "REVENUE" ||
          category.businessUnitId !== input.businessUnitId ||
          category.status !== "ACTIVE"
        ) {
          throw new FinancialError("CATEGORY_NOT_FOUND", "Categoria de recebimento não encontrada.");
        }
        if (!account) {
          throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta financeira não encontrada.");
        }
        if (account.status !== "ACTIVE") {
          throw new FinancialError("ACCOUNT_INACTIVE", "Conta financeira inativa.");
        }
        if (account.businessUnitId !== input.businessUnitId) {
          throw new FinancialError("ACCOUNT_UNIT_MISMATCH", "A conta pertence a outra unidade.");
        }
        if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
          throw new FinancialError("PAYMENT_METHOD_NOT_FOUND", "Forma de recebimento não encontrada.");
        }

        const receiptDate = dateOnly(input.receiptDate);
        const amount = new Prisma.Decimal(input.amount);
        const created = await transaction.financialEntry.create({
          data: {
            type: "REVENUE",
            competence: receiptDate,
            dueDate: receiptDate,
            amount,
            description: input.description,
            observation: nullableText(input.reference),
            status: "SETTLED",
            origin: "MANUAL",
            sourceSystem: "GESTAO_SV",
            managementNature: "REALIZED",
            sourceType: "ACADEMIA_RECEBIMENTO_REAL",
            sourceId: input.idempotencyKey,
            businessUnitId: input.businessUnitId,
            financialCategoryId: input.financialCategoryId,
            settlements: {
              create: {
                amount,
                settlementDate: receiptDate,
                financialAccountId: input.financialAccountId,
                paymentMethodId: input.paymentMethodId,
                observation: nullableText(input.reference),
                idempotencyKey: input.idempotencyKey,
              },
            },
          },
          include: financialEntryInclude,
        });
        return toView(created);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async aggregate(filters = {}, asOf = new Date()) {
    const entries = await this.list(filters);
    return buildFinancialSummary(entries, asOf);
  },

  async getReferences(input) {
    const [
      businessUnit,
      category,
      costCenter,
      financialAccount,
      paymentMethod,
      importBatch,
    ] =
      await Promise.all([
        prisma.businessUnit.findUnique({
          where: { id: input.businessUnitId },
          select: { id: true, code: true, status: true },
        }),
        prisma.financialCategory.findUnique({
          where: { id: input.financialCategoryId },
          select: { id: true, code: true, type: true, businessUnitId: true, status: true },
        }),
        input.costCenterId
          ? prisma.costCenter.findUnique({
              where: { id: input.costCenterId },
              select: { id: true, businessUnitId: true, status: true },
            })
          : Promise.resolve(null),
        input.financialAccountId
          ? prisma.financialAccount.findUnique({
              where: { id: input.financialAccountId },
              select: { id: true, businessUnitId: true, status: true },
            })
          : Promise.resolve(null),
        input.paymentMethodId
          ? prisma.paymentMethod.findUnique({
              where: { id: input.paymentMethodId },
              select: { id: true, status: true },
            })
          : Promise.resolve(null),
        input.importBatchId
          ? prisma.financialImportBatch.findUnique({
              where: { id: input.importBatchId },
              select: { id: true, sourceSystem: true, status: true },
            })
          : Promise.resolve(null),
      ]);

    return {
      businessUnit,
      category,
      costCenter,
      financialAccount,
      paymentMethod,
      importBatch,
    };
  },

  async listCatalog() {
    const [businessUnits, categories, costCenters, financialAccounts, paymentMethods] =
      await Promise.all([
        prisma.businessUnit.findMany({
          select: { id: true, code: true, name: true, status: true },
          orderBy: { name: "asc" },
        }),
        prisma.financialCategory.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            type: true,
            businessUnitId: true,
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        }),
        prisma.costCenter.findMany({
          select: { id: true, code: true, name: true, status: true, businessUnitId: true },
          orderBy: { name: "asc" },
        }),
        prisma.financialAccount.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            type: true,
            businessUnitId: true,
          },
          orderBy: { name: "asc" },
        }),
        prisma.paymentMethod.findMany({
          select: { id: true, code: true, name: true, status: true, type: true },
          orderBy: { name: "asc" },
        }),
      ]);

    return {
      businessUnits,
      categories: categories.map(({ type, ...category }) => ({
        ...category,
        businessUnitId: category.businessUnitId ?? undefined,
        entryType: type,
      })),
      costCenters,
      financialAccounts: financialAccounts.map(({ type, ...account }) => ({
        ...account,
        accountType: type,
      })),
      paymentMethods: paymentMethods.map(({ type, ...method }) => ({
        ...method,
        paymentMethodType: type,
      })),
    };
  },
};
