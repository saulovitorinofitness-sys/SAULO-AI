import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateAndSettleFinancialEntryInput,
  CreateCostCenterInput,
  CreateFinancialAccountInput,
  CreateFinancialCategoryInput,
  CreateFinancialEntryInput,
  CreatePaymentMethodInput,
  FinancialEntryFilters,
  FinancialEntryView,
  SettleFinancialEntryInput,
  UpdateFinancialCategoryInput,
  UpdateFinancialEntryInput,
} from "./contracts";
import { FinancialError } from "./contracts";
import {
  buildFinancialSummary,
  calculateSettlementState,
  type FinancialReferenceSnapshot,
  type FinancialRepository,
} from "./repository";
import { createFinancialService } from "./service";

const IDS = {
  academy: "10000000-0000-4000-8000-000000000001",
  clinic: "10000000-0000-4000-8000-000000000002",
  personal: "10000000-0000-4000-8000-000000000003",
  academyRevenue: "20000000-0000-4000-8000-000000000001",
  clinicExpense: "20000000-0000-4000-8000-000000000002",
  clinicRevenue: "20000000-0000-4000-8000-000000000003",
  academyExpense: "20000000-0000-4000-8000-000000000004",
  academyOwnerWithdrawal: "20000000-0000-4000-8000-000000000005",
  personalRevenue: "20000000-0000-4000-8000-000000000006",
  academyCostCenter: "30000000-0000-4000-8000-000000000001",
  clinicCostCenter: "30000000-0000-4000-8000-000000000002",
  academyAccount: "40000000-0000-4000-8000-000000000001",
  academySumup: "40000000-0000-4000-8000-000000000002",
  academyPhysicalCash: "40000000-0000-4000-8000-000000000003",
  academyLegacyAccount: "40000000-0000-4000-8000-000000000004",
  clinicAccount: "40000000-0000-4000-8000-000000000005",
  pix: "50000000-0000-4000-8000-000000000001",
  debit: "50000000-0000-4000-8000-000000000002",
  credit: "50000000-0000-4000-8000-000000000003",
  cash: "50000000-0000-4000-8000-000000000004",
  nextfitBatch: "60000000-0000-4000-8000-000000000001",
} as const;

