import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/auth";

// Placeholder. My shifts, incoming offers and check-in land here in a later
// step.
export default async function CaregiverDashboard() {
  const profile = await requireRole("caregiver");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hello, {profile.full_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">Caregiver dashboard</p>
        </div>
        <SignOutButton />
      </header>

      <dl className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
        <Row label="Role" value={profile.role} />
        <Row
          label="Level"
          value={profile.level === null ? "Not set" : String(profile.level)}
          mono={profile.level !== null}
        />
        <Row label="Tenure" value={`${profile.tenure_months} months`} mono />
        <Row
          label="Available"
          value={profile.is_available ? "Yes" : "No"}
        />
      </dl>

      <p className="text-sm text-neutral-500">
        Your shifts and incoming offers arrive next.
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
