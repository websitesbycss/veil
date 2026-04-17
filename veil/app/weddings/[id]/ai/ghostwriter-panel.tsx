"use client";

import { useState, useTransition } from "react";
import { generateEmailDraft, updateDraftStatus, deleteDraft } from "@/app/actions/ai";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  inquiry_response: "Inquiry response",
  booking_confirmation: "Booking confirmation",
  two_week_checkin: "2-week check-in",
  gallery_delivery: "Gallery delivery",
  anniversary_outreach: "Anniversary outreach",
};

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

export function GhostwriterPanel({
  weddingId,
  existingDrafts,
}: {
  weddingId: string;
  existingDrafts: AiDraft[];
}) {
  const [drafts, setDrafts] = useState<AiDraft[]>(existingDrafts);
  const [selectedType, setSelectedType] = useState("inquiry_response");
  const [additionalContext, setAdditionalContext] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("weddingId", weddingId);
    formData.set("emailType", selectedType);
    if (additionalContext.trim()) formData.set("additionalContext", additionalContext.trim());

    startTransition(async () => {
      const result = await generateEmailDraft(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      const newDraft: AiDraft = {
        id: result.draftId,
        draft_type: "email",
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

  function getEditedContent(draft: AiDraft) {
    return editingContent[draft.id] ?? draft.content;
  }

  // Split content into subject + body
  function parseContent(content: string) {
    const lines = content.trim().split("\n");
    const subjectLine = lines[0].startsWith("Subject:")
      ? lines[0].replace(/^Subject:\s*/i, "")
      : null;
    const bodyStart = subjectLine !== null ? 2 : 0;
    const body = lines.slice(bodyStart).join("\n").trim();
    return { subject: subjectLine, body };
  }

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <form
        onSubmit={handleGenerate}
        className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-stone-700">Generate a new draft</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            >
              {Object.entries(EMAIL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
              placeholder="E.g. they asked about adding an engagement session"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>
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
          {isPending ? "Generating…" : "Generate draft"}
        </button>
      </form>

      {/* Draft list */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Drafts ({drafts.length})
          </h2>

          {drafts.map((draft) => {
            const isExpanded = expandedId === draft.id;
            const { subject, body } = parseContent(getEditedContent(draft));

            return (
              <div
                key={draft.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden"
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-stone-800">
                      {subject ?? EMAIL_TYPE_LABELS["inquiry_response"]}
                    </span>
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

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-stone-100 px-5 py-4 space-y-4">
                    {subject && (
                      <div>
                        <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                          Subject
                        </span>
                        <p className="text-sm text-stone-800 mt-1">{subject}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                        Body
                      </span>
                      <textarea
                        value={editingContent[draft.id] !== undefined ? getEditedContent(draft) : body}
                        onChange={(e) => {
                          const fullContent = subject
                            ? `Subject: ${subject}\n\n${e.target.value}`
                            : e.target.value;
                          setEditingContent((prev) => ({
                            ...prev,
                            [draft.id]: fullContent,
                          }));
                        }}
                        rows={12}
                        className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
                      />
                      <p className="text-xs text-stone-400 mt-1">
                        Edits are local only — copy to your email client when ready.
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
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
                          const content = getEditedContent(draft);
                          navigator.clipboard.writeText(content).catch(() => {});
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
          No drafts yet. Generate your first one above.
        </p>
      )}
    </div>
  );
}