const references = {
  businessUnits: {
    [IDS.academy]: { id: IDS.academy, code: "ACADEMIA", name: "Academia Saulo Fitness", status: "ACTIVE" as const },
    [IDS.clinic]: { id: IDS.clinic, code: "CLINICA", name: "Clínica SV", status: "ACTIVE" as const },
    [IDS.personal]: { id: IDS.personal, code: "PERSONAL", name: "Personal", status: "ACTIVE" as const },
  },
  categories: {
    [IDS.academyRevenue]: {
      id: IDS.academyRevenue,
      code: "ACADEMIA_MENSALIDADES",
      name: "Mensalidades Academia",
      type: "REVENUE" as const,
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
    },
    [IDS.clinicExpense]: {
      id: IDS.clinicExpense,
      code: "CLINIC_EXPENSE",
      name: "Despesa Clínica",
      type: "EXPENSE" as const,
      businessUnitId: IDS.clinic,
      status: "ACTIVE" as const,
    },
    [IDS.clinicRevenue]: {
      id: IDS.clinicRevenue,
      code: "CLINIC_REVENUE",
      name: "Receita Clínica",
      type: "REVENUE" as const,
      businessUnitId: IDS.clinic,
      status: "ACTIVE" as const,
    },
    [IDS.academyExpense]: {
      id: IDS.academyExpense,
      code: "ACADEMIA_DESPESA_OPERACIONAL",
      name: "Despesa operacional da Academia",
      type: "EXPENSE" as const,
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
    },
    [IDS.academyOwnerWithdrawal]: {
      id: IDS.academyOwnerWithdrawal,
      code: "ACADEMIA_RETIRADA_PROPRIETARIO",
      name: "Retirada do proprietário",
      type: "EXPENSE" as const,
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
    },
    [IDS.personalRevenue]: {
      id: IDS.personalRevenue,
      code: "PERSONAL_SERVICOS",
      name: "Serviços de Personal",
      type: "REVENUE" as const,
      businessUnitId: IDS.personal,
      status: "ACTIVE" as const,
    },
  },
  costCenters: {
    [IDS.academyCostCenter]: {
      id: IDS.academyCostCenter,
      code: "ACADEMY_OPERATION",
      name: "Operação Academia",
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
    },
    [IDS.clinicCostCenter]: {
      id: IDS.clinicCostCenter,
      code: "CLINIC_OPERATION",
      name: "Operação Clínica",
      businessUnitId: IDS.clinic,
      status: "ACTIVE" as const,
    },
  },
  accounts: {
    [IDS.academyAccount]: {
      id: IDS.academyAccount,
      code: "NUBANK",
      name: "Nubank",
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
      accountType: "BANK" as const,
    },
    [IDS.academySumup]: {
      id: IDS.academySumup,
      code: "SUMUP",
      name: "SumUp",
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
      accountType: "BANK" as const,
    },
    [IDS.academyPhysicalCash]: {
      id: IDS.academyPhysicalCash,
      code: "CAIXA_FISICO",
      name: "Caixa físico Academia",
      businessUnitId: IDS.academy,
      status: "ACTIVE" as const,
      accountType: "CASH" as const,
    },
    [IDS.academyLegacyAccount]: {
      id: IDS.academyLegacyAccount,
      code: "CAIXA",
      name: "Caixa Academia",
      businessUnitId: IDS.academy,
      status: "INACTIVE" as const,
      accountType: "CASH" as const,
    },
    [IDS.clinicAccount]: {
      id: IDS.clinicAccount,
      code: "CLINIC_CASH",
      name: "Caixa Clínica",
      businessUnitId: IDS.clinic,
      status: "ACTIVE" as const,
      accountType: "CASH" as const,
    },
  },
  paymentMethods: {
    [IDS.pix]: { id: IDS.pix, code: "PIX", name: "PIX", status: "ACTIVE" as const, paymentMethodType: "PIX" as const },
    [IDS.debit]: { id: IDS.debit, code: "DEBITO", name: "Cartão de débito", status: "ACTIVE" as const, paymentMethodType: "DEBIT_CARD" as const },
    [IDS.credit]: { id: IDS.credit, code: "CREDITO", name: "Cartão de crédito", status: "ACTIVE" as const, paymentMethodType: "CREDIT_CARD" as const },
    [IDS.cash]: { id: IDS.cash, code: "DINHEIRO", name: "Dinheiro", status: "ACTIVE" as const, paymentMethodType: "CASH" as const },
  },
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function referenceView(value: { id: string; code: string; name: string }) {
  return { id: value.id, code: value.code, name: value.name };
}

class InMemoryFinancialRepository implements FinancialRepository {
  private entrySequence = 0;
  private settlementSequence = 0;
  private readonly entries = new Map<string, FinancialEntryView>();
  private readonly idempotency = new Map<string, SettleFinancialEntryInput>();

  async createCategory(input: CreateFinancialCategoryInput) {
    return {
      id: "category-new",
      code: input.code,
      name: input.name,
      status: "ACTIVE" as const,
      businessUnitId: input.businessUnitId,
      entryType: input.type,
    };
  }

  async updateCategory(_id: string, input: UpdateFinancialCategoryInput) {
    const current = references.categories[IDS.academyRevenue];
    return {
      ...current,
      code: input.code ?? current.code,
      name: input.name ?? current.name,
      status: input.status ?? current.status,
      entryType: "REVENUE" as const,
    };
  }

  async createCostCenter(input: CreateCostCenterInput) {
    return { id: "center-new", ...input, status: "ACTIVE" as const };
  }

  async updateCostCenter() {
    return references.costCenters[IDS.academyCostCenter];
  }

  async createAccount(input: CreateFinancialAccountInput) {
    return {
      id: "account-new",
      code: input.code,
      name: input.name,
      status: "ACTIVE" as const,
      businessUnitId: input.businessUnitId,
      accountType: input.type,
    };
  }

  async updateAccount() {
    return references.accounts[IDS.academyAccount];
  }

  async createPaymentMethod(input: CreatePaymentMethodInput) {
    return {
      id: "method-new",
      code: input.code,
      name: input.name,
      status: "ACTIVE" as const,
      paymentMethodType: input.type,
    };
  }

  async updatePaymentMethod() {
    return { ...references.paymentMethods[IDS.pix], paymentMethodType: "PIX" as const };
  }

  async create(input: CreateFinancialEntryInput) {
    const businessUnit = references.businessUnits[input.businessUnitId as keyof typeof references.businessUnits];
    const category = references.categories[input.financialCategoryId as keyof typeof references.categories];
    const costCenter = input.costCenterId
      ? references.costCenters[input.costCenterId as keyof typeof references.costCenters]
      : undefined;
    const account = input.financialAccountId
      ? references.accounts[input.financialAccountId as keyof typeof references.accounts]
      : undefined;
    const paymentMethod = input.paymentMethodId
      ? references.paymentMethods[input.paymentMethodId as keyof typeof references.paymentMethods]
      : undefined;
    assert.ok(businessUnit && category);

    const now = "2026-08-11T18:00:00.000Z";
    const entry: FinancialEntryView = {
      id: `entry-${++this.entrySequence}`,
      type: input.type,
      competence: input.competence,
      dueDate: input.dueDate,
      amount: Number(input.amount).toFixed(2),
      settledAmount: "0.00",
      remainingAmount: Number(input.amount).toFixed(2),
      description: input.description,
      observation: input.observation,
      status: "PENDING",
      origin: input.origin ?? "MANUAL",
      sourceSystem:
        input.sourceSystem ??
        (input.managementNature === "REALIZED" && businessUnit.code === "CLINICA"
          ? "CLINICA_SV"
          : "GESTAO_SV"),
      managementNature: input.managementNature ?? "FORECAST",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      importBatch: input.importBatchId
        ? {
            id: IDS.nextfitBatch,
            sourceSystem: "NEXTFIT",
            competence: "2026-08-01",
            fileName: "dre-nextfit.xlsx",
            fileHash: "hash-nextfit",
            importedAt: now,
            importedByUserId: "70000000-0000-4000-8000-000000000001",
            status: "VALIDATED",
            externalId: "nextfit-2026-08",
          }
        : undefined,
      businessUnit: referenceView(businessUnit),
      financialCategory: referenceView(category),
      costCenter: costCenter ? referenceView(costCenter) : undefined,
      financialAccount: account ? referenceView(account) : undefined,
      paymentMethod: paymentMethod ? referenceView(paymentMethod) : undefined,
      settlements: [],
      createdAt: now,
      updatedAt: now,
    };
    this.entries.set(entry.id, entry);
    return clone(entry);
  }

  async createAndSettle(input: CreateAndSettleFinancialEntryInput) {
    const replay = this.idempotency.get(input.settlement.idempotencyKey);
    if (replay) {
      const existing = this.entries.get(replay.financialEntryId);
      if (
        !existing ||
        Number(replay.amount) !== Number(input.settlement.amount) ||
        replay.settlementDate !== input.settlement.settlementDate ||
        replay.financialAccountId !== input.settlement.financialAccountId ||
        replay.paymentMethodId !== input.settlement.paymentMethodId ||
        existing.description !== input.entry.description ||
        Number(existing.amount) !== Number(input.entry.amount)
      ) {
        throw new FinancialError("IDEMPOTENCY_CONFLICT", "Chave já utilizada.");
      }
      return clone(existing);
    }

    const entry = await this.create(input.entry);
    try {
      return await this.settle({
        financialEntryId: entry.id,
        ...input.settlement,
      });
    } catch (error) {
      this.entries.delete(entry.id);
      throw error;
    }
  }

  async findById(id: string) {
    const entry = this.entries.get(id);
    return entry ? clone(entry) : null;
  }

  async list(filters: FinancialEntryFilters = {}) {
    return [...this.entries.values()]
      .filter((entry) => !filters.businessUnitId || entry.businessUnit.id === filters.businessUnitId)
      .filter((entry) => !filters.financialCategoryId || entry.financialCategory.id === filters.financialCategoryId)
      .filter((entry) => !filters.costCenterId || entry.costCenter?.id === filters.costCenterId)
      .filter(
        (entry) =>
          !filters.financialAccountId ||
          entry.financialAccount?.id === filters.financialAccountId ||
          entry.settlements.some(
            (settlement) => settlement.financialAccount.id === filters.financialAccountId,
          ),
      )
      .filter((entry) => !filters.status || entry.status === filters.status)
      .filter((entry) => !filters.type || entry.type === filters.type)
      .filter((entry) => !filters.sourceSystem || entry.sourceSystem === filters.sourceSystem)
      .filter(
        (entry) =>
          !filters.managementNature || entry.managementNature === filters.managementNature,
      )
      .filter((entry) => !filters.periodStart || entry.dueDate >= filters.periodStart)
      .filter((entry) => !filters.periodEnd || entry.dueDate <= filters.periodEnd)
      .filter(
        (entry) => !filters.competenceStart || entry.competence >= filters.competenceStart,
      )
      .filter((entry) => !filters.competenceEnd || entry.competence <= filters.competenceEnd)
      .map(clone);
  }

  async update(id: string, input: UpdateFinancialEntryInput) {
    const current = this.entries.get(id);
    assert.ok(current);
    const updated: FinancialEntryView = {
      ...current,
      type: input.type ?? current.type,
      competence: input.competence ?? current.competence,
      dueDate: input.dueDate ?? current.dueDate,
      amount: input.amount === undefined ? current.amount : Number(input.amount).toFixed(2),
      description: input.description ?? current.description,
      observation:
        input.observation === undefined ? current.observation : input.observation ?? undefined,
      managementNature: input.managementNature ?? current.managementNature,
      updatedAt: "2026-08-11T19:00:00.000Z",
    };
    this.entries.set(id, updated);
    return clone(updated);
  }

  async cancel(id: string) {
    const current = this.entries.get(id);
    assert.ok(current);
    const cancelled = { ...current, status: "CANCELLED" as const };
    this.entries.set(id, cancelled);
    return clone(cancelled);
  }

  async settle(input: SettleFinancialEntryInput) {
    const current = this.entries.get(input.financialEntryId);
    if (!current) throw new FinancialError("ENTRY_NOT_FOUND", "Lançamento não encontrado.");

    const replay = this.idempotency.get(input.idempotencyKey);
    if (replay) {
      if (
        replay.financialEntryId !== input.financialEntryId ||
        Number(replay.amount) !== Number(input.amount) ||
        replay.settlementDate !== input.settlementDate ||
        replay.financialAccountId !== input.financialAccountId ||
        replay.paymentMethodId !== input.paymentMethodId
      ) {
        throw new FinancialError("IDEMPOTENCY_CONFLICT", "Chave já utilizada.");
      }
      return clone(current);
    }
    if (current.status === "CANCELLED") {
      throw new FinancialError("ENTRY_CANCELLED", "Lançamento cancelado.");
    }

    const account = references.accounts[input.financialAccountId as keyof typeof references.accounts];
    const paymentMethod =
      references.paymentMethods[input.paymentMethodId as keyof typeof references.paymentMethods];
    if (!account) throw new FinancialError("ACCOUNT_NOT_FOUND", "Conta não encontrada.");
    if (account.status === "INACTIVE") {
      throw new FinancialError("ACCOUNT_INACTIVE", "Conta inativa.");
    }
    if (
      current.businessUnit.code !== "PERSONAL" &&
      account.businessUnitId !== current.businessUnit.id
    ) {
      throw new FinancialError("ACCOUNT_UNIT_MISMATCH", "Conta de outra unidade.");
    }
    if (!paymentMethod) {
      throw new FinancialError("PAYMENT_METHOD_NOT_FOUND", "Forma não encontrada.");
    }

    const state = calculateSettlementState(
      current.amount,
      current.settledAmount,
      String(input.amount),
    );
    const settlement = {
      id: `settlement-${++this.settlementSequence}`,
      amount: Number(input.amount).toFixed(2),
      settlementDate: input.settlementDate,
      financialAccount: referenceView(account),
      paymentMethod: referenceView(paymentMethod),
      observation: input.observation,
      idempotencyKey: input.idempotencyKey,
      createdAt: "2026-08-11T20:00:00.000Z",
    };
    const updated: FinancialEntryView = {
      ...current,
      settledAmount: state.totalSettled,
      remainingAmount: state.remainingAmount,
      status: state.status,
      settlements: [...current.settlements, settlement],
    };
    this.idempotency.set(input.idempotencyKey, clone(input));
    this.entries.set(current.id, updated);
    return clone(updated);
  }

  async recordAcademyReceipt(input: {
    receiptDate: string;
    amount: string | number;
    description: string;
    reference?: string;
    financialAccountId: string;
    paymentMethodId: string;
    idempotencyKey: string;
    businessUnitId: string;
    financialCategoryId: string;
  }) {
    const existing = [...this.entries.values()].find(
      (entry) =>
        entry.sourceType === "ACADEMIA_RECEBIMENTO_REAL" &&
        entry.sourceId === input.idempotencyKey,
    );
    if (existing) return clone(existing);

    const entry = await this.create({
      type: "REVENUE",
      competence: input.receiptDate,
      dueDate: input.receiptDate,
      amount: input.amount,
      description: input.description,
      observation: input.reference,
      businessUnitId: input.businessUnitId,
      financialCategoryId: input.financialCategoryId,
      origin: "MANUAL",
      sourceSystem: "GESTAO_SV",
      managementNature: "REALIZED",
      sourceType: "ACADEMIA_RECEBIMENTO_REAL",
      sourceId: input.idempotencyKey,
    });
    return this.settle({
      financialEntryId: entry.id,
      amount: input.amount,
      settlementDate: input.receiptDate,
      financialAccountId: input.financialAccountId,
      paymentMethodId: input.paymentMethodId,
      observation: input.reference,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async aggregate(filters: FinancialEntryFilters = {}, asOf = new Date()) {
    return buildFinancialSummary(await this.list(filters), asOf);
  }

  async getReferences(input: {
    businessUnitId: string;
    financialCategoryId: string;
    costCenterId?: string;
    financialAccountId?: string;
    paymentMethodId?: string;
    importBatchId?: string;
  }): Promise<FinancialReferenceSnapshot> {
    return {
      businessUnit:
        references.businessUnits[input.businessUnitId as keyof typeof references.businessUnits] ?? null,
      category:
        references.categories[input.financialCategoryId as keyof typeof references.categories] ?? null,
      costCenter: input.costCenterId
        ? references.costCenters[input.costCenterId as keyof typeof references.costCenters] ?? null
        : null,
      financialAccount: input.financialAccountId
        ? references.accounts[input.financialAccountId as keyof typeof references.accounts] ?? null
        : null,
      paymentMethod: input.paymentMethodId
        ? references.paymentMethods[
            input.paymentMethodId as keyof typeof references.paymentMethods
          ] ?? null
        : null,
      importBatch: input.importBatchId
        ? {
            id: IDS.nextfitBatch,
            sourceSystem: "NEXTFIT",
            status: "VALIDATED",
          }
        : null,
    };
  }

  async listCatalog() {
    return {
      businessUnits: Object.values(references.businessUnits),
      categories: Object.values(references.categories).map(({ type, ...item }) => ({
        ...item,
        entryType: type,
      })),
      costCenters: Object.values(references.costCenters),
      financialAccounts: Object.values(references.accounts),
      paymentMethods: Object.values(references.paymentMethods),
    };
  }
}

function academyEntry(amount = 100): CreateFinancialEntryInput {
  return {
    type: "REVENUE",
    competence: "2026-08-01",
    dueDate: "2026-08-10",
    amount,
    description: "Mensalidade Academia",
    businessUnitId: IDS.academy,
    financialCategoryId: IDS.academyRevenue,
    costCenterId: IDS.academyCostCenter,
  };
}

function clinicEntry(amount = 40): CreateFinancialEntryInput {
  return {
    type: "EXPENSE",
    competence: "2026-08-01",
    dueDate: "2026-08-15",
    amount,
    description: "Operação Clínica",
    businessUnitId: IDS.clinic,
    financialCategoryId: IDS.clinicExpense,
    costCenterId: IDS.clinicCostCenter,
    managementNature: "REALIZED",
  };
}

function academyExpenseEntry(amount = 40): CreateFinancialEntryInput {
  return {
    type: "EXPENSE",
    competence: "2026-08-01",
    dueDate: "2026-08-15",
    amount,
    description: "Energia da Academia",
    businessUnitId: IDS.academy,
    financialCategoryId: IDS.academyExpense,
    managementNature: "REALIZED",
  };
}

function academyOwnerWithdrawalEntry(amount = 30): CreateFinancialEntryInput {
  return {
    ...academyExpenseEntry(amount),
    description: "Retirada do proprietário",
    financialCategoryId: IDS.academyOwnerWithdrawal,
  };
}

function clinicRevenueEntry(amount = 100): CreateFinancialEntryInput {
  return {
    ...clinicEntry(amount),
    type: "REVENUE",
    description: "Consulta Clínica",
    financialCategoryId: IDS.clinicRevenue,
  };
}

function personalRevenueEntry(amount = 100): CreateFinancialEntryInput {
  return {
    type: "REVENUE",
    competence: "2026-08-01",
    dueDate: "2026-08-10",
    amount,
    description: "Acompanhamento individual",
    businessUnitId: IDS.personal,
    financialCategoryId: IDS.personalRevenue,
    managementNature: "REALIZED",
  };
}

function nextfitRealizedEntry(amount = 100): CreateFinancialEntryInput {
  return {
    ...academyEntry(amount),
    origin: "EXTERNAL_IMPORT",
    sourceSystem: "NEXTFIT",
    managementNature: "REALIZED",
    sourceType: "NEXTFIT_DRE",
    sourceId: `nextfit-entry-${amount}`,
    importBatchId: IDS.nextfitBatch,
  };
}

function settlement(entryId: string, amount: number, key: string, clinic = false) {
  return {
    financialEntryId: entryId,
    amount,
    settlementDate: "2026-08-11",
    financialAccountId: clinic ? IDS.clinicAccount : IDS.academyAccount,
    paymentMethodId: IDS.pix,
    idempotencyKey: key,
  } satisfies SettleFinancialEntryInput;
}

test("cria cadastros financeiros respeitando unidade e escopo compartilhado", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const category = await service.createCategory({
    code: " mensalidades academia ",
    name: "Mensalidades Academia",
    type: "REVENUE",
    businessUnitId: IDS.academy,
  });
  const center = await service.createCostCenter({
    code: "operação",
    name: "Operação",
    businessUnitId: IDS.clinic,
  });
  const method = await service.createPaymentMethod({
    code: "pix",
    name: "PIX",
    type: "PIX",
  });
  const inactive = await service.updateCategory(category.id, {
    name: "Mensalidades",
    status: "INACTIVE",
  });

  assert.equal(category.code, "MENSALIDADES_ACADEMIA");
  assert.equal(category.businessUnitId, IDS.academy);
  assert.equal(center.code, "OPERACAO");
  assert.equal(center.businessUnitId, IDS.clinic);
  assert.equal(method.businessUnitId, undefined);
  assert.equal(inactive.name, "Mensalidades");
  assert.equal(inactive.status, "INACTIVE");
});

test("rejeita cadastro vinculado a unidade inexistente", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await assert.rejects(
    service.createAccount({
      code: "CAIXA",
      name: "Caixa",
      type: "CASH",
      businessUnitId: "90000000-0000-4000-8000-000000000099",
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "BUSINESS_UNIT_NOT_FOUND",
  );
});

test("cria e busca lançamento financeiro", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const created = await service.create(academyExpenseEntry());
  const found = await service.findById(created.id);
  assert.equal(created.status, "PENDING");
  assert.equal(found?.description, "Energia da Academia");
  assert.equal(found?.remainingAmount, "40.00");
  assert.equal(found?.managementNature, "REALIZED");
  assert.equal(found?.sourceSystem, "GESTAO_SV");
});

test("persiste e calcula corretamente valores recebidos da máscara pt-BR", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const amounts = ["0.01", "5.00", "20.00", "250.00", "1234.56", "10000.00"];

  for (const [index, amount] of amounts.entries()) {
    const entry = await service.create({
      ...academyExpenseEntry(Number(amount)),
      amount,
      description: `Despesa monetária ${index + 1}`,
    });
    assert.equal(entry.amount, amount);
    assert.equal(entry.settledAmount, "0.00");
  }

  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );
  assert.equal(summary.openPayable, "11509.57");
  assert.equal(summary.realizedBalance, "0.00");
});

test("impede qualquer receita manual comum da Academia", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await assert.rejects(
    service.create(academyEntry()),
    (error: unknown) =>
      error instanceof FinancialError &&
      error.code === "ACADEMY_REVENUE_REQUIRES_NEXTFIT",
  );
});

