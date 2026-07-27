import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const moduleDefinitions = [
  ["00000000-0000-4000-8000-000000000201", "AUTHENTICATION", "Autenticação", false],
  ["00000000-0000-4000-8000-000000000202", "USERS", "Usuários", false],
  ["00000000-0000-4000-8000-000000000203", "PROFILES", "Perfis", false],
  ["00000000-0000-4000-8000-000000000204", "PERMISSIONS", "Permissões", false],
  ["00000000-0000-4000-8000-000000000205", "PATIENTS", "Pacientes", false],
  ["00000000-0000-4000-8000-000000000206", "MASTER_RECORD", "Prontuário Mestre", false],
  ["00000000-0000-4000-8000-000000000207", "SCHEDULING", "Agenda", false],
  ["00000000-0000-4000-8000-000000000208", "ATTENDANCE", "Atendimento", false],
  ["00000000-0000-4000-8000-000000000209", "BIOIMPEDANCE", "Bioimpedância", false],
  ["00000000-0000-4000-8000-000000000210", "PERIMETRY", "Perimetria", false],
  ["00000000-0000-4000-8000-000000000211", "PHYSICAL_ASSESSMENT", "Avaliação Física", false],
  ["00000000-0000-4000-8000-000000000212", "POSTURAL_ASSESSMENT", "Avaliação Postural", false],
  ["00000000-0000-4000-8000-000000000221", "NUTRITION_STRATEGY", "Estratégia Nutricional", true],
  ["00000000-0000-4000-8000-000000000213", "MEAL_PLAN", "Plano Alimentar", true],
  ["00000000-0000-4000-8000-000000000214", "WORKOUT_PLAN", "Plano de Treino", false],
  ["00000000-0000-4000-8000-000000000215", "REPORTS", "Relatórios", false],
  ["00000000-0000-4000-8000-000000000216", "DELIVERABLES", "Entregáveis", false],
  ["00000000-0000-4000-8000-000000000217", "AUDIT", "Auditoria", false],
  ["00000000-0000-4000-8000-000000000218", "CLINICAL_REASONING", "Motor de Decisão Clínica", false],
  ["00000000-0000-4000-8000-000000000219", "CLINICAL_EVOLUTION", "Continuidade e Evolução Clínica", false],
  ["00000000-0000-4000-8000-000000000220", "NUTRITION_EVOLUTION", "Evolução Nutricional", true],
] as const;

const nutritionDeniedModuleKeys = [
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "NUTRITION_EVOLUTION",
] as const;
const nutritionDeniedActions = ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "MANAGE"] as const;
const posturalOperationalDeniedActions = ["CREATE", "UPDATE", "DELETE", "MANAGE"] as const;

async function ensurePatientClinicalCodeSequence() {
  await prisma.$executeRaw`
    CREATE SEQUENCE IF NOT EXISTS "Patient_clinicalCode_seq"
      AS BIGINT
      MINVALUE 1
      MAXVALUE 999999
      START WITH 1
      INCREMENT BY 1
      NO CYCLE
  `;

  await prisma.$executeRaw`
    DO $$
    DECLARE
      "highestClinicalCode" BIGINT;
      "sequenceLastValue" BIGINT;
      "sequenceIsCalled" BOOLEAN;
      "nextSequenceValue" BIGINT;
    BEGIN
      SELECT COALESCE(
        MAX(SUBSTRING("clinicalCode" FROM 3)::BIGINT),
        0
      )
      INTO "highestClinicalCode"
      FROM "Patient"
      WHERE "clinicalCode" ~ '^SV[0-9]{6}$';

      IF "highestClinicalCode" >= 999999 THEN
        RAISE EXCEPTION
          'A sequência de códigos clínicos SV atingiu o limite de SV999999.';
      END IF;

      SELECT "last_value", "is_called"
      INTO "sequenceLastValue", "sequenceIsCalled"
      FROM "Patient_clinicalCode_seq";

      "nextSequenceValue" := GREATEST(
        CASE
          WHEN "sequenceIsCalled" THEN "sequenceLastValue" + 1
          ELSE "sequenceLastValue"
        END,
        "highestClinicalCode" + 1
      );

      PERFORM SETVAL(
        '"Patient_clinicalCode_seq"',
        "nextSequenceValue",
        FALSE
      );
    END
    $$
  `;
}

