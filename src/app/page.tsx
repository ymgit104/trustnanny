// Placeholder home page. Exists only to prove the skeleton renders: Tailwind
// utilities, the system sans stack, and the mono/tabular stack used for shift
// times. Replaced once the real routes land.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">TrustNanny</h1>
        <p className="mt-1 text-neutral-600">
          Childcare that never doesn&apos;t show up.
        </p>
      </div>

      <dl className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Skeleton</dt>
          <dd className="font-medium">Running</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">Shift time</dt>
          <dd className="font-mono tabular-nums">09:00 &ndash; 17:30</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">Elapsed</dt>
          <dd className="font-mono tabular-nums">00:11 / 90:00</dd>
        </div>
      </dl>

      <p className="text-sm text-neutral-500">
        Nothing is wired up yet. Auth, shifts and dispatch come next.
      </p>
    </main>
  );
}
