"use client";

import { PERMISSION_GROUPS } from "@/lib/permissions";
import type { PermissionRow } from "@/lib/types";

// Permissions grouped by area; `grantable` (the editor's own permissions, or "*") disables boxes they can't hand out
export function PermissionChecklist({
  all, selected, onChange, grantable, locked = [],
}: { all: PermissionRow[]; selected: string[]; onChange: (actions: string[]) => void; grantable: string[]; locked?: string[] }) {
  const canGrant = (a: string) => grantable.includes("*") || grantable.includes(a);
  const toggle = (a: string) => onChange(selected.includes(a) ? selected.filter((x) => x !== a) : [...selected, a]);
  const known = new Set(PERMISSION_GROUPS.flatMap((g) => g.prefix));
  const groups = [...PERMISSION_GROUPS, { title: "Other", prefix: all.map((p) => p.action).filter((a) => !known.has(a)) }];

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = all.filter((p) => g.prefix.includes(p.action));
        if (!rows.length) return null;
        return (
          <div key={g.title}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{g.title}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {rows.map((p) => {
                const isLocked = locked.includes(p.action);
                const disabled = isLocked || (!canGrant(p.action) && !selected.includes(p.action));
                return (
                  <label key={p.id} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${selected.includes(p.action) || isLocked ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
                    <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-indigo-600" disabled={disabled}
                      checked={selected.includes(p.action) || isLocked} onChange={() => toggle(p.action)} />
                    <span>
                      <span className="block text-sm font-mono text-slate-800">{p.action}</span>
                      <span className="block text-xs text-slate-500">{isLocked ? "From role" : p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
