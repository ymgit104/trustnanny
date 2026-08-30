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
        className="btn-ghost shrink-0 px-3 py-2 text-xs"
      >
        Sign out
      </button>
    </form>
  );
}
