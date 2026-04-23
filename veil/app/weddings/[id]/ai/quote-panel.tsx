"use client";

import { useState, useTransition } from "react";
import { generateQuote, updateDraftStatus, deleteDraft } from "@/app/actions/ai";

type AiDraft = {
  id: string;
  draft_type: string;
  content: string;
  status: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  sent: "bg-stone-100 text-stone-500 border-stone-200",
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simple — elopement or short event",
  standard: "Standard — traditional ceremony + reception",
  premium: "Premium — multi-venue or larger party",
  luxury: "Luxury — destination, editorial, or multi-day",
};

export function QuotePanel({
  weddingId,
  existingDrafts,
}: {
  weddingId: string;
  existingDrafts: AiDraft[];
}) {
  const [drafts, setDrafts] = useState<AiDraft[]>(existingDrafts);
  const [hoursRequested, setHoursRequested] = useState(8);
  const [styleComplexity, setStyleComplexity] = useState("standard");
  const [includeSecondShooter, setIncludeSecondShooter] = useState(false);
  const [includeEngagement, setIncludeEngagement] = useState(false);
  const [basePriceFloor, setBasePriceFloor] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("hoursRequested", String(hoursRequested));
    fd.set("styleComplexity", styleComplexity);
    fd.set("includeSecondShooter", includeSecondShooter ? "true" : "false");
    fd.set("includeEngagement", includeEngagement ? "true" : "false");
    if (basePriceFloor.trim()) fd.set("basePriceFloor", basePriceFloor.trim());
    if (additionalContext.trim()) fd.set("additionalContext", additionalContext.trim());

    startTransition(async () => {
      const result = await generateQuote(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      const newDraft: AiDraft = {
        id: result.draftId,
        draft_type: "quote",
        content: result.content,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      setDrafts((prev) => [newDraft, ...prev]);
      setExpandedId(newDraft.id);
      setAdditionalContext("");
    });
  }

  function handleStatusChange(draftId: string, status: "approved" | "sent") {
    const fd = new FormData();
    fd.set("draftId", draftId);
    fd.set("status", status);
    startTransition(async () => {
      const result = await updateDraftStatus(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, status } : d))
      );
    });
  }

  function handleDelete(draftId: string) {
    startTransition(async () => {
      const result = await deleteDraft(draftId);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (expandedId === draftId) setExpandedId(null);
    });
  }

  function extractHeadline(content: string): string {
    const match = content.match(/\$[\d,]+(?:\.\d{2})?/g);
    if (match && match.length >= 2) {
      return `${match[0]} – ${match[match.length - 1]}`;
    }
    if (match && match.length === 1) return match[0];
    return "Quote";
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-stone-700">Generate a new quote</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Hours of coverage
            </label>
            <input
              type="number"
              min={1}
              max={24}
              value={hoursRequested}
              onChange={(e) => setHoursRequested(Number(e.target.value))}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Style complexity
            </label>
            <select
              value={styleComplexity}
              onChange={(e) => setStyleComplexity(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            >
              {Object.entries(COMPLEXITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Your base price floor <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-stone-400">$</span>
              <input
                type="number"
                min={0}
                max={100000}
                value={basePriceFloor}
                onChange={(e) => setBasePriceFloor(e.target.value)}
                placeholder="3500"
                className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-5 pt-6">
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSecondShooter}
                onChange={(e) => setIncludeSecondShooter(e.target.checked)}
                className="w-4 h-4"
              />
              Second shooter
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEngagement}
                onChange={(e) => setIncludeEngagement(e.target.checked)}
                className="w-4 h-4"
              />
              Engagement session
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Additional context <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            maxLength={1000}
            placeholder="E.g. they have a tight budget, or want a rehearsal dinner add-on"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        {error && (
          <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Generating…" : "Generate quote"}
        </button>
      </form>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Quotes ({drafts.length})
          </h2>

          {drafts.map((draft) => {
            const isExpanded = expandedId === draft.id;
            const headline = extractHeadline(draft.content);

            return (
              <div
                key={draft.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-stone-800">{headline}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        STATUS_STYLES[draft.status] ?? STATUS_STYLES.draft
                      }`}
                    >
                      {draft.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-400">
                      {new Date(draft.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-stone-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-stone-100 px-5 py-4 space-y-4">
                    <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {draft.content}
                    </pre>

                    <div className="flex items-center gap-3 pt-1 border-t border-stone-100">
                      {draft.status === "draft" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStatusChange(draft.id, "approved")}
                          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {(draft.status === "draft" || draft.status === "approved") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStatusChange(draft.id, "sent")}
                          className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
                        >
                          Mark as sent
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          navigator.clipboard.writeText(draft.content).catch(() => {});
                        }}
                        className="px-4 py-2 border border-stone-200 text-stone-700 text-sm font-medium rounded-lg hover:border-stone-400 transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(draft.id)}
                        className="ml-auto text-xs text-stone-400 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {drafts.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">
          No quotes yet. Generate your first one above.
        </p>
      )}
    </div>
  );
}
