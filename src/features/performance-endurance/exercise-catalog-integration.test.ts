import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { GET, POST } from "@/app/api/performance/exercises/route";
import { PATCH } from "@/app/api/performance/exercises/[exerciseId]/route";
import { DEVELOPMENT_PROFESSIONALS } from "@/features/development-session";
import { prisma } from "@/lib/database/prisma";

import { exerciseCatalogRepository } from "./exercise-catalog-repository";
import { normalizeExerciseName } from "./exercise-library-contracts";

const professionalUserId = DEVELOPMENT_PROFESSIONALS.saulo.user.id;

test("Performance lê o catálogo mestre ativo e preserva o legado sem copiar registros", async () => {
  const suffix = randomUUID();
  const scientificIds = [randomUUID(), randomUUID(), randomUUID()];
  const legacyId = randomUUID();
  const systemModule = await prisma.systemModule.findUnique({
    where: { key: "WORKOUT_PLAN" },
    select: { id: true },
  });
  assert.ok(systemModule);
  try {
    await prisma.scientificLibraryRecord.createMany({
      data: [
        {
          id: scientificIds[0],
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          reviewedByUserId: professionalUserId,
          area: "PERFORMANCE",
          domain: "EXERCISE",
          name: `Registro mestre temporário ${suffix}`,
          normalizedName: normalizeExerciseName(`Registro mestre temporário ${suffix}`),
          description: "Fixture temporária de integração.",
          tags: ["busca-integracao-temporaria"],
          source: "Teste automatizado local",
          status: "ACTIVE",
          originKind: "MANUAL",
          metadata: {
            attributes: {
              Modalidade: "Musculação",
              "Padrão de movimento": "Agachar",
              Classificações: ["Multiarticular"],
              "Grupos musculares / regiões": ["Quadríceps"],
              Equipamentos: ["Barra"],
              "Execução técnica": "Execução temporária.",
            },
            reusableBy: [],
          },
          reviewedAt: new Date(),
        },
        {
          id: scientificIds[1],
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          area: "PERFORMANCE",
          domain: "EXERCISE",
          name: `Registro em revisão temporário ${suffix}`,
          normalizedName: normalizeExerciseName(`Registro em revisão temporário ${suffix}`),
          source: "Teste automatizado local",
          status: "REVIEW",
          originKind: "MANUAL",
        },
        {
          id: scientificIds[2],
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          area: "NUTRITION",
          domain: "EXERCISE",
          name: `Registro fora da área temporário ${suffix}`,
          normalizedName: normalizeExerciseName(`Registro fora da área temporário ${suffix}`),
          source: "Teste automatizado local",
          status: "ACTIVE",
          originKind: "MANUAL",
        },
      ],
    });
    await prisma.exerciseLibraryItem.create({
      data: {
        id: legacyId,
        moduleId: systemModule.id,
        createdByUserId: professionalUserId,
        updatedByUserId: professionalUserId,
        name: `Registro legado temporário ${suffix}`,
        normalizedName: normalizeExerciseName(`Registro legado temporário ${suffix}`),
        category: "OTHER",
        active: true,
      },
    });

    const masterSearch = await exerciseCatalogRepository.search({
      professionalUserId,
      query: "agachar",
      active: true,
    });
    assert.equal(masterSearch.items.length, 1);
    assert.equal(masterSearch.items[0].id, scientificIds[0]);
    assert.equal(masterSearch.items[0].sourceKind, "SCIENTIFIC_LIBRARY");
    assert.equal(masterSearch.items[0].category, "STRENGTH");
    assert.equal(masterSearch.items[0].muscleGroup, "Quadríceps");
    assert.equal(masterSearch.items[0].equipment, "Barra");

    const all = await exerciseCatalogRepository.search({
      professionalUserId,
      active: true,
    });
    assert.ok(all.items.some((item) => item.id === scientificIds[0]));
    assert.ok(all.items.some((item) => item.id === legacyId));
    assert.equal(all.items.some((item) => item.id === scientificIds[1]), false);
    assert.equal(all.items.some((item) => item.id === scientificIds[2]), false);

    const response = await GET(
      new Request("http://localhost/api/performance/exercises?query=busca-integracao-temporaria&status=ACTIVE"),
    );
    const payload = (await response.json()) as { items: Array<{ id: string }> };
    assert.equal(response.status, 200);
    assert.deepEqual(payload.items.map((item) => item.id), [scientificIds[0]]);

    const blockedCreation = await POST(
      new Request("http://localhost/api/performance/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Não deve ser criado" }),
      }),
    );
    assert.equal(blockedCreation.status, 405);
    assert.equal(blockedCreation.headers.get("Allow"), "GET");

    const legacyUpdate = await PATCH(
      new Request(`http://localhost/api/performance/exercises/${legacyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Registro legado atualizado ${suffix}`,
          category: "OTHER",
          muscleGroup: "",
          equipment: "",
          description: "",
          executionInstructions: "",
          professionalNotes: "Fixture temporária.",
          active: true,
        }),
      }),
      { params: Promise.resolve({ exerciseId: legacyId }) },
    );
    const legacyPayload = (await legacyUpdate.json()) as {
      exercise?: { id: string; name: string };
    };
    assert.equal(legacyUpdate.status, 200);
    assert.equal(legacyPayload.exercise?.id, legacyId);
    assert.equal(legacyPayload.exercise?.name, `Registro legado atualizado ${suffix}`);
  } finally {
    await prisma.exerciseLibraryItem.deleteMany({ where: { id: legacyId } });
    await prisma.scientificLibraryRecord.deleteMany({
      where: { id: { in: scientificIds } },
    });
  }
});
