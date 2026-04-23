"use client";

import { useState, useTransition } from "react";
import { addVendor, deleteVendor } from "@/app/actions/vendors";

type Vendor = {
  id: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

const COMMON_ROLES = [
  "Planner",
  "Florist",
  "DJ",
  "Band",
  "Officiant",
  "Caterer",
  "Videographer",
  "Venue coordinator",
  "Hair & makeup",
  "Rentals",
  "Other",
];

export function VendorManager({
  weddingId,
  vendors: initialVendors,
}: {
  weddingId: string;
  vendors: Vendor[];
}) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [showForm, setShowForm] = useState(initialVendors.length === 0);
  const [role, setRole] = useState("Planner");
  const [customRole, setCustomRole] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalRole = role === "Other" ? customRole.trim() : role;
    if (!finalRole) {
      setError("Role is required.");
      return;
    }
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("role", finalRole);
    fd.set("name", name.trim());
    if (phone.trim()) fd.set("phone", phone.trim());
    if (email.trim()) fd.set("email", email.trim());
    if (notes.trim()) fd.set("notes", notes.trim());

    startTransition(async () => {
      const result = await addVendor(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      // Optimistic: reload page to pick up new row with ID
      const newVendor: Vendor = {
        id: crypto.randomUUID(),
        role: finalRole,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      };
      setVendors((prev) => [...prev, newVendor]);
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setCustomRole("");
      setRole("Planner");
      setShowForm(false);
    });
  }

  function handleDelete(vendorId: string) {
    const fd = new FormData();
    fd.set("weddingId", weddingId);
    fd.set("vendorId", vendorId);
    startTransition(async () => {
      const result = await deleteVendor(fd);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
        return;
      }
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
          Vendors ({vendors.length})
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            + Add vendor
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-stone-200 rounded-xl p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
              >
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {role === "Other" && (
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  maxLength={100}
                  placeholder="Custom role"
                  className="mt-2 w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Name / Company
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
            />
          </div>

          {error && (
            <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save vendor"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {vendors.length > 0 && (
        <div className="space-y-2">
          {vendors.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-stone-200 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                      {v.role}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-stone-900">{v.name}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm">
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        className="text-stone-600 hover:text-stone-900 underline"
                      >
                        {v.phone}
                      </a>
                    )}
                    {v.email && (
                      <a
                        href={`mailto:${v.email}`}
                        className="text-stone-600 hover:text-stone-900 underline"
                      >
                        {v.email}
                      </a>
                    )}
                  </div>
                  {v.notes && (
                    <p className="text-sm text-stone-500 mt-2">{v.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(v.id)}
                  className="text-xs text-stone-400 hover:text-red-500 ml-3"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vendors.length === 0 && !showForm && (
        <p className="text-sm text-stone-400 text-center py-8">
          No vendors yet. Add the planner, florist, DJ, etc.
        </p>
      )}
    </div>
  );
}
