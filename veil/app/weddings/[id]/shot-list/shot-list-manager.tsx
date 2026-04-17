"use client";

import { useState, useTransition } from "react";
import {
  generateShotList,
  toggleShotComplete,
  createSecondShooter,
  deleteSecondShooter,
} from "@/app/actions/shot-list";

type ShotListItem = {
  id: string;
  sort_order: number;
  grouping_label: string;
  notes: string | null;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
};

type SecondShooter = { id: string; name: string };

export function ShotListManager({
  weddingId,
  initialItems,
  initialShooters,
  hasFamilyMembers,
}: {
  weddingId: string;
  initialItems: ShotListItem[];
  initialShooters: SecondShooter[];
  hasFamilyMembers: boolean;
}) {
  const [items, setItems] = useState<ShotListItem[]>(initialItems);
  const [shooters, setShooters] = useState<SecondShooter[]>(initialShooters);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Second shooter form
  const [shooterName, setShooterName] = useState("");
  const [shooterPin, setShooterPin] = useState("");
  const [newPinInfo, setNewPinInfo] = useState<{ name: string; pin: string } | null>(null);
  const [showAddShooter, setShowAddShooter] = useState(false);

  const completedCount = items.filter((i) => i.completed).length;

  function handleGenerate() {
    setError(null);
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    startTransition(async () => {
      const result = await generateShotList(fd);
      if ("error" in result) {
        setError(result.error ?? "Error");
        return;
      }
      setItems(result.items ?? []);
    });
  }

  function handleToggle(item: ShotListItem) {
    const next = !item.completed;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: next } : i))
    );
    startTransition(async () => {
      await toggleShotComplete({ itemId: item.id, weddingId, completed: next });
    });
  }

  function handleAddShooter(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("name", shooterName);
    fd.set("pin", shooterPin);
    startTransition(async () => {
      const result = await createSecondShooter(fd);
      if ("error" in result) {
        setError(result.error ?? "Error");
        return;
      }
      if (result.shooter) {
        setShooters((prev) => [...prev, result.shooter!]);
        setNewPinInfo({ name: result.shooter.name, pin: result.pin! });
        setShooterName("");
        setShooterPin("");
        setShowAddShooter(false);
      }
    });
  }

  function handleDeleteShooter(shooterId: string) {
    startTransition(async () => {
      await deleteSecondShooter(shooterId, weddingId);
      setShooters((prev) => prev.filter((s) => s.id !== shooterId));
    });
  }

  const checklistUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checklist/${weddingId}`
      : `/checklist/${weddingId}`;

  return (
    <div className="space-y-6">
      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || !hasFamilyMembers}
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
          title={!hasFamilyMembers ? "Add family members in the intake form first" : undefined}
        >
          {isPending ? "Generating…" : items.length > 0 ? "Regenerate with AI" : "Generate with AI"}
        </button>
        {!hasFamilyMembers && (
          <p className="text-xs text-stone-400">
            Add family members in the intake form to generate a shot list.
          </p>
        )}
        {items.length > 0 && (
          <span className="text-sm text-stone-400 ml-auto">
            {completedCount}/{items.length} done
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Shot list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                item.completed
                  ? "bg-stone-50 border-stone-100"
                  : "bg-white border-stone-200"
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(item)}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.completed
                    ? "bg-stone-800 border-stone-800 text-white"
                    : "border-stone-300 hover:border-stone-500"
                }`}
              >
                {item.completed && (
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    item.completed ? "line-through text-stone-400" : "text-stone-800"
                  }`}
                >
                  <span className="text-stone-400 mr-2">{i + 1}.</span>
                  {item.grouping_label}
                </p>
                {item.notes && (
                  <p className="text-xs text-stone-400 mt-0.5 italic">{item.notes}</p>
                )}
                {item.completed && item.completed_at && (
                  <p className="text-xs text-stone-300 mt-0.5">
                    Done{" "}
                    {new Date(item.completed_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && hasFamilyMembers && (
        <div className="text-center py-12 text-stone-400 text-sm">
          Ready to generate. Click above to create the shot list.
        </div>
      )}

      {/* Second shooter section */}
      <div className="border-t border-stone-100 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Second shooter access</h2>
          <button
            type="button"
            onClick={() => setShowAddShooter((v) => !v)}
            className="text-sm text-stone-600 hover:text-stone-900 underline"
          >
            {showAddShooter ? "Cancel" : "+ Add second shooter"}
          </button>
        </div>

        {/* New PIN notice */}
        {newPinInfo && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-green-800">
              Second shooter added: {newPinInfo.name}
            </p>
            <p className="text-sm text-green-700 mt-1">
              PIN: <span className="font-mono font-bold text-lg">{newPinInfo.pin}</span>
            </p>
            <p className="text-xs text-green-600 mt-1">
              Share this URL + PIN with your second shooter:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs bg-white border border-green-200 rounded px-2 py-1 flex-1 overflow-x-auto">
                {checklistUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(`${checklistUrl}\nPIN: ${newPinInfo.pin}`).catch(() => {})}
                className="text-xs text-green-600 hover:text-green-800 underline"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNewPinInfo(null)}
              className="text-xs text-green-500 mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Add shooter form */}
        {showAddShooter && (
          <form onSubmit={handleAddShooter} className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Name</label>
                <input
                  type="text"
                  value={shooterName}
                  onChange={(e) => setShooterName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Sarah"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">4-digit PIN</label>
                <input
                  type="text"
                  value={shooterPin}
                  onChange={(e) => setShooterPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
                  required
                  pattern="\d{4}"
                  placeholder="e.g. 2847"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending || shooterPin.length !== 4}
              className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              Add second shooter
            </button>
          </form>
        )}

        {/* Existing shooters */}
        {shooters.length > 0 && (
          <div className="space-y-2">
            {shooters.map((shooter) => (
              <div
                key={shooter.id}
                className="flex items-center justify-between px-4 py-3 bg-white border border-stone-200 rounded-xl"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">{shooter.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Checklist URL: {checklistUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteShooter(shooter.id)}
                  disabled={isPending}
                  className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
