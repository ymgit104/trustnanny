import Link from "next/link";
import { ShiftForm } from "@/components/shift-form";
import { requireRole } from "@/lib/auth";
import { listAvailableCaregivers } from "@/lib/queries";

/** CRUD-01. Same form component as the edit route. */
export default async function NewShiftPage() {
  await requireRole("parent");
  const caregivers = await listAvailableCaregivers();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Schedule a shift
        </h1>
        <Link
          href="/parent/shifts"
          className="font-mono text-xs text-ink-soft transition hover:text-trust"
        >
          Back to shifts
        </Link>
      </header>

      <ShiftForm caregivers={caregivers} />
    </main>
  );
}