async function main() {
  await ensurePatientClinicalCodeSequence();

  for (const [id, key, name, nutritionRestricted] of moduleDefinitions) {
    await prisma.systemModule.upsert({
      where: { key },
      update: { name, nutritionRestricted, active: true },
      create: { id, key, name, nutritionRestricted, active: true },
    });
  }

  await prisma.role.upsert({
    where: { key: "SYSTEM_OWNER" },
    update: {
      name: "Proprietário do sistema",
      grantsAllModules: true,
      allowsNutritionModules: true,
      isSystem: true,
    },
    create: {
      id: BUILT_IN_IDS.roles.systemOwner,
      key: "SYSTEM_OWNER",
      name: "Proprietário do sistema",
      grantsAllModules: true,
      allowsNutritionModules: true,
      isSystem: true,
    },
  });

  await prisma.role.upsert({
    where: { key: "SHARED_PROFESSIONAL" },
    update: {
      name: "Profissional com dados compartilhados",
      grantsAllModules: true,
      allowsNutritionModules: false,
      isSystem: true,
    },
    create: {
      id: BUILT_IN_IDS.roles.sharedProfessional,
      key: "SHARED_PROFESSIONAL",
      name: "Profissional com dados compartilhados",
      grantsAllModules: true,
      allowsNutritionModules: false,
      isSystem: true,
    },
  });

  await prisma.user.upsert({
    where: { id: BUILT_IN_IDS.users.sauloXavierVitorino },
    update: { fullName: "Saulo Xavier Vitorino", status: "ACTIVE" },
    create: {
      id: BUILT_IN_IDS.users.sauloXavierVitorino,
      fullName: "Saulo Xavier Vitorino",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { id: BUILT_IN_IDS.users.mariaDeLourdesGomes },
    update: { fullName: "Maria de Lourdes Gomes", status: "ACTIVE" },
    create: {
      id: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      fullName: "Maria de Lourdes Gomes",
      status: "ACTIVE",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: BUILT_IN_IDS.users.sauloXavierVitorino },
    update: { type: "SYSTEM_OWNER" },
    create: { userId: BUILT_IN_IDS.users.sauloXavierVitorino, type: "SYSTEM_OWNER" },
  });

  await prisma.userProfile.upsert({
    where: { userId: BUILT_IN_IDS.users.mariaDeLourdesGomes },
    update: {
      type: "PROFESSIONAL",
      professionalRegistration: "CREF 019480-G",
      professionalTitle: "Profissional de Educação Física",
      professionalPhone: "(88) 99606-6757",
      professionalInstagram: "@lurdinhapersonal",
    },
    create: {
      userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      type: "PROFESSIONAL",
      professionalRegistration: "CREF 019480-G",
      professionalTitle: "Profissional de Educação Física",
      professionalPhone: "(88) 99606-6757",
      professionalInstagram: "@lurdinhapersonal",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        roleId: BUILT_IN_IDS.roles.systemOwner,
      },
    },
    update: {},
    create: {
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      roleId: BUILT_IN_IDS.roles.systemOwner,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
        roleId: BUILT_IN_IDS.roles.sharedProfessional,
      },
    },
    update: {},
    create: {
      userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      roleId: BUILT_IN_IDS.roles.sharedProfessional,
    },
  });

  for (const moduleKey of nutritionDeniedModuleKeys) {
    const nutritionModule = await prisma.systemModule.findUniqueOrThrow({
      where: { key: moduleKey },
    });

    for (const action of nutritionDeniedActions) {
      await prisma.userPermission.upsert({
        where: {
          userId_moduleId_action: {
            userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
            moduleId: nutritionModule.id,
            action,
          },
        },
        update: { effect: "DENY" },
        create: {
          userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
          moduleId: nutritionModule.id,
          action,
          effect: "DENY",
        },
      });
    }
  }

  const posturalModule = await prisma.systemModule.findUniqueOrThrow({
    where: { key: "POSTURAL_ASSESSMENT" },
  });
  for (const action of posturalOperationalDeniedActions) {
    await prisma.userPermission.upsert({
      where: {
        userId_moduleId_action: {
          userId: BUILT_IN_IDS.users.sauloXavierVitorino,
          moduleId: posturalModule.id,
          action,
        },
      },
      update: { effect: "DENY" },
      create: {
        userId: BUILT_IN_IDS.users.sauloXavierVitorino,
        moduleId: posturalModule.id,
        action,
        effect: "DENY",
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
