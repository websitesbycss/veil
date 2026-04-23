"use client";

import { useState, useTransition } from "react";
import { generateBlogPost, updateDraftStatus, deleteDraft } from "@/app/actions/ai";

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

export function BlogPanel({
  weddingId,
  existingDrafts,
}: {
  weddingId: string;
  existingDrafts: AiDraft[];
}) {
  const [drafts, setDrafts] = useState<AiDraft[]>(existingDrafts);
  const [targetCity, setTargetCity] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [keyMoments, setKeyMoments] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("targetCity", targetCity.trim());
    if (imageUrls.trim()) fd.set("imageUrls", imageUrls.trim());
    if (keyMoments.trim()) fd.set("keyMoments", keyMoments.trim());

    startTransition(async () => {
      const result = await generateBlogPost(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      const newDraft: AiDraft = {
        id: result.draftId,
        draft_type: "blog_post",
        content: result.content,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      setDrafts((prev) => [newDraft, ...prev]);
      setExpandedId(newDraft.id);
      setImageUrls("");
      setKeyMoments("");
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

  function extractTitle(content: string): string {
    const m = content.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : "Blog post";
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-stone-700">Generate a new blog post</h2>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Target city market
          </label>
          <input
            type="text"
            value={targetCity}
            onChange={(e) => setTargetCity(e.target.value)}
            maxLength={100}
            placeholder="E.g. Nashville, Napa, Austin"
            required
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <p className="text-xs text-stone-400 mt-1">
            Used as the secondary SEO keyword: "[city] wedding photographer"
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Gallery photo URLs <span className="text-stone-400 font-normal">(optional, one per line)</span>
          </label>
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="https://yourgallery.com/photo-1.jpg&#10;https://yourgallery.com/photo-2.jpg"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
          />
          <p className="text-xs text-stone-400 mt-1">
            AI will insert [IMAGE: url] markers where each photo should appear.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Key moments to highlight <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={keyMoments}
            onChange={(e) => setKeyMoments(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="First look at the carriage house. Grandmother's veil handoff. Sparkler exit at midnight."
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
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
          {isPending ? "Generating…" : "Generate blog post"}
        </button>
      </form>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Blog posts ({drafts.length})
          </h2>

          {drafts.map((draft) => {
            const isExpanded = expandedId === draft.id;
            const title = extractTitle(draft.content);

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
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-stone-800 truncate">
                      {title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${
                        STATUS_STYLES[draft.status] ?? STATUS_STYLES.draft
                      }`}
                    >
                      {draft.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
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

                    <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
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
                          Mark as published
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
          No blog posts yet. Generate your first one above.
        </p>
      )}
    </div>
  );
}
