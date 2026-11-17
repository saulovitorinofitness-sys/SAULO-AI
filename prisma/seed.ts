import "dotenv/config";

import { randomBytes, scryptSync } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CLINIC_INSTITUTIONAL_CONFIG } from "../src/config/institution";
import {
  LABORATORY_EXAM_CATALOG,
  normalizeLaboratoryExamCatalogName,
} from "../src/features/exam-requests/laboratory-exam-catalog";
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

const businessUnitDefinitions = [
  { code: "ACADEMIA", name: "Academia Saulo Fitness" },
  { code: "PERSONAL", name: "Personal" },
  {
    code: "CLINICA",
    name: CLINIC_INSTITUTIONAL_CONFIG.brand.displayName,
    address: CLINIC_INSTITUTIONAL_CONFIG.address,
  },
] as const;

const nutritionModuleKeys = [
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "NUTRITION_EVOLUTION",
] as const;
const posturalOperationalActions = ["CREATE", "UPDATE", "DELETE", "MANAGE"] as const;

const credentialProvisioningEnvironment = {
  userId: "AUTH_SEED_USER_ID",
  login: "AUTH_SEED_LOGIN",
  password: "AUTH_SEED_PASSWORD",
} as const;

const scryptParameters = {
  cost: 32768,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
  saltLength: 16,
} as const;

function hasSecureInitialPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /\p{Ll}/u.test(password) &&
    /\p{Lu}/u.test(password) &&
    /\p{N}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password) &&
    !/[\u0000-\u001F\u007F]/u.test(password)
  );
}

