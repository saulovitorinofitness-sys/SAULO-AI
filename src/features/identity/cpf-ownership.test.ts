import assert from "node:assert/strict";
import test from "node:test";

import { assertCpfAvailableForPerson, CpfOwnershipError } from "./cpf-ownership";

function client(conflict: "patient" | "employee" | "provider" | null) {
  const result = (owner: typeof conflict) => async () => owner === conflict ? { id: `${owner}-id` } : null;
  return {
    patient: { findFirst: result("patient") },
    employee: { findFirst: result("employee") },
    professionalServiceLegalProvider: { findFirst: result("provider") },
  } as never;
}

for (const owner of ["patient", "employee", "provider"] as const) {
  test(`bloqueia CPF já pertencente a ${owner}`, async () => {
    await assert.rejects(
      assertCpfAvailableForPerson("529.982.247-25", {}, client(owner)),
      (error: unknown) => error instanceof CpfOwnershipError && error.code === "CPF_ALREADY_ASSIGNED",
    );
  });
}

test("aceita CPF ainda sem proprietário", async () => {
  await assert.doesNotReject(assertCpfAvailableForPerson("529.982.247-25", {}, client(null)));
});