test("entrada PIX realizada é liquidada no Nubank", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.recordAcademyReceipt({
    receiptDate: "2026-08-13",
    amount: 100,
    description: "Recebimento PIX Academia",
    reference: "Referência operacional",
    financialAccountId: IDS.academyAccount,
    paymentMethodId: IDS.pix,
    idempotencyKey: "academy-receipt-pix",
  });
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-13",
  );

  assert.equal(entry.status, "SETTLED");
  assert.equal(entry.sourceSystem, "GESTAO_SV");
  assert.equal(entry.sourceType, "ACADEMIA_RECEBIMENTO_REAL");
  assert.equal(entry.settlements[0]?.financialAccount.code, "NUBANK");
  assert.equal(summary.totalReceived, "100.00");
  assert.equal(summary.realizedBalance, "100.00");
});

test("entradas de cartão são liquidadas na SumUp", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  for (const [paymentMethodId, key] of [
    [IDS.debit, "academy-receipt-debit"],
    [IDS.credit, "academy-receipt-credit"],
  ] as const) {
    const entry = await service.recordAcademyReceipt({
      receiptDate: "2026-08-13",
      amount: 50,
      description: "Recebimento cartão Academia",
      financialAccountId: IDS.academySumup,
      paymentMethodId,
      idempotencyKey: key,
    });
    assert.equal(entry.settlements[0]?.financialAccount.code, "SUMUP");
  }
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-13",
  );
  assert.equal(summary.totalReceived, "100.00");
});

