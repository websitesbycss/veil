"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type ShotItem = {
  id: string;
  sort_order: number;
  grouping_label: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
};

type Vendor = {
  id: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type QueuedUpdate = { itemId: string; completed: boolean };

// Persist token per weddingId in sessionStorage
function getStoredToken(weddingId: string) {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`checklist_token_${weddingId}`);
}
function storeToken(weddingId: string, token: string) {
  sessionStorage.setItem(`checklist_token_${weddingId}`, token);
}

export function ChecklistApp({ weddingId }: { weddingId: string }) {
  const [phase, setPhase] = useState<"pin" | "loading" | "checklist" | "error">("pin");
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [shooterName, setShooterName] = useState("");
  const [items, setItems] = useState<ShotItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [view, setView] = useState<"shots" | "vendors">("shots");
  const [errorMsg, setErrorMsg] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const updateQueue = useRef<QueuedUpdate[]>([]);
  const flushing = useRef(false);

  // Detect online/offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Check for stored token on mount
  useEffect(() => {
    const stored = getStoredToken(weddingId);
    if (stored) {
      setToken(stored);
      loadItems(stored);
    }
  }, [weddingId]);

  async function loadItems(tok: string) {
    setPhase("loading");
    try {
      const res = await fetch(`/api/checklist/items?weddingId=${weddingId}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(`checklist_token_${weddingId}`);
          setPhase("pin");
          return;
        }
        throw new Error("Failed to load");
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setShooterName(data.shooterName ?? "");
      setPhase("checklist");
      // Cache in localStorage for offline use
      localStorage.setItem(`checklist_items_${weddingId}`, JSON.stringify(data.items ?? []));

      // Fetch vendors too (best-effort, non-blocking)
      fetch(`/api/checklist/vendors?weddingId=${weddingId}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
        .then((r) => (r.ok ? r.json() : { vendors: [] }))
        .then((v) => {
          const vs = (v.vendors ?? []) as Vendor[];
          setVendors(vs);
          localStorage.setItem(`checklist_vendors_${weddingId}`, JSON.stringify(vs));
        })
        .catch(() => {
          const cached = localStorage.getItem(`checklist_vendors_${weddingId}`);
          if (cached) setVendors(JSON.parse(cached));
        });
    } catch {
      // Try offline cache
      const cached = localStorage.getItem(`checklist_items_${weddingId}`);
      if (cached) {
        setItems(JSON.parse(cached));
        setPhase("checklist");
      } else {
        setErrorMsg("Could not load checklist. Check your connection.");
        setPhase("error");
      }
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    try {
      const res = await fetch("/api/checklist/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Invalid PIN.");
        setPin("");
        return;
      }
      storeToken(weddingId, data.token);
      setToken(data.token);
      setShooterName(data.shooterName ?? "");
      await loadItems(data.token);
    } catch {
      setErrorMsg("Network error. Please try again.");
    }
  }

  const flushQueue = useCallback(async () => {
    if (flushing.current || updateQueue.current.length === 0 || !token) return;
    flushing.current = true;

    const toFlush = [...updateQueue.current];
    updateQueue.current = [];
    setPendingCount(0);

    for (const update of toFlush) {
      try {
        await fetch(`/api/checklist/items?weddingId=${weddingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(update),
        });
      } catch {
        // Re-queue on failure
        updateQueue.current.push(update);
        setPendingCount((n) => n + 1);
      }
    }
    flushing.current = false;
  }, [token, weddingId]);

  function handleToggle(item: ShotItem) {
    const next = !item.completed;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, completed: next, completed_at: next ? new Date().toISOString() : null }
          : i
      )
    );

    // Update cache
    const updated = items.map((i) =>
      i.id === item.id
        ? { ...i, completed: next, completed_at: next ? new Date().toISOString() : null }
        : i
    );
    localStorage.setItem(`checklist_items_${weddingId}`, JSON.stringify(updated));

    if (navigator.onLine) {
      fetch(`/api/checklist/items?weddingId=${weddingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId: item.id, completed: next }),
      }).catch(() => {
        updateQueue.current.push({ itemId: item.id, completed: next });
        setPendingCount((n) => n + 1);
      });
    } else {
      updateQueue.current.push({ itemId: item.id, completed: next });
      setPendingCount((n) => n + 1);
    }
  }

  const completedCount = items.filter((i) => i.completed).length;

  // PIN entry screen
  if (phase === "pin") {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-white mb-1 text-center">Veil Checklist</h1>
          <p className="text-stone-400 text-sm text-center mb-8">Enter your PIN to access the shot list</p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="tel"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").substring(0, 4))}
              placeholder="••••"
              autoFocus
              className="w-full text-center text-3xl tracking-widest font-mono px-4 py-4 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {errorMsg && (
              <p className="text-red-400 text-sm text-center">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={pin.length !== 4}
              className="w-full py-4 bg-amber-500 text-stone-900 font-semibold rounded-xl disabled:opacity-40 text-lg transition-colors hover:bg-amber-400"
            >
              Open checklist
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-stone-300 mb-4">{errorMsg}</p>
        <button
          onClick={() => setPhase("pin")}
          className="px-6 py-3 bg-amber-500 text-stone-900 font-semibold rounded-xl"
        >
          Try again
        </button>
      </div>
    );
  }

  // Main checklist
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-900 border-b border-stone-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold">Shot List</h1>
            {shooterName && (
              <p className="text-stone-500 text-xs">{shooterName}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-mono font-semibold">
              {completedCount}/{items.length}
            </p>
            {!isOnline && (
              <p className="text-xs text-amber-600">Offline</p>
            )}
            {pendingCount > 0 && isOnline && (
              <p className="text-xs text-stone-500">Syncing…</p>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-300"
            style={{ width: items.length > 0 ? `${(completedCount / items.length) * 100}%` : "0%" }}
          />
        </div>
        {/* View switcher */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setView("shots")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === "shots"
                ? "bg-amber-500 text-stone-900"
                : "bg-stone-800 text-stone-400"
            }`}
          >
            Shots
          </button>
          <button
            type="button"
            onClick={() => setView("vendors")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === "vendors"
                ? "bg-amber-500 text-stone-900"
                : "bg-stone-800 text-stone-400"
            }`}
          >
            Vendors {vendors.length > 0 && `(${vendors.length})`}
          </button>
        </div>
      </div>

      {/* Items */}
      {view === "shots" && (
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex items-center justify-center h-48 text-stone-500 text-sm">
            No shots yet.
          </div>
        )}
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleToggle(item)}
            className={`w-full flex items-start gap-4 px-5 py-5 text-left border-b border-stone-800 transition-colors active:bg-stone-800 ${
              item.completed ? "opacity-50" : ""
            }`}
          >
            <div
              className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                item.completed
                  ? "bg-amber-500 border-amber-500"
                  : "border-stone-600"
              }`}
            >
              {item.completed && (
                <svg className="w-4 h-4 text-stone-900" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-base leading-snug ${item.completed ? "text-stone-500 line-through" : "text-white"}`}>
                <span className="text-stone-600 mr-2">{i + 1}.</span>
                {item.grouping_label}
              </p>
              {item.notes && !item.completed && (
                <p className="text-stone-500 text-sm mt-1">{item.notes}</p>
              )}
            </div>
          </button>
        ))}
      </div>
      )}

      {view === "vendors" && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {vendors.length === 0 && (
            <div className="flex items-center justify-center h-48 text-stone-500 text-sm">
              No vendors listed.
            </div>
          )}
          {vendors.map((v) => (
            <div key={v.id} className="bg-stone-800 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                {v.role}
              </p>
              <p className="text-white font-medium">{v.name}</p>
              <div className="flex flex-wrap gap-3 mt-2">
                {v.phone && (
                  <a
                    href={`tel:${v.phone}`}
                    className="text-amber-400 text-sm underline"
                  >
                    {v.phone}
                  </a>
                )}
                {v.email && (
                  <a
                    href={`mailto:${v.email}`}
                    className="text-amber-400 text-sm underline"
                  >
                    {v.email}
                  </a>
                )}
              </div>
              {v.notes && (
                <p className="text-stone-400 text-sm mt-2">{v.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completion banner */}
      {view === "shots" && items.length > 0 && completedCount === items.length && (
        <div className="sticky bottom-0 bg-amber-500 text-stone-900 text-center py-4 font-semibold">
          All shots complete!
        </div>
      )}
    </div>
  );
}
