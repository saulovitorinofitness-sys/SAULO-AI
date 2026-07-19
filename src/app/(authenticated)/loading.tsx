export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando conteúdo" className="animate-pulse" role="status">
      <div className="h-3 w-32 rounded bg-slate-200" />
      <div className="mt-3 h-9 w-64 max-w-full rounded bg-slate-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 lg:grid-cols-2"><div className="h-64 rounded-2xl border border-slate-200 bg-white" /><div className="h-64 rounded-2xl border border-slate-200 bg-white" /></div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
