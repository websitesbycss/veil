"use client";

import Link from "next/link";

type WeddingStatus = "inquiry" | "consultation" | "booked" | "active" | "delivered" | "archived";

type Wedding = {
  id: string;
  wedding_date: string | null;
  venue_name: string | null;
  status: WeddingStatus;
  client1: { first_name: string; last_name: string } | null;
  client2: { first_name: string; last_name: string } | null;
};

const COLUMNS: { key: WeddingStatus; label: string; color: string }[] = [
  { key: "inquiry", label: "Inquiry", color: "bg-stone-100 border-stone-200" },
  { key: "consultation", label: "Consultation", color: "bg-blue-50 border-blue-200" },
  { key: "booked", label: "Booked", color: "bg-amber-50 border-amber-200" },
  { key: "active", label: "Active", color: "bg-green-50 border-green-200" },
  { key: "delivered", label: "Delivered", color: "bg-purple-50 border-purple-200" },
  { key: "archived", label: "Archived", color: "bg-stone-50 border-stone-200" },
];

function WeddingCard({ wedding }: { wedding: Wedding }) {
  const coupleNames = [wedding.client1, wedding.client2]
    .filter(Boolean)
    .map((c) => c!.first_name)
    .join(" & ") || "Unnamed couple";

  const dateStr = wedding.wedding_date
    ? new Date(wedding.wedding_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Link
      href={`/weddings/${wedding.id}`}
      className="block bg-white border border-stone-200 rounded-lg p-3 hover:border-stone-400 hover:shadow-sm transition-all group"
    >
      <p className="text-sm font-medium text-stone-900 group-hover:text-stone-700">
        {coupleNames}
      </p>
      {dateStr && (
        <p className="text-xs text-stone-400 mt-0.5">{dateStr}</p>
      )}
      {wedding.venue_name && (
        <p className="text-xs text-stone-400 mt-0.5 truncate">{wedding.venue_name}</p>
      )}
    </Link>
  );
}

export function Kanban({ weddings }: { weddings: Wedding[] }) {
  const byStatus = COLUMNS.reduce(
    (acc, col) => ({
      ...acc,
      [col.key]: weddings.filter((w) => w.status === col.key),
    }),
    {} as Record<WeddingStatus, Wedding[]>
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max px-4 pt-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="w-60 flex-shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                {col.label}
              </span>
              <span className="text-xs text-stone-400">{byStatus[col.key].length}</span>
            </div>
            <div
              className={`min-h-24 rounded-xl border p-2 space-y-2 ${col.color}`}
            >
              {byStatus[col.key].map((w) => (
                <WeddingCard key={w.id} wedding={w} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
