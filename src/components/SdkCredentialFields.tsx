"use client";

import type { SdkFieldSpec } from "@/lib/connectors/sdkCatalog";

export function SdkCredentialFields({
  fields,
  values,
  onChange,
}: {
  fields: SdkFieldSpec[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  if (!fields.length) return null;

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <label key={field.id} className="block text-xs font-semibold text-charcoal">
          {field.label}
          {field.required && <span className="text-coral"> *</span>}
          {!field.required && field.tier === "reports" && (
            <span className="font-normal text-warmgrey"> (optional)</span>
          )}
          {field.why && (
            <span className="mt-0.5 block text-[10px] font-normal leading-snug text-warmgrey">
              {field.why}
            </span>
          )}
          <input
            type={field.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={field.placeholder}
            value={values[field.id] ?? ""}
            onChange={(e) => onChange({ ...values, [field.id]: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
          />
        </label>
      ))}
    </div>
  );
}
