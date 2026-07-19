import { FormField, Textarea } from "@/components/ui";

export interface MeetingMinutesValue {
  decisions: string;
  pendingItems: string;
  responsiblePeople: string;
  notes: string;
}

export function MeetingMinutes({ value, onChange }: { value: MeetingMinutesValue; onChange: (value: MeetingMinutesValue) => void }) {
  const fields = [
    { key: "decisions", label: "Decisões tomadas" }, { key: "pendingItems", label: "Pendências" },
    { key: "responsiblePeople", label: "Responsáveis" }, { key: "notes", label: "Observações" },
  ] as const;
  return <div className="grid gap-4">{fields.map((field) => <FormField help="Registro demonstrativo, sem persistência real." id={`minutes-${field.key}`} key={field.key} label={field.label}><Textarea className="mt-2" id={`minutes-${field.key}`} onChange={(event) => onChange({ ...value, [field.key]: event.target.value })} placeholder={`Registrar ${field.label.toLocaleLowerCase("pt-BR")}...`} value={value[field.key]} /></FormField>)}</div>;
}

