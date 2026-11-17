import { prisma } from "@/lib/database/prisma";

const categories = [
  {
    code: "ACADEMIA_MENSALIDADES",
    name: "Mensalidades Academia",
    type: "REVENUE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_PESSOAL",
    name: "Pessoal",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_ESTRUTURA_OPERACAO",
    name: "Estrutura e operação",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_COMPRAS_INVESTIMENTOS",
    name: "Compras e investimentos",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_ADMINISTRATIVO",
    name: "Administrativo",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_MARKETING_VENDAS",
    name: "Marketing e vendas",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_TRIBUTOS_ENCARGOS",
    name: "Tributos e encargos",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_OUTROS",
    name: "Outros",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "ACADEMIA_RETIRADA_PROPRIETARIO",
    name: "Retirada do proprietário",
    type: "EXPENSE" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "CLINICA_NUTRICAO",
    name: "Nutrição",
    type: "REVENUE" as const,
    unitCode: "CLINICA",
  },
  {
    code: "CLINICA_AVALIACAO_POSTURAL",
    name: "Avaliação Postural",
    type: "REVENUE" as const,
    unitCode: "CLINICA",
  },
  {
    code: "PERSONAL_SERVICOS",
    name: "Serviços de Personal",
    type: "REVENUE" as const,
    unitCode: "PERSONAL",
  },
  {
    code: "RECEITA_OUTROS_SERVICOS",
    name: "Outros Serviços",
    type: "REVENUE" as const,
  },
  {
    code: "DESPESA_OPERACIONAL",
    name: "Despesas Operacionais",
    type: "EXPENSE" as const,
  },
  {
    code: "DESPESA_ADMINISTRATIVA",
    name: "Despesas Administrativas",
    type: "EXPENSE" as const,
  },
] as const;

const costCenters = [
  { code: "OPERACAO", name: "Operação", unitCode: "ACADEMIA" },
  { code: "OPERACAO", name: "Operação", unitCode: "CLINICA" },
] as const;

const accounts = [
  {
    code: "NUBANK",
    name: "Nubank",
    type: "BANK" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "SUMUP",
    name: "SumUp",
    type: "BANK" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "CAIXA_FISICO",
    name: "Caixa físico Academia",
    type: "CASH" as const,
    unitCode: "ACADEMIA",
  },
  {
    code: "CAIXA",
    name: "Caixa Clínica",
    type: "CASH" as const,
    unitCode: "CLINICA",
  },
] as const;

const paymentMethods = [
  { code: "DINHEIRO", name: "Dinheiro", type: "CASH" as const },
  { code: "PIX", name: "PIX", type: "PIX" as const },
  { code: "DEBITO", name: "Cartão de débito", type: "DEBIT_CARD" as const },
  { code: "CREDITO", name: "Cartão de crédito", type: "CREDIT_CARD" as const },
  {
    code: "TRANSFERENCIA",
    name: "Transferência bancária",
    type: "BANK_TRANSFER" as const,
  },
] as const;

async function main() {
  const units = await prisma.businessUnit.findMany({
    where: { code: { in: ["ACADEMIA", "CLINICA", "PERSONAL"] } },
    select: { id: true, code: true, status: true },
  });
  const byCode = new Map(units.map((unit) => [unit.code, unit]));
  for (const code of ["ACADEMIA", "CLINICA", "PERSONAL"] as const) {
    const unit = byCode.get(code);
    if (!unit || unit.status !== "ACTIVE") {
      throw new Error(`BusinessUnit ${code} não existe ou está inativa.`);
    }
  }

  await prisma.$transaction(async (transaction) => {
    for (const category of categories) {
      await transaction.financialCategory.upsert({
        where: { code: category.code },
        update: {},
        create: {
          code: category.code,
          name: category.name,
          type: category.type,
          businessUnitId:
            "unitCode" in category ? byCode.get(category.unitCode)?.id : undefined,
        },
      });
    }

    await transaction.financialCategory.updateMany({
      where: {
        code: "ACADEMIA_DESPESA_OPERACIONAL",
        businessUnitId: byCode.get("ACADEMIA")!.id,
      },
      data: { status: "INACTIVE" },
    });

    for (const center of costCenters) {
      const businessUnitId = byCode.get(center.unitCode)!.id;
      await transaction.costCenter.upsert({
        where: { businessUnitId_code: { businessUnitId, code: center.code } },
        update: {},
        create: { businessUnitId, code: center.code, name: center.name },
      });
    }

    for (const account of accounts) {
      const businessUnitId = byCode.get(account.unitCode)!.id;
      await transaction.financialAccount.upsert({
        where: { businessUnitId_code: { businessUnitId, code: account.code } },
        update:
          account.unitCode === "ACADEMIA"
            ? { name: account.name, type: account.type, status: "ACTIVE" }
            : {},
        create: {
          businessUnitId,
          code: account.code,
          name: account.name,
          type: account.type,
        },
      });
    }

    await transaction.financialAccount.updateMany({
      where: {
        businessUnitId: byCode.get("ACADEMIA")!.id,
        code: "CAIXA",
      },
      data: { status: "INACTIVE" },
    });

    for (const method of paymentMethods) {
      await transaction.paymentMethod.upsert({
        where: { code: method.code },
        update: {},
        create: method,
      });
    }
  });

  const [categoryCount, costCenterCount, accountCount, paymentMethodCount] =
    await Promise.all([
      prisma.financialCategory.count(),
      prisma.costCenter.count(),
      prisma.financialAccount.count(),
      prisma.paymentMethod.count(),
    ]);
  console.log(
    JSON.stringify({ categoryCount, costCenterCount, accountCount, paymentMethodCount }),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
