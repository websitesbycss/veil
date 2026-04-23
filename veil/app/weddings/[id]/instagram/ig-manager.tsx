"use client";

import { useState, useTransition } from "react";
import {
  generateIgCaption,
  createIgPost,
  publishIgPost,
  deleteIgPost,
} from "@/app/actions/instagram";

type IgPost = {
  id: string;
  caption: string | null;
  hashtags: string | null;
  image_urls: string[] | null;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  ig_media_id: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  published: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export function IgManager({
  weddingId,
  posts: initialPosts,
  isConnected,
}: {
  weddingId: string;
  posts: IgPost[];
  isConnected: boolean;
}) {
  const [posts, setPosts] = useState<IgPost[]>(initialPosts);
  const [imageUrls, setImageUrls] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [vibe, setVibe] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerateCaption() {
    setError(null);
    if (!imageUrls.trim()) {
      setError("Add at least one image URL before generating a caption.");
      return;
    }
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("imageUrls", imageUrls.trim());
    if (vibe.trim()) fd.set("vibe", vibe.trim());

    startTransition(async () => {
      const result = await generateIgCaption(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setCaption(result.caption);
      setHashtags(result.hashtags);
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("caption", caption);
    if (hashtags.trim()) fd.set("hashtags", hashtags.trim());
    fd.set("imageUrls", imageUrls.trim());
    if (scheduledAt) fd.set("scheduledAt", new Date(scheduledAt).toISOString());

    startTransition(async () => {
      const result = await createIgPost(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      const urls = imageUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const newPost: IgPost = {
        id: result.postId,
        caption,
        hashtags: hashtags || null,
        image_urls: urls,
        status: scheduledAt ? "scheduled" : "draft",
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ig_media_id: null,
        created_at: new Date().toISOString(),
      };
      setPosts((prev) => [newPost, ...prev]);
      setImageUrls("");
      setCaption("");
      setHashtags("");
      setVibe("");
      setScheduledAt("");
    });
  }

  function handlePublish(postId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("postId", postId);
    startTransition(async () => {
      const result = await publishIgPost(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, status: "published" as const, ig_media_id: result.mediaId ?? null }
            : p
        )
      );
    });
  }

  function handleDelete(postId: string) {
    const fd = new FormData();
    fd.set("postId", postId);
    startTransition(async () => {
      const result = await deleteIgPost(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    });
  }

  return (
    <div className="space-y-6">
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-900">
              Instagram is not connected.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Connect your business account to publish posts directly.
            </p>
          </div>
          <a
            href="/api/instagram/oauth/start"
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Connect Instagram
          </a>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-stone-700">Create a new post</h2>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Image URLs <span className="text-stone-400 font-normal">(one per line, up to 10)</span>
          </label>
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            maxLength={5000}
            rows={4}
            required
            placeholder="https://yourgallery.com/photo-1.jpg"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
          />
          <p className="text-xs text-stone-400 mt-1">
            Must be publicly accessible HTTPS URLs (Instagram requirement).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Vibe <span className="text-stone-400 font-normal">(optional, feeds the AI)</span>
          </label>
          <input
            type="text"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            maxLength={500}
            placeholder="Golden hour on a bluff, intimate and candid"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerateCaption}
          className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:border-stone-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Generating…" : "✨ Draft caption with AI"}
        </button>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={6}
            required
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Hashtags <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="#weddingphotographer #[cityname]wedding #[venuename]"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Schedule for <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <p className="text-xs text-stone-400 mt-1">
            Leave empty to save as draft and publish manually.
          </p>
        </div>

        {error && (
          <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !caption || !imageUrls}
          className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : scheduledAt ? "Schedule post" : "Save draft"}
        </button>
      </form>

      {posts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Posts ({posts.length})
          </h2>
          {posts.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-stone-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    STATUS_STYLES[p.status] ?? STATUS_STYLES.draft
                  }`}
                >
                  {p.status}
                </span>
                <span className="text-xs text-stone-400">
                  {p.scheduled_at
                    ? `Scheduled ${new Date(p.scheduled_at).toLocaleString()}`
                    : new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>

              {p.image_urls && p.image_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {p.image_urls.slice(0, 10).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded flex-shrink-0 bg-stone-100"
                    />
                  ))}
                </div>
              )}

              <p className="text-sm text-stone-800 whitespace-pre-wrap">{p.caption}</p>
              {p.hashtags && (
                <p className="text-xs text-stone-500 whitespace-pre-wrap">{p.hashtags}</p>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                {p.status !== "published" && (
                  <button
                    type="button"
                    disabled={isPending || !isConnected}
                    onClick={() => handlePublish(p.id)}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
                  >
                    Publish now
                  </button>
                )}
                {p.status === "published" && p.ig_media_id && (
                  <span className="text-xs text-stone-500">
                    Published — media ID {p.ig_media_id}
                  </span>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(p.id)}
                  className="ml-auto text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {posts.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">
          No posts yet. Create your first one above.
        </p>
      )}
    </div>
  );
}
