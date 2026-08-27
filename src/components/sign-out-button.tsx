import { signOut } from "@/lib/actions";

/**
 * AUTH-04. A plain form posting to a server action, so signing out does not
 * depend on client JavaScript having loaded.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-50"
      >
        Sign out
      </button>
    </form>
  );
}
