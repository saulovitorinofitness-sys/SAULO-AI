import { NextResponse } from "next/server";
import { z } from "zod";

import { patientRegistrationRepository } from "@/features/patient-registration";
import { CpfOwnershipError } from "@/features/identity/cpf-ownership";
import { canAccess, mvpService } from "@/features/mvp";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional();

const patientListQuerySchema = z.object({
  query: z.string().trim().max(180).optional(),
  page: z.coerce.number().int().positive().default(1),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  birthDate: z.iso.date().refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date <= new Date();
  }, "Data de nascimento inválida."),
  sex: z.enum(["FEMALE", "MALE", "INTERSEX", "NOT_INFORMED"]),
  phone: z.object({
    type: z.enum(["MOBILE", "HOME", "WORK", "OTHER"]),
    countryCode: z.string().regex(/^\d{1,3}$/),
    areaCode: z.string().regex(/^\d{2,3}$/),
    number: z.string().regex(/^\d{8,11}$/),
  }),
  preferredName: optionalText(180),
  cpf: z.string().regex(/^\d{11}$/).optional(),
  email: z.email().max(255).optional(),
  maritalStatus: z
    .enum([
      "SINGLE",
      "MARRIED",
      "DIVORCED",
      "WIDOWED",
      "SEPARATED",
      "DOMESTIC_PARTNERSHIP",
      "NOT_INFORMED",
    ])
    .optional(),
  profession: optionalText(180),
  observations: optionalText(4000),
  address: z
    .object({
      street: optionalText(255),
      number: optionalText(30),
      complement: optionalText(120),
      neighborhood: optionalText(120),
      city: optionalText(120),
      state: z.string().trim().toUpperCase().length(2).optional(),
      postalCode: z.string().regex(/^\d{8}$/).optional(),
      countryCode: z.string().length(2),
    })
    .optional(),
  insurance: z
    .object({
      providerName: optionalText(180),
      planName: optionalText(180),
      memberNumber: optionalText(100),
      validUntil: z.iso.date().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      fullName: optionalText(180),
      relationship: optionalText(100),
      phone: optionalText(30),
      email: z.email().max(255).optional(),
    })
    .optional(),
});

function databaseErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

export async function GET(request: Request) {
  const access = await mvpService.getSession();

  if (!canAccess(access, "PATIENTS", "READ")) {
    return NextResponse.json(
      { message: "Seu perfil não permite visualizar pacientes." },
      { status: 403 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = patientListQuerySchema.safeParse({
    query: searchParams.get("query") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    status: searchParams.get("status") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Parâmetros de consulta inválidos." },
      { status: 400 },
    );
  }

  const result = await patientRegistrationRepository.listPage(parsed.data);

  return NextResponse.json({
    patients: result.items,
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function POST(request: Request) {
  const access = await mvpService.getSession();

  if (!canAccess(access, "PATIENTS", "CREATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite cadastrar pacientes." },
      { status: 403 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Não foi possível interpretar os dados enviados." },
      { status: 400 },
    );
  }

  const parsed = registrationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Revise os campos destacados e tente novamente.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await patientRegistrationRepository.register(
      parsed.data,
      access.user.id,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CpfOwnershipError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409 },
      );
    }
    if (databaseErrorCode(error) === "P2002") {
      return NextResponse.json(
        { message: "Já existe um paciente cadastrado com este CPF." },
        { status: 409 },
      );
    }

    console.error("Falha ao cadastrar paciente.", error);

    return NextResponse.json(
      {
        message:
          "Não foi possível cadastrar o paciente. Os dados preenchidos foram mantidos para uma nova tentativa.",
      },
      { status: 503 },
    );
  }
}
