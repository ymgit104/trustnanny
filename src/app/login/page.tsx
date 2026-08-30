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

    // On success the action redirects, so this only runs on failure.
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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <ShieldMark />
          <span className="text-xl font-bold tracking-tight text-trust">
            TrustNanny
          </span>
        </div>
        <h1 className="mt-6 text-left text-2xl font-bold tracking-tight text-ink">
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-left text-sm text-ink-soft">
          {isSignUp
            ? "Childcare that never doesn't show up."
            : "Sign in to your community."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-trust-tint p-1">
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className={`rounded px-3 py-2 text-sm font-semibold transition ${
              mode === value
                ? "bg-white text-ink shadow-focus"
                : "text-trust hover:text-trust-deep"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* method="post" is not decoration. Without it, a submit that happens
          before React hydrates falls back to the browser default of GET, and
          the password lands in the URL, the history and the server access log.
          The handler below normally prevents that, but it cannot run if the
          bundle has not loaded yet. */}
      <form method="post" onSubmit={handleSubmit} className="card p-5">
        <div className="flex flex-col gap-4">
          {isSignUp && (
            <Field label="Full name" htmlFor="full_name">
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                placeholder="Priya Reddy"
                required
                className="field"
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              className="field"
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
              className="field"
            />
          </Field>

          {isSignUp && (
            <Field
              label="Youngest child's age (months)"
              htmlFor="youngest_child_age_months"
              hint="Sets the certification level a replacement must hold."
            >
              <input
                id="youngest_child_age_months"
                name="youngest_child_age_months"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="14"
                required
                className="field font-mono tabular-nums"
              />
            </Field>
          )}

          {error && (
            <p
              role="alert"
              className="rounded border border-critical/20 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending
              ? isSignUp
                ? "Creating account…"
                : "Signing in…"
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}

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
      <label htmlFor={htmlFor} className="label-caps">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function ShieldMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-trust"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 4 5.5v6c0 5 3.4 8.9 8 10.5 4.6-1.6 8-5.5 8-10.5v-6L12 2Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}
