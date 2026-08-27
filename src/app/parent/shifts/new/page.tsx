import Link from "next/link";
import { ShiftForm } from "@/components/shift-form";
import { requireRole } from "@/lib/auth";
import { listAvailableCaregivers } from "@/lib/queries";

/** CRUD-01. Same form component as the edit route. */
export default async function NewShiftPage() {
  await requireRole("parent");
  const caregivers = await listAvailableCaregivers();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Schedule a shift
        </h1>
        <Link
          href="/parent/shifts"
          className="mt-1 inline-block text-sm text-neutral-600 hover:text-neutral-900"
        >
          Back to shifts
        </Link>
      </header>

      <ShiftForm caregivers={caregivers} />
    </main>
  );
}