test("entrada em dinheiro é liquidada no Caixa físico Academia", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.recordAcademyReceipt({
    receiptDate: "2026-08-13",
    amount: 80,
    description: "Recebimento em espécie",
    financialAccountId: IDS.academyPhysicalCash,
    paymentMethodId: IDS.cash,
    idempotencyKey: "academy-receipt-cash",
  });

  assert.equal(entry.settlements[0]?.financialAccount.code, "CAIXA_FISICO");
});

test("recebimento rejeita conta incompatível e repetição não duplica entrada", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const operation = {
    receiptDate: "2026-08-13",
    amount: 120,
    description: "Recebimento PIX Academia",
    financialAccountId: IDS.academyAccount,
    paymentMethodId: IDS.pix,
    idempotencyKey: "academy-receipt-idempotent",
  } as const;

  await assert.rejects(
    service.recordAcademyReceipt({
      ...operation,
      financialAccountId: IDS.academySumup,
      idempotencyKey: "academy-receipt-wrong-account",
    }),
    (error: unknown) =>
      error instanceof FinancialError &&
      error.code === "ACADEMY_RECEIPT_ACCOUNT_MISMATCH",
  );
  await service.recordAcademyReceipt(operation);
  await service.recordAcademyReceipt(operation);
  const entries = await service.list({ businessUnitId: IDS.academy });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.settlements.length, 1);
});

