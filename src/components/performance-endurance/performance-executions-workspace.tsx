"use client";

import { useState } from "react";

import { AppleHealthWorkoutImport } from "@/components/performance-monitoring/apple-health-workout-import";
import { RunningExecutionHistory } from "@/components/performance-endurance/running-execution-history";

export function PerformanceExecutionsWorkspace({
  masterRecordId,
  patientName,
}: {
  readonly masterRecordId: string;
  readonly patientName: string;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string>();

  return (
    <div className="space-y-4">
      <AppleHealthWorkoutImport
        masterRecordId={masterRecordId}
        onImported={(message) => {
          setSuccessMessage(message);
          setReloadKey((current) => current + 1);
        }}
        patientName={patientName}
      />

      {successMessage ? (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          {successMessage}
        </p>
      ) : null}

      <RunningExecutionHistory
        masterRecordId={masterRecordId}
        reloadKey={reloadKey}
      />
    </div>
  );
}
