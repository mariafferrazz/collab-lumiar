import "server-only";

export function LocalDevelopmentBanner() {
  if (process.env.DATABASE_ENVIRONMENT !== "local") return null;

  return (
    <div
      className="bg-brand px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-cream"
      role="status"
    >
      Desenvolvimento local · dados isolados da Railway
    </div>
  );
}
