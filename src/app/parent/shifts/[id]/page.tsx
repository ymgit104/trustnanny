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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit shift</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {formatShiftDate(shift.shift_date)}
        </p>
        <Link
          href="/parent/shifts"
          className="mt-1 inline-block text-sm text-neutral-600 hover:text-neutral-900"
        >
          Back to shifts
        </Link>
      </header>

      <ShiftForm caregivers={caregivers} shift={shift} />
    </main>
  );
}