test("saldo realizado combina entrada, despesa e retirada sem tornar retirada operacional", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await service.recordAcademyReceipt({
    receiptDate: "2026-08-13",
    amount: 200,
    description: "Recebimento PIX Academia",
    financialAccountId: IDS.academyAccount,
    paymentMethodId: IDS.pix,
    idempotencyKey: "academy-balance-receipt",
  });
  const expense = await service.create(academyExpenseEntry(70));
  const withdrawal = await service.create(academyOwnerWithdrawalEntry(30));
  await service.settle(settlement(expense.id, 70, "academy-balance-expense"));
  await service.settle(settlement(withdrawal.id, 30, "academy-balance-withdrawal"));
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-13",
  );

  assert.equal(summary.totalReceived, "200.00");
  assert.equal(summary.totalPaid, "70.00");
  assert.equal(summary.ownerWithdrawalPaid, "30.00");
  assert.equal(summary.accrualExpense, "70.00");
  assert.equal(summary.realizedBalance, "100.00");
});

test("saldos realizados por conta usam somente liquidações na conta efetiva", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  for (const receipt of [
    { amount: 200, account: IDS.academyAccount, method: IDS.pix, key: "balance-nubank-in" },
    { amount: 100, account: IDS.academySumup, method: IDS.credit, key: "balance-sumup-in" },
    { amount: 50, account: IDS.academyPhysicalCash, method: IDS.cash, key: "balance-cash-in" },
  ]) {
    await service.recordAcademyReceipt({
      receiptDate: "2026-08-13",
      amount: receipt.amount,
      description: "Entrada realizada por conta",
      financialAccountId: receipt.account,
      paymentMethodId: receipt.method,
      idempotencyKey: receipt.key,
    });
  }

  for (const expense of [
    { amount: 30, account: IDS.academyAccount, method: IDS.pix, key: "balance-nubank-out" },
    { amount: 20, account: IDS.academySumup, method: IDS.debit, key: "balance-sumup-out" },
    { amount: 10, account: IDS.academyPhysicalCash, method: IDS.cash, key: "balance-cash-out" },
  ]) {
    const entry = await service.create(academyExpenseEntry(expense.amount));
    await service.settle({
      ...settlement(entry.id, expense.amount, expense.key),
      financialAccountId: expense.account,
      paymentMethodId: expense.method,
    });
  }

  const withdrawal = await service.create(academyOwnerWithdrawalEntry(15));
  await service.settle({
    ...settlement(withdrawal.id, 15, "balance-owner-withdrawal"),
    financialAccountId: IDS.academySumup,
    paymentMethodId: IDS.debit,
  });
  await service.create({
    ...academyExpenseEntry(999),
    financialAccountId: IDS.academyPhysicalCash,
    description: "Previsão sem liquidação",
  });

  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-13",
  );
  const balances = new Map(
    summary.accountBalances.map((account) => [
      account.financialAccount.code,
      account.realizedBalance,
    ]),
  );

  assert.equal(balances.get("NUBANK"), "170.00");
  assert.equal(balances.get("SUMUP"), "65.00");
  assert.equal(balances.get("CAIXA_FISICO"), "40.00");
  assert.equal(summary.totalAvailable, "275.00");
  assert.equal(summary.ownerWithdrawalPaid, "15.00");
  assert.equal(summary.totalPaid, "60.00");
});

