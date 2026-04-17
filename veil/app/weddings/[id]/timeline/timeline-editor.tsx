"use client";

import { useState, useTransition, useRef } from "react";
import {
  generateTimeline,
  reorderBlocks,
  updateBlock,
  deleteBlock,
  addBlock,
} from "@/app/actions/timeline";

type TimelineBlock = {
  id: string;
  sort_order: number;
  label: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
};

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${suffix}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TimelineEditor({
  weddingId,
  initialBlocks,
  goldenHour,
}: {
  weddingId: string;
  initialBlocks: TimelineBlock[];
  goldenHour: string | null;
}) {
  const [blocks, setBlocks] = useState<TimelineBlock[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TimelineBlock>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Drag state
  const dragIndex = useRef<number | null>(null);

  function handleGenerate() {
    setError(null);
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    startTransition(async () => {
      const result = await generateTimeline(fd);
      if ("error" in result) {
        setError(result.error ?? "Error");
        return;
      }
      setBlocks(result.blocks ?? []);
    });
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addBlock(weddingId);
      if ("error" in result) {
        setError(result.error ?? "Error");
        return;
      }
      if (result.block) {
        setBlocks((prev) => [...prev, result.block!]);
        setEditingId(result.block.id);
        setEditForm(result.block);
      }
    });
  }

  function startEdit(block: TimelineBlock) {
    setEditingId(block.id);
    setEditForm({
      label: block.label,
      start_time: block.start_time.substring(0, 5),
      duration_minutes: block.duration_minutes,
      location: block.location ?? "",
      notes: block.notes ?? "",
    });
  }

  function saveEdit(blockId: string) {
    startTransition(async () => {
      const result = await updateBlock({
        blockId,
        weddingId,
        label: editForm.label ?? "",
        start_time: editForm.start_time ?? "00:00",
        duration_minutes: editForm.duration_minutes ?? 30,
        location: editForm.location || undefined,
        notes: editForm.notes || undefined,
      });
      if (result && "error" in result) {
        setError(result.error ?? "Error");
        return;
      }
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                label: editForm.label ?? b.label,
                start_time: (editForm.start_time ?? b.start_time.substring(0, 5)) + ":00",
                duration_minutes: editForm.duration_minutes ?? b.duration_minutes,
                location: editForm.location || null,
                notes: editForm.notes || null,
              }
            : b
        )
      );
      setEditingId(null);
    });
  }

  function handleDelete(blockId: string) {
    startTransition(async () => {
      await deleteBlock(blockId, weddingId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (editingId === blockId) setEditingId(null);
    });
  }

  // Drag-and-drop reorder
  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;

    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      dragIndex.current = index;
      return next;
    });
  }

  function onDrop() {
    dragIndex.current = null;
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("orderedIds", JSON.stringify(blocks.map((b) => b.id)));
    startTransition(async () => {
      await reorderBlocks(fd);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Generating…" : blocks.length > 0 ? "Regenerate with AI" : "Generate with AI"}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="px-4 py-2 border border-stone-200 text-stone-700 text-sm font-medium rounded-lg hover:border-stone-400 disabled:opacity-50 transition-colors"
        >
          + Add block
        </button>
      </div>

      {error && (
        <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {blocks.length === 0 && (
        <div className="text-center py-16 text-stone-400 text-sm">
          No timeline yet. Generate one with AI or add blocks manually.
        </div>
      )}

      {/* Timeline blocks */}
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const isGolden =
            goldenHour !== null && block.start_time.substring(0, 5) === goldenHour;
          const isEditing = editingId === block.id;

          return (
            <div
              key={block.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={onDrop}
              className={`bg-white border rounded-xl overflow-hidden select-none ${
                isGolden ? "border-amber-300" : "border-stone-200"
              }`}
            >
              {!isEditing ? (
                // View mode
                <div className="flex items-start gap-4 px-4 py-3 cursor-grab active:cursor-grabbing">
                  <div className="flex-shrink-0 w-16 text-right">
                    <p className="text-sm font-mono text-stone-500">
                      {formatTime(block.start_time)}
                    </p>
                    <p className="text-xs text-stone-300">{formatDuration(block.duration_minutes)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-stone-900">{block.label}</p>
                      {isGolden && (
                        <span className="text-xs text-amber-600 font-medium">Golden hour</span>
                      )}
                    </div>
                    {block.location && (
                      <p className="text-xs text-stone-400 mt-0.5">{block.location}</p>
                    )}
                    {block.notes && (
                      <p className="text-xs text-stone-400 mt-0.5 italic">{block.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(block)}
                      className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(block.id)}
                      disabled={isPending}
                      className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                // Edit mode
                <div className="px-4 py-4 space-y-3 bg-stone-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">Label</label>
                      <input
                        type="text"
                        value={editForm.label ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                        maxLength={200}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Start time</label>
                      <input
                        type="time"
                        value={editForm.start_time ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={editForm.duration_minutes ?? 30}
                        min={1}
                        max={480}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))
                        }
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Location</label>
                      <input
                        type="text"
                        value={editForm.location ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                        maxLength={200}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={editForm.notes ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                        maxLength={1000}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(block.id)}
                      disabled={isPending}
                      className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-sm text-stone-500 hover:text-stone-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
