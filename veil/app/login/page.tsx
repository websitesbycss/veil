"use client";

import { useState, useTransition } from "react";
import { signInWithPassword, signInWithMagicLink, signUp } from "@/app/actions/auth";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let result: { error?: string; success?: string } | undefined;

      if (mode === "signin") {
        result = await signInWithPassword(formData);
      } else if (mode === "signup") {
        result = await signUp(formData);
      } else {
        result = await signInWithMagicLink(formData);
      }

      if (result?.error) setMessage({ type: "error", text: result.error });
      if (result?.success) setMessage({ type: "success", text: result.success });
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Veil</h1>
          <p className="mt-1 text-sm text-stone-500">The studio OS for wedding photographers.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border border-stone-200 rounded-lg p-1 mb-6 bg-stone-100">
          {(["signin", "signup", "magic"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMessage(null); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                mode === m
                  ? "bg-white text-stone-900 shadow-sm font-medium"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {m === "signin" ? "Sign in" : m === "signup" ? "Sign up" : "Magic link"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent"
              placeholder="you@studio.com"
            />
          </div>

          {mode !== "magic" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          )}

          {message && (
            <p
              className={`text-sm rounded-lg px-3 py-2 ${
                message.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? "..."
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send magic link"}
          </button>
        </form>
      </div>
    </div>
  );
}
