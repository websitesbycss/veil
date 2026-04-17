"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "@/app/actions/onboarding";

type EmailSample = { subject: string; body: string; tone_tags: string };

const EMPTY_SAMPLE: EmailSample = { subject: "", body: "", tone_tags: "" };

export default function OnboardingPage() {
  const [samples, setSamples] = useState<EmailSample[]>([{ ...EMPTY_SAMPLE }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addSample() {
    if (samples.length < 5) setSamples((s) => [...s, { ...EMPTY_SAMPLE }]);
  }

  function removeSample(i: number) {
    setSamples((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSample(i: number, field: keyof EmailSample, value: string) {
    setSamples((s) => s.map((smp, idx) => (idx === i ? { ...smp, [field]: value } : smp)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    // Inject sample data into formData
    samples.forEach((smp, i) => {
      formData.set(`sample_subject_${i}`, smp.subject);
      formData.set(`sample_body_${i}`, smp.body);
      formData.set(`sample_tone_${i}`, smp.tone_tags);
    });

    startTransition(async () => {
      const result = await completeOnboarding(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-stone-900">Set up your studio</h1>
          <p className="mt-1 text-sm text-stone-500">
            This only takes a minute. You can update everything later in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Studio info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
              Studio info
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  name="full_name"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Studio name
                </label>
                <input
                  name="studio_name"
                  type="text"
                  maxLength={100}
                  placeholder="Jane Smith Photography"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Your shooting style / vibe
              </label>
              <textarea
                name="style_notes"
                rows={3}
                maxLength={2000}
                placeholder="E.g. Light and airy, candid documentary moments, romantic editorial details. I love golden hour portraits and unscripted emotion."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
              />
              <p className="mt-1 text-xs text-stone-400">
                Used by AI when generating emails, captions, and blog posts in your voice.
              </p>
            </div>
          </section>

          {/* Email samples */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                  Email samples
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Paste 1–5 real emails you've sent clients. The AI will match your tone exactly.
                </p>
              </div>
              {samples.length < 5 && (
                <button
                  type="button"
                  onClick={addSample}
                  className="text-sm text-stone-600 hover:text-stone-900 underline"
                >
                  + Add another
                </button>
              )}
            </div>

            {samples.map((smp, i) => (
              <div key={i} className="border border-stone-200 rounded-lg p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500">Sample {i + 1}</span>
                  {samples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSample(i)}
                      className="text-xs text-stone-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Subject line (optional)"
                  value={smp.subject}
                  onChange={(e) => updateSample(i, "subject", e.target.value)}
                  maxLength={255}
                  className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <textarea
                  placeholder="Paste the email body here…"
                  value={smp.body}
                  onChange={(e) => updateSample(i, "body", e.target.value)}
                  rows={5}
                  maxLength={10000}
                  className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                />
                <input
                  type="text"
                  placeholder="Tone tags (optional): warm, professional, casual…"
                  value={smp.tone_tags}
                  onChange={(e) => updateSample(i, "tone_tags", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            ))}
          </section>

          {error && (
            <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Setting up your studio…" : "Get started →"}
          </button>
        </form>
      </div>
    </div>
  );
}
