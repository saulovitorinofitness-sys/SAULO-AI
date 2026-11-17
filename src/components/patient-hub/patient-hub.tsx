"use client";

import type { PatientHubView } from "@/features/patient-hub/contracts";

import { PatientCurrentStatus } from "./patient-current-status";
import { PatientModuleGrid } from "./patient-module-grid";
import { PatientNextAction } from "./patient-next-action";

export function PatientHub({
  initialHub,
}: {
  initialHub: PatientHubView;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <PatientCurrentStatus hub={initialHub} />
      </section>

      <section>
        <PatientNextAction action={initialHub.nextAction} />
      </section>

      <section>
        <PatientModuleGrid
          modules={initialHub.modules.filter(
            (module) => module.id !== "ATTENDANCES",
          )}
        />
      </section>
    </div>
  );
}
