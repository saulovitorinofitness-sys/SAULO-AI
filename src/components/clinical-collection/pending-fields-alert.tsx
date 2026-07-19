export function PendingFieldsAlert({ fields }: { fields: readonly string[] }) {
  if (!fields.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="alert">
      <p className="text-sm font-black">{fields.length} {fields.length === 1 ? "campo obrigatório pendente" : "campos obrigatórios pendentes"}</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">{fields.slice(0, 6).join(" · ")}{fields.length > 6 ? ` · +${fields.length - 6}` : ""}</p>
    </div>
  );
}
