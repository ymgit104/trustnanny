import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/auth";

// Placeholder. Today's shift, check-in state, the absence button and the live
// search all land here in a later step.
export default async function ParentDashboard() {
  const profile = await requireRole("parent");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hello, {profile.full_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">Parent dashboard</p>
        </div>
        <SignOutButton />
      </header>

      <dl className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <Row label="Role" value={profile.role} />
        <Row label="Plan" value={profile.plan_tier} />
        <Row
          label="Backup credits"
          value={String(profile.backup_credits_remaining)}
          mono
        />
        <Row
          label="Youngest child"
          value={
            profile.youngest_child_age_months === null
              ? "Not set"
              : `${profile.youngest_child_age_months} months`
          }
          mono={profile.youngest_child_age_months !== null}
        />
      </dl>

      <p className="text-sm text-neutral-500">
        Your shifts and the absence flow arrive next.
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-600">{label}</dt>
      <dd className={mono ? "font-mono tabular-nums" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
