import { PreviousValueIndicator } from "./previous-value-indicator";
import { NumberInput } from "@/components/ui/form";

export function MeasurementField({ id, label, unit, value, previousValue, required = false, readOnly = false, onChange }: { id: string; label: string; unit: string; value?: number; previousValue?: number; required?: boolean; readOnly?: boolean; onChange?: () => void }) {
  return (
    <label className="block min-w-0 text-sm font-bold text-slate-700" htmlFor={id}>
      <span className="flex min-h-9 items-end justify-between gap-2"><span>{label}{required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}</span></span>
      <span className="relative mt-1.5 block">
        <NumberInput
          aria-required={required}
          className={`pr-16 font-semibold ${readOnly ? "bg-slate-100 text-slate-600" : ""}`}
          defaultValue={value}
          id={id}
          inputMode="decimal"
          min="0"
          name={id}
          onChange={onChange}
          readOnly={readOnly}
          required={required}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">{unit}</span>
      </span>
      {previousValue !== undefined ? <span className="mt-1.5 block"><PreviousValueIndicator current={value} previous={previousValue} unit={unit} /></span> : null}
    </label>
  );
}