test("aceita realizado da Academia somente com rastreabilidade NextFit", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(nextfitRealizedEntry());
  assert.equal(entry.sourceSystem, "NEXTFIT");
  assert.equal(entry.managementNature, "REALIZED");
  assert.equal(entry.importBatch?.id, IDS.nextfitBatch);
});

test("Academia cria despesa manual realizada no SAULO-AI", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyExpenseEntry());
  assert.equal(entry.type, "EXPENSE");
  assert.equal(entry.origin, "MANUAL");
  assert.equal(entry.sourceSystem, "GESTAO_SV");
  assert.equal(entry.managementNature, "REALIZED");
});

test("catálogo mantém as três contas reais ativas e o CAIXA antigo inativo", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const catalog = await service.catalog();
  const academyAccounts = catalog.financialAccounts.filter(
    (account) => account.businessUnitId === IDS.academy,
  );

  assert.deepEqual(
    academyAccounts
      .filter((account) => account.status === "ACTIVE")
      .map((account) => [account.code, account.accountType]),
    [
      ["NUBANK", "BANK"],
      ["SUMUP", "BANK"],
      ["CAIXA_FISICO", "CASH"],
    ],
  );
  assert.equal(
    academyAccounts.find((account) => account.code === "CAIXA")?.status,
    "INACTIVE",
  );
});

test("conta prevista permanece opcional e não cria liquidação", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyExpenseEntry(100));

  assert.equal(entry.financialAccount, undefined);
  assert.equal(entry.status, "PENDING");
  assert.equal(entry.settlements.length, 0);
});

test("conta e forma informadas no lançamento não pagam a despesa da Academia", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create({
    ...academyExpenseEntry(100),
    financialAccountId: IDS.academyAccount,
    paymentMethodId: IDS.pix,
  });

  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );

  assert.equal(entry.status, "PENDING");
  assert.equal(entry.settlements.length, 0);
  assert.equal(entry.financialAccount?.id, IDS.academyAccount);
  assert.equal(entry.paymentMethod?.id, IDS.pix);
  assert.equal(summary.totalPaid, "0.00");
  assert.equal(summary.openPayable, "100.00");
  assert.equal(summary.realizedBalance, "0.00");
});

test("salvar e pagar agora cria Entry e exatamente um Settlement na conta real", async () => {
  const repository = new InMemoryFinancialRepository();
  const service = createFinancialService(repository);
  const operation = {
    entry: {
      ...academyExpenseEntry(100),
      financialAccountId: IDS.academyAccount,
      paymentMethodId: IDS.pix,
    },
    settlement: {
      amount: 100,
      settlementDate: "2026-08-14",
      financialAccountId: IDS.academySumup,
      paymentMethodId: IDS.debit,
      observation: "Pago na operação diária",
      idempotencyKey: "create-and-pay-expense",
    },
  } satisfies CreateAndSettleFinancialEntryInput;

  const paid = await service.createAndSettle(operation);
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );

  assert.equal(paid.status, "SETTLED");
  assert.equal(paid.settlements.length, 1);
  assert.equal(paid.financialAccount?.id, IDS.academyAccount);
  assert.equal(paid.settlements[0]?.financialAccount.id, IDS.academySumup);
  assert.equal(paid.settlements[0]?.paymentMethod.id, IDS.debit);
  assert.equal(summary.totalPaid, "100.00");
  assert.equal(summary.openPayable, "0.00");
  assert.equal(summary.realizedBalance, "-100.00");
});

test("reenvio de salvar e pagar agora não duplica Entry nem Settlement", async () => {
  const repository = new InMemoryFinancialRepository();
  const service = createFinancialService(repository);
  const operation = {
    entry: academyExpenseEntry(80),
    settlement: {
      amount: 80,
      settlementDate: "2026-08-14",
      financialAccountId: IDS.academyAccount,
      paymentMethodId: IDS.pix,
      idempotencyKey: "create-and-pay-idempotent",
    },
  } satisfies CreateAndSettleFinancialEntryInput;

  await service.createAndSettle(operation);
  await service.createAndSettle(operation);
  const entries = await service.list({ businessUnitId: IDS.academy });

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.settlements.length, 1);
});

test("retirada salva e paga agora reduz caixa e permanece não operacional", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const paid = await service.createAndSettle({
    entry: academyOwnerWithdrawalEntry(30),
    settlement: {
      amount: 30,
      settlementDate: "2026-08-14",
      financialAccountId: IDS.academyPhysicalCash,
      paymentMethodId: IDS.cash,
      idempotencyKey: "create-and-pay-owner-withdrawal",
    },
  });
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );

  assert.equal(paid.status, "SETTLED");
  assert.equal(paid.settlements.length, 1);
  assert.equal(summary.totalPaid, "0.00");
  assert.equal(summary.accrualExpense, "0.00");
  assert.equal(summary.ownerWithdrawalPaid, "30.00");
  assert.equal(summary.realizedBalance, "-30.00");
});