function createCredentialHash(password: string) {
  const salt = randomBytes(scryptParameters.saltLength);
  const derivedKey = scryptSync(password, salt, scryptParameters.keyLength, {
    N: scryptParameters.cost,
    r: scryptParameters.blockSize,
    p: scryptParameters.parallelization,
    maxmem: scryptParameters.maxmem,
  });

  return [
    "scrypt",
    "v=1",
    `N=${scryptParameters.cost},r=${scryptParameters.blockSize},p=${scryptParameters.parallelization}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

async function provisionOptionalCredential() {
  const configuredUserId = process.env[credentialProvisioningEnvironment.userId];
  const configuredLogin = process.env[credentialProvisioningEnvironment.login];
  const configuredPassword = process.env[credentialProvisioningEnvironment.password];

  if (!configuredUserId && !configuredLogin && !configuredPassword) {
    console.info("Credencial local não provisionada: configuração opcional ausente.");
    return;
  }

  if (!configuredUserId || !configuredLogin || !configuredPassword) {
    console.info("Credencial local não provisionada: configuração opcional incompleta.");
    return;
  }

  const userId = configuredUserId.trim();
  const login = configuredLogin.trim().toLowerCase();
  const validUserId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    );
  const validLogin =
    login.length >= 3 &&
    login.length <= 254 &&
    !/[\s\u0000-\u001F\u007F]/u.test(login);

  if (!validUserId || !validLogin) {
    console.info("Credencial local não provisionada: identificação inválida.");
    return;
  }

  if (!hasSecureInitialPassword(configuredPassword)) {
    console.info(
      "Credencial local não provisionada: a senha inicial não atende aos requisitos de segurança.",
    );
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!user) {
      console.info("Credencial local não provisionada: usuário não encontrado.");
      return;
    }

    if (user.status !== "ACTIVE" || user.deletedAt) {
      console.info("Credencial local não provisionada: usuário não está ativo.");
      return;
    }

    const [loginOwner, userCredentials] = await Promise.all([
      prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: "CREDENTIALS",
            providerSubject: login,
          },
        },
        select: { id: true, userId: true },
      }),
      prisma.authIdentity.findMany({
        where: { provider: "CREDENTIALS", userId: user.id },
        select: { id: true },
        take: 2,
      }),
    ]);

    if (loginOwner && loginOwner.userId !== user.id) {
      console.info("Credencial local não provisionada: identificador indisponível.");
      return;
    }

    if (userCredentials.length > 1) {
      console.info("Credencial local não provisionada: identidade local ambígua.");
      return;
    }

    const credentialHash = createCredentialHash(configuredPassword);
    const existingCredential = loginOwner ?? userCredentials[0];

    if (existingCredential) {
      await prisma.authIdentity.update({
        where: { id: existingCredential.id },
        data: { providerSubject: login, credentialHash },
      });
    } else {
      await prisma.authIdentity.create({
        data: {
          userId: user.id,
          provider: "CREDENTIALS",
          providerSubject: login,
          credentialHash,
        },
      });
    }

    console.info("Credencial local provisionada com sucesso.");
  } catch {
    console.info("Credencial local não provisionada: falha segura na operação.");
  }
}

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

  for (const definition of businessUnitDefinitions) {
    const address = "address" in definition ? {
      addressStreet: definition.address.street,
      addressNumber: definition.address.number,
      addressComplement: null,
      addressNeighborhood: definition.address.neighborhood,
      addressPostalCode: definition.address.postalCode.replace(/\D/gu, ""),
      addressCity: definition.address.city,
      addressState: definition.address.state,
    } : {};
    await prisma.businessUnit.upsert({
      where: { code: definition.code },
      update: { name: definition.name, status: "ACTIVE", ...address },
      create: { code: definition.code, name: definition.name, status: "ACTIVE", ...address },
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
      allowsNutritionModules: true,
      isSystem: true,
    },
    create: {
      id: BUILT_IN_IDS.roles.sharedProfessional,
      key: "SHARED_PROFESSIONAL",
      name: "Profissional com dados compartilhados",
      grantsAllModules: true,
      allowsNutritionModules: true,
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
    create: {
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      type: "SYSTEM_OWNER",
      professionalRegistration: "CRN 11 — 22529/P-CE",
      professionalTitle: "Nutricionista",
    },
  });

  for (const item of LABORATORY_EXAM_CATALOG) {
    const normalizedName = normalizeLaboratoryExamCatalogName(item.name);
    const metadata = {
      category: item.category,
      synonyms: [...item.synonyms],
      attributes: { category: item.category, synonyms: [...item.synonyms] },
      reusableBy: ["Solicitações de exames"],
      catalogPurpose: "Seleção manual; sem decisão clínica automática",
    };
    await prisma.scientificLibraryRecord.upsert({
      where: {
        createdByUserId_area_domain_normalizedName: {
          createdByUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
          area: "NUTRITION",
          domain: "LABORATORY_EXAM",
          normalizedName,
        },
      },
      create: {
        createdByUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
        updatedByUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
        area: "NUTRITION",
        domain: "LABORATORY_EXAM",
        name: item.name,
        normalizedName,
        description: "Nome padronizado para seleção manual em solicitações de exames.",
        tags: [...item.synonyms],
        source: "Catálogo operacional da Biblioteca Científica",
        status: "ACTIVE",
        originKind: "MANUAL",
        metadata,
        dataNature: "OPERATIONAL",
        editorialStatus: "DRAFT",
      },
      update: {
        updatedByUserId: BUILT_IN_IDS.users.sauloXavierVitorino,
        name: item.name,
        description: "Nome padronizado para seleção manual em solicitações de exames.",
        tags: [...item.synonyms],
        source: "Catálogo operacional da Biblioteca Científica",
        status: "ACTIVE",
        metadata,
        dataNature: "OPERATIONAL",
      },
    });
  }

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

  const nutritionModules = await prisma.systemModule.findMany({
    where: { key: { in: [...nutritionModuleKeys] } },
    select: { id: true },
  });
  await prisma.userPermission.deleteMany({
    where: {
      userId: BUILT_IN_IDS.users.mariaDeLourdesGomes,
      moduleId: { in: nutritionModules.map((module) => module.id) },
      effect: "DENY",
    },
  });

  const posturalModule = await prisma.systemModule.findUniqueOrThrow({
    where: { key: "POSTURAL_ASSESSMENT" },
    select: { id: true },
  });
  await prisma.userPermission.deleteMany({
    where: {
      userId: BUILT_IN_IDS.users.sauloXavierVitorino,
      moduleId: posturalModule.id,
      action: { in: [...posturalOperationalActions] },
      effect: "DENY",
    },
  });

  await provisionOptionalCredential();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
