"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/actions";

type Mode = "signin" | "signup";

/**
 * AUTH-01 and AUTH-03 on one page. The toggle is local state rather than a
 * second route, so switching modes keeps whatever is already typed.
 *
 * Uses plain state and a direct server-action call rather than useFormState:
 * that hook is not exported by the stable react-dom this project is on, only
 * by the canary types, so it would not type-check.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = isSignUp ? await signUp(formData) : await signIn(formData);

    // On success the action redirects and this never runs.
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">TrustNanny</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Childcare that never doesn&apos;t show up.
        </p>
      </div>

      <div
        className="flex rounded-lg border border-neutral-200 p-1"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isSignUp}
          onClick={() => switchMode("signin")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            !isSignUp
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignUp}
          onClick={() => switchMode("signup")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            isSignUp
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          Create account
        </button>
      </div>

      {/* method="post" is not decoration. Without it, a submit that happens
          before React hydrates falls back to the browser default of GET, and
          the password lands in the URL, the history and the server access log.
          The handler below normally prevents that, but it cannot run if the
          bundle has not loaded yet. */}
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <Field label="Your name" htmlFor="full_name">
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? 6 : undefined}
            className={inputClass}
          />
        </Field>

        {isSignUp && (
          <Field
            label="Youngest child's age in months"
            htmlFor="youngest_child_age_months"
            hint="Sets the certification level a replacement must hold."
          >
            <input
              id="youngest_child_age_months"
              name="youngest_child_age_months"
              type="number"
              inputMode="numeric"
              min={0}
              required
              className={`${inputClass} font-mono tabular-nums`}
            />
          </Field>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
    </main>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
