import Link from "next/link";
import { notFound } from "next/navigation";
import { ShiftForm } from "@/components/shift-form";
import { requireRole } from "@/lib/auth";
import { formatShiftDate } from "@/lib/format";
import { getShiftForFamily, listAvailableCaregivers } from "@/lib/queries";

/**
 * CRUD-03. Same form component as the create route.
 *
 * getShiftForFamily puts family_id in the query, so another family's shift
 * comes back as null and reads as not found - it is never fetched and then
 * rejected.
 */
export default async function EditShiftPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireRole("parent");

  const [shift, caregivers] = await Promise.all([
    getShiftForFamily(profile.id, params.id),
    listAvailableCaregivers(),
  ]);

  if (!shift) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Edit shift</h1>
        <p className="label-caps mt-1">
          {formatShiftDate(shift.shift_date)}
        </p>
        <Link
          href="/parent/shifts"
          className="font-mono text-xs text-ink-soft transition hover:text-trust"
        >
          Back to shifts
        </Link>
      </header>

      <ShiftForm caregivers={caregivers} shift={shift} />
    </main>
  );
}
