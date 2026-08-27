/**
 * Reads an environment variable and fails loudly if it is missing.
 *
 * Takes the value, not just the name, because Next.js only inlines
 * `NEXT_PUBLIC_*` variables into the browser bundle when they are accessed
 * statically - `process.env.NEXT_PUBLIC_FOO`. A dynamic lookup like
 * `process.env[name]` is left untouched and arrives in the browser as
 * undefined. Call sites therefore pass the static access in, and this function
 * only handles the error message.
 *
 * The alternative, `process.env.FOO!`, type-checks fine and then fails at
 * runtime somewhere deep inside the Supabase client with no clue which
 * variable was missing.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () =>
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

/** The sb_publishable_ key. Safe in the browser. */
export const SUPABASE_PUBLISHABLE_KEY = () =>
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
