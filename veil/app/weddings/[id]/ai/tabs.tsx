"use client";

import { useState } from "react";
import { GhostwriterPanel } from "./ghostwriter-panel";
import { QuotePanel } from "./quote-panel";
import { BlogPanel } from "./blog-panel";

type AiDraft = {
  id: string;
  draft_type: string;
  content: string;
  status: string;
  created_at: string;
};

export function AiTabs({
  weddingId,
  emailDrafts,
  quoteDrafts,
  blogDrafts,
}: {
  weddingId: string;
  emailDrafts: AiDraft[];
  quoteDrafts: AiDraft[];
  blogDrafts: AiDraft[];
}) {
  const [tab, setTab] = useState<"email" | "quote" | "blog">("email");

  const tabs = [
    { id: "email" as const, label: "Emails", count: emailDrafts.length },
    { id: "quote" as const, label: "Quotes", count: quoteDrafts.length },
    { id: "blog" as const, label: "Blog posts", count: blogDrafts.length },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-stone-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 text-xs text-stone-400">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "email" && (
        <GhostwriterPanel weddingId={weddingId} existingDrafts={emailDrafts} />
      )}
      {tab === "quote" && (
        <QuotePanel weddingId={weddingId} existingDrafts={quoteDrafts} />
      )}
      {tab === "blog" && (
        <BlogPanel weddingId={weddingId} existingDrafts={blogDrafts} />
      )}
    </div>
  );
}
