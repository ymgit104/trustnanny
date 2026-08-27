"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string };

/**
 * Server actions return `{ error }` on failure and redirect on success.
 *
 * `redirect()` works by throwing a control-flow signal that Next catches, so
 * none of these calls may sit inside a try/catch that swallows it - the
 * navigation would be eaten and the user would sit on a form that appears to
 * have done nothing.
 */

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function signIn(formData: FormData): Promise<AuthResult | void> {
  const email = readString(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/");
}

export async function signUp(formData: FormData): Promise<AuthResult | void> {
  const fullName = readString(formData, "full_name");
  const email = readString(formData, "email");
  const password = String(formData.get("password") ?? "");
  const monthsRaw = readString(formData, "youngest_child_age_months");

  if (!fullName) return { error: "Enter your name." };
  if (!email) return { error: "Enter your email." };
  if (password.length < 6) {
    return { error: "Password needs to be at least 6 characters." };
  }

  const months = Number(monthsRaw);
  if (!monthsRaw || !Number.isInteger(months) || months < 0) {
    return { error: "Enter your youngest child's age in whole months." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Metadata only. The database trigger on auth.users creates the profile
      // from these keys, so a second insert from here is not just redundant -
      // it can half-fail and leave an account that logs in and then crashes
      // every page. Key names must match the trigger exactly. `role` is
      // omitted on purpose: the trigger coerces anything that is not
      // 'caregiver' to 'parent', and signup is parents only.
      data: {
        full_name: fullName,
        youngest_child_age_months: months,
      },
    },
  });

  if (error) return { error: error.message };

  // No session means email confirmation is still switched on in Supabase.
  // Saying so beats a silent dead end on a form that looks like it worked.
  if (!data.session) {
    return {
      error: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