test("falha na liquidação reverte a criação do lançamento", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());

  await assert.rejects(
    service.createAndSettle({
      entry: academyExpenseEntry(60),
      settlement: {
        amount: 60,
        settlementDate: "2026-08-14",
        financialAccountId: IDS.clinicAccount,
        paymentMethodId: IDS.pix,
        idempotencyKey: "create-and-pay-rollback",
      },
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "ACCOUNT_UNIT_MISMATCH",
  );

  const entries = await service.list({ businessUnitId: IDS.academy });
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );
  assert.equal(entries.length, 0);
  assert.equal(summary.totalPaid, "0.00");
  assert.equal(summary.realizedBalance, "0.00");
});

test("liquidação da despesa da Academia entra uma única vez nas saídas realizadas", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyExpenseEntry(100));
  const payment = settlement(entry.id, 100, "academy-expense-once");

  await service.settle(payment);
  await service.settle(payment);
  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );
  const persisted = await service.findById(entry.id);

  assert.equal(persisted?.status, "SETTLED");
  assert.equal(persisted?.settlements.length, 1);
  assert.equal(summary.totalPaid, "100.00");
  assert.equal(summary.openPayable, "0.00");
  assert.equal(summary.realizedBalance, "-100.00");
});

test("liquidação exige conta real e aceita conta diferente da prevista", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create({
    ...academyExpenseEntry(100),
    financialAccountId: IDS.academyAccount,
  });

  await assert.rejects(
    service.settle({
      ...settlement(entry.id, 100, "missing-real-account"),
      financialAccountId: undefined as unknown as string,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "ACCOUNT_NOT_FOUND",
  );

  const paid = await service.settle({
    ...settlement(entry.id, 100, "different-real-account"),
    financialAccountId: IDS.academySumup,
  });

  assert.equal(paid.financialAccount?.id, IDS.academyAccount);
  assert.equal(paid.settlements[0]?.financialAccount.id, IDS.academySumup);
  assert.equal(paid.status, "SETTLED");
});

test("CAIXA antigo não pode ser usado em nova liquidação", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyExpenseEntry(100));

  await assert.rejects(
    service.settle({
      ...settlement(entry.id, 100, "inactive-legacy-account"),
      financialAccountId: IDS.academyLegacyAccount,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "ACCOUNT_INACTIVE",
  );
});

test("Academia cria retirada do proprietário com categoria institucional", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyOwnerWithdrawalEntry());
  assert.equal(entry.type, "EXPENSE");
  assert.equal(entry.financialCategory.code, "ACADEMIA_RETIRADA_PROPRIETARIO");
  assert.equal(entry.sourceSystem, "GESTAO_SV");
});

test("retirada paga reduz caixa sem compor despesa operacional", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const withdrawal = await service.create(academyOwnerWithdrawalEntry(30));
  const paidWithdrawal = await service.settle({
    ...settlement(withdrawal.id, 30, "owner-withdrawal-cash"),
    financialAccountId: IDS.academyPhysicalCash,
  });

  const summary = await service.summarize(
    { businessUnitId: IDS.academy },
    "2026-08-15",
  );

  assert.equal(summary.totalPaid, "0.00");
  assert.equal(summary.accrualExpense, "0.00");
  assert.equal(summary.ownerWithdrawalPaid, "30.00");
  assert.equal(summary.realizedBalance, "-30.00");
  assert.equal(
    paidWithdrawal.settlements[0]?.financialAccount.id,
    IDS.academyPhysicalCash,
  );
});

test("despesa e retirada da Academia podem ser liquidadas sem perder classificação", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const expense = await service.create(academyExpenseEntry(40));
  const withdrawal = await service.create(academyOwnerWithdrawalEntry(30));
  const paidExpense = await service.settle(settlement(expense.id, 40, "academy-expense-paid"));
  const paidWithdrawal = await service.settle(
    settlement(withdrawal.id, 30, "academy-withdrawal-paid"),
  );
  assert.equal(paidExpense.status, "SETTLED");
  assert.equal(paidWithdrawal.status, "SETTLED");
  assert.equal(
    paidWithdrawal.financialCategory.code,
    "ACADEMIA_RETIRADA_PROPRIETARIO",
  );
  assert.equal(paidWithdrawal.settlements.length, 1);
});

test("lista lançamentos por unidade sem misturar Academia e Clínica", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await service.create(academyExpenseEntry());
  await service.create(clinicEntry());
  const academy = await service.list({ businessUnitId: IDS.academy });
  const clinic = await service.list({ businessUnitId: IDS.clinic });
  assert.deepEqual(academy.map((entry) => entry.businessUnit.code), ["ACADEMIA"]);
  assert.deepEqual(clinic.map((entry) => entry.businessUnit.code), ["CLINICA"]);
});

test("registra liquidação parcial e preserva saldo", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicRevenueEntry());
  const partial = await service.settle(settlement(entry.id, 40, "partial-1", true));
  assert.equal(partial.status, "PARTIALLY_SETTLED");
  assert.equal(partial.settledAmount, "40.00");
  assert.equal(partial.remainingAmount, "60.00");
  const summary = await service.summarize(
    { businessUnitId: IDS.clinic },
    "2026-08-15",
  );
  assert.equal(summary.totalReceived, "40.00");
  assert.equal(summary.accountBalances[0]?.financialAccount.code, "CLINIC_CASH");
  assert.equal(summary.accountBalances[0]?.realizedBalance, "40.00");
});

test("segunda liquidação completa o lançamento", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicRevenueEntry());
  await service.settle(settlement(entry.id, 40, "complete-1", true));
  const settled = await service.settle(settlement(entry.id, 60, "complete-2", true));
  assert.equal(settled.status, "SETTLED");
  assert.equal(settled.settledAmount, "100.00");
  assert.equal(settled.remainingAmount, "0.00");
  const summary = await service.summarize(
    { businessUnitId: IDS.clinic },
    "2026-08-15",
  );
  assert.equal(summary.totalReceived, "100.00");
  assert.equal(summary.accountBalances[0]?.realizedBalance, "100.00");
});

