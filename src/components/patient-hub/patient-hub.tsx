"use client";

import { useEffect, useState } from "react";

import {
  patientHubService,
  type PatientHubView,
} from "@/features/patient-hub";

import { PatientCurrentStatus } from "./patient-current-status";
import { PatientModuleGrid } from "./patient-module-grid";
import { PatientNextAction } from "./patient-next-action";

export function PatientHub({
  initialHub,
}: {
  initialHub: PatientHubView;
}) {
  const [hub, setHub] = useState(initialHub);

  useEffect(() => {
    let active = true;

    void patientHubService
      .get({
        patientId: initialHub.header.patientId,
        scenario: initialHub.scenario,
      })
      .then((updated) => {
        if (active && updated) {
          setHub(updated);
        }
      });

    return () => {
      active = false;
    };
  }, [initialHub]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <PatientCurrentStatus hub={hub} />
      </section>

      <section>
        <PatientNextAction action={hub.nextAction} />
      </section>

      <section>
        <PatientModuleGrid
          modules={hub.modules.filter(
            (module) => module.id !== "ATTENDANCES",
          )}
        />
      </section>
    </div>
  );
}