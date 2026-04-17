"use client";

import { useState, useTransition } from "react";
import { createWedding } from "@/app/actions/weddings";

type FamilyMember = {
  side: "client1" | "client2";
  role: string;
  first_name: string;
  last_name: string;
  mobility_limited: boolean;
};

const EMPTY_FM: FamilyMember = {
  side: "client1",
  role: "parent",
  first_name: "",
  last_name: "",
  mobility_limited: false,
};

const FAMILY_ROLES = [
  "parent",
  "step_parent",
  "sibling",
  "step_sibling",
  "grandparent",
  "aunt_uncle",
  "other",
];

const REFERRAL_SOURCES = [
  { value: "past_client", label: "Past client" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "vendor", label: "Vendor referral" },
  { value: "other", label: "Other" },
];

export default function NewWeddingPage() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addFM() {
    setFamilyMembers((fms) => [...fms, { ...EMPTY_FM }]);
  }

  function removeFM(i: number) {
    setFamilyMembers((fms) => fms.filter((_, idx) => idx !== i));
  }

  function updateFM(i: number, field: keyof FamilyMember, value: string | boolean) {
    setFamilyMembers((fms) =>
      fms.map((fm, idx) => (idx === i ? { ...fm, [field]: value } : fm))
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    formData.set("family_count", String(familyMembers.length));
    familyMembers.forEach((fm, i) => {
      formData.set(`fm_side_${i}`, fm.side);
      formData.set(`fm_role_${i}`, fm.role);
      formData.set(`fm_first_name_${i}`, fm.first_name);
      formData.set(`fm_last_name_${i}`, fm.last_name);
      formData.set(`fm_mobility_${i}`, String(fm.mobility_limited));
    });

    startTransition(async () => {
      const result = await createWedding(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">New wedding</h1>
        <p className="mt-1 text-sm text-stone-500">
          Fill this in after your discovery call with the couple.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Client 1 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide border-b border-stone-100 pb-2">
            Client 1
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *" name="c1_first_name" required placeholder="Alex" />
            <Field label="Last name *" name="c1_last_name" required placeholder="Chen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" name="c1_email" type="email" placeholder="alex@email.com" />
            <Field label="Phone" name="c1_phone" placeholder="+1 555 000 0000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              How did they find you?
            </label>
            <select
              name="c1_referral_source"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
            >
              <option value="">Select…</option>
              {REFERRAL_SOURCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Client 2 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide border-b border-stone-100 pb-2">
            Client 2 <span className="font-normal text-stone-400">(optional)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" name="c2_first_name" placeholder="Jordan" />
            <Field label="Last name" name="c2_last_name" placeholder="Kim" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" name="c2_email" type="email" placeholder="jordan@email.com" />
            <Field label="Phone" name="c2_phone" placeholder="+1 555 000 0001" />
          </div>
        </section>

        {/* Wedding details */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide border-b border-stone-100 pb-2">
            Wedding details
          </h2>
          <Field label="Wedding date" name="wedding_date" type="date" />
          <Field label="Venue / reception name" name="venue_name" placeholder="The Ritz-Carlton, DC" />
          <Field
            label="Venue address"
            name="venue_address"
            placeholder="1150 22nd St NW, Washington, DC 20037"
          />
          <Field
            label="Ceremony address"
            name="ceremony_address"
            placeholder="Leave blank if same as venue"
          />
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Style / vibe notes
            </label>
            <textarea
              name="style_vibe"
              rows={3}
              maxLength={2000}
              placeholder="E.g. Black tie, romantic florals, couple wants editorial portraits + candid moments"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Special requests
            </label>
            <textarea
              name="special_requests"
              rows={3}
              maxLength={5000}
              placeholder="Any specific shots, moments, or details they mentioned"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
          </div>
        </section>

        {/* Family structure */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                Family structure
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Used to auto-generate the formal shot list.
              </p>
            </div>
            <button
              type="button"
              onClick={addFM}
              className="text-sm text-stone-600 hover:text-stone-900 underline"
            >
              + Add member
            </button>
          </div>

          {familyMembers.length === 0 && (
            <p className="text-sm text-stone-400 py-2">
              No family members added yet. You can add them now or after saving.
            </p>
          )}

          {familyMembers.map((fm, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500">Member {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeFM(i)}
                  className="text-xs text-stone-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Side</label>
                  <select
                    value={fm.side}
                    onChange={(e) => updateFM(i, "side", e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                  >
                    <option value="client1">Client 1&apos;s side</option>
                    <option value="client2">Client 2&apos;s side</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Role</label>
                  <select
                    value={fm.role}
                    onChange={(e) => updateFM(i, "role", e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                  >
                    {FAMILY_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">First name</label>
                  <input
                    type="text"
                    value={fm.first_name}
                    onChange={(e) => updateFM(i, "first_name", e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Last name</label>
                  <input
                    type="text"
                    value={fm.last_name}
                    onChange={(e) => updateFM(i, "last_name", e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fm.mobility_limited}
                  onChange={(e) => updateFM(i, "mobility_limited", e.target.checked)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                />
                <span className="text-sm text-stone-600">Mobility limited</span>
              </label>
            </div>
          ))}
        </section>

        {error && (
          <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-3 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Creating wedding…" : "Create wedding"}
          </button>
          <a
            href="/dashboard"
            className="px-4 py-3 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
    </div>
  );
}