test("receita manual de Personal usa FinancialSettlement e uma conta real existente", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const catalog = await service.catalog();
  assert.equal(
    catalog.businessUnits.find((unit) => unit.code === "PERSONAL")?.name,
    "Personal",
  );

  const open = await service.create(personalRevenueEntry(100));
  assert.equal(open.businessUnit.code, "PERSONAL");
  assert.equal(open.sourceSystem, "GESTAO_SV");
  assert.equal(open.status, "PENDING");
  assert.equal((await service.list({ businessUnitId: IDS.personal })).length, 1);

  const partial = await service.settle(
    settlement(open.id, 40, "personal-partial"),
  );
  assert.equal(partial.status, "PARTIALLY_SETTLED");
  assert.equal(partial.remainingAmount, "60.00");
  assert.equal(partial.settlements[0]?.financialAccount.code, "NUBANK");

  const settled = await service.settle(
    settlement(open.id, 60, "personal-complete"),
  );
  assert.equal(settled.status, "SETTLED");
  assert.equal(settled.remainingAmount, "0.00");
  assert.equal(settled.settlements.length, 2);

  const summary = await service.summarize(
    { businessUnitId: IDS.personal },
    "2026-08-15",
  );
  assert.equal(summary.totalReceived, "100.00");
  assert.equal(summary.realizedBalance, "100.00");
  assert.equal(summary.accountBalances[0]?.financialAccount.code, "NUBANK");
  assert.equal(summary.accountBalances[0]?.realizedBalance, "100.00");
});

test("Personal não pode ser classificado como origem NextFit", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await assert.rejects(
    service.create({
      ...personalRevenueEntry(),
      origin: "EXTERNAL_IMPORT",
      sourceSystem: "NEXTFIT",
      sourceType: "NEXTFIT_RECEBIMENTO",
      sourceId: "personal-nextfit-invalido",
      importBatchId: IDS.nextfitBatch,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "INVALID_FINANCIAL_SOURCE",
  );
});

test("rejeita liquidação superior ao saldo", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicRevenueEntry());
  await service.settle(settlement(entry.id, 40, "over-1", true));
  await assert.rejects(
    service.settle(settlement(entry.id, 61, "over-2", true)),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "SETTLEMENT_EXCEEDS_BALANCE",
  );
});

test("repetir idempotencyKey não duplica liquidação", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicRevenueEntry());
  const operation = settlement(entry.id, 25, "idem-1", true);
  await service.settle(operation);
  const replay = await service.settle(operation);
  assert.equal(replay.settlements.length, 1);
  assert.equal(replay.settledAmount, "25.00");
});

test("cancela sem excluir fisicamente o lançamento", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(academyExpenseEntry());
  const cancelled = await service.cancel(entry.id);
  const found = await service.findById(entry.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(found?.id, entry.id);
  assert.equal(found?.status, "CANCELLED");
});

test("rejeita categoria da Academia em lançamento da Clínica", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await assert.rejects(
    service.create({
      ...academyEntry(),
      businessUnitId: IDS.clinic,
      costCenterId: IDS.clinicCostCenter,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "CATEGORY_UNIT_MISMATCH",
  );
});

test("rejeita centro de custo de outra unidade", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await assert.rejects(
    service.create({
      ...academyEntry(),
      costCenterId: IDS.clinicCostCenter,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "COST_CENTER_UNIT_MISMATCH",
  );
});

test("rejeita conta de outra unidade na liquidação", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicEntry());
  await assert.rejects(
    service.settle({
      ...settlement(entry.id, 10, "wrong-account"),
      financialAccountId: IDS.academyAccount,
    }),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "ACCOUNT_UNIT_MISMATCH",
  );
});

test("não cancela lançamento liquidado sem estrutura de estorno", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  const entry = await service.create(clinicRevenueEntry());
  await service.settle(settlement(entry.id, 10, "cancel-settled", true));
  await assert.rejects(
    service.cancel(entry.id),
    (error: unknown) =>
      error instanceof FinancialError && error.code === "ENTRY_HAS_SETTLEMENTS",
  );
  assert.equal((await service.findById(entry.id))?.status, "PARTIALLY_SETTLED");
});

test("agrega valores reais e consolida Academia, Clínica e Personal sem duplicidade", async () => {
  const service = createFinancialService(new InMemoryFinancialRepository());
  await service.create(nextfitRealizedEntry(100));
  const academyExpense = await service.create(academyExpenseEntry(40));
  const ownerWithdrawal = await service.create(academyOwnerWithdrawalEntry(30));
  const revenue = await service.create(clinicRevenueEntry(80));
  const expense = await service.create(clinicEntry(40));
  const personalRevenue = await service.create(personalRevenueEntry(25));
  await service.settle(settlement(academyExpense.id, 40, "summary-academy-expense"));
  await service.settle(settlement(ownerWithdrawal.id, 30, "summary-owner-withdrawal"));
  await service.settle(settlement(revenue.id, 80, "summary-revenue", true));
  await service.settle(settlement(expense.id, 10, "summary-expense", true));
  await service.settle(settlement(personalRevenue.id, 25, "summary-personal"));

  const summary = await service.summarize({}, "2026-09-01");
  assert.equal(summary.totalReceivable, "100.00");
  assert.equal(summary.totalReceived, "105.00");
  assert.equal(summary.totalPayable, "30.00");
  assert.equal(summary.totalPaid, "50.00");
  assert.equal(summary.accrualRevenue, "205.00");
  assert.equal(summary.accrualExpense, "80.00");
  assert.equal(summary.ownerWithdrawal, "30.00");
  assert.equal(summary.ownerWithdrawalPaid, "30.00");
  assert.equal(summary.openPayable, "30.00");
  assert.equal(summary.overduePayable, "30.00");
  assert.equal(summary.realizedBalance, "25.00");
  assert.equal(summary.accrualResult, "125.00");
  assert.deepEqual(
    summary.byBusinessUnit.map((unit) => unit.businessUnitCode),
    ["ACADEMIA", "CLINICA", "PERSONAL"],
  );
});
