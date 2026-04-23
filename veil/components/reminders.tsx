"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissMilestone } from "@/app/actions/milestones";

type Reminder = {
  id: string;
  weddingId: string;
  type: string;
  label: string;
  triggerDate: string;
  couple: string;
};

export function Reminders({ items }: { items: Reminder[] }) {
  const [list, setList] = useState<Reminder[]>(items);
  const [isPending, startTransition] = useTransition();

  if (list.length === 0) return null;

  function handleDismiss(id: string) {
    const fd = new FormData();
    fd.set("milestoneId", id);
    startTransition(async () => {
      const result = await dismissMilestone(fd);
      if ("error" in result) return;
      setList((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-amber-900">
          Reminders ({list.length})
        </h2>
        <span className="text-xs text-amber-700">Anniversary outreach due</span>
      </div>
      <ul className="divide-y divide-amber-100">
        {list.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-stone-800">
                <span className="font-medium">{r.couple}</span> — {r.label}
              </p>
              <p className="text-xs text-stone-500">
                {new Date(r.triggerDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" }
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/weddings/${r.weddingId}/ai`}
                className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Draft email
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDismiss(r.id)}
                className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
