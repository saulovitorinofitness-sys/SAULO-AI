import { NextResponse } from "next/server";

import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { canAccess, mvpService } from "@/features/mvp";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const [{ patientId, attendanceId }, access] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return NextResponse.json(
      { message: "Seu perfil não permite visualizar esta avaliação." },
      { status: 403 },
    );
  }

  const collection = await clinicalCollectionRepository.getCollection(
    patientId,
    attendanceId,
  );

  if (!collection) {
    return NextResponse.json(
      { message: "Avaliação não encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(collection);
}
