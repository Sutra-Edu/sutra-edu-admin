"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Alert, Button, Card, Checkbox, EmptyState, Field, Input, Modal, Select, Spinner, Table, Td, Textarea } from "@/components/ui";

// A list + create / edit form for simple admin resources (reward rules, badges, avatar items, plans, games, …).
// Each field says how to edit it; "json" fields are edited as JSON text. Only changed fields are sent on edit.

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "json" | "multiselect" | "datetime" | "list";
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  createOnly?: boolean; // e.g. codes, which never change
  placeholder?: string;
};

export type Column<T> = { label: string; render: (row: T) => React.ReactNode };

type Row = Record<string, unknown> & { id: string };

export function ResourceEditor<T extends Row>({
  title, description, listPath, createPath, updatePath, fields, columns, canEdit, defaults = {}, extraActions, mapList,
}: {
  title: string;
  description?: string;
  listPath: string;
  createPath: string;
  updatePath: (row: T) => string;
  fields: FieldDef[];
  columns: Column<T>[];
  canEdit: boolean;
  defaults?: Record<string, unknown>;
  extraActions?: (row: T, reload: () => void) => React.ReactNode;
  mapList?: (data: unknown) => T[];
}) {
  const list = useApi<unknown>(listPath, []);
  const rows = mapList ? mapList(list.data) : (list.data as T[]);
  const [editing, setEditing] = useState<T | "new" | null>(null);

  return (
    <Card
      title={title}
      actions={canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-3.5 h-3.5" /> Add</Button>}
    >
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {list.error && <Alert>{list.error}</Alert>}
      {list.loading ? <Spinner /> : !rows.length ? <EmptyState title="Nothing here yet" /> : (
        <Table head={[...columns.map((c) => c.label), ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c, i) => <Td key={i}>{c.render(r)}</Td>)}
              <Td>
                <div className="flex gap-1 justify-end">
                  {extraActions?.(r, list.reload)}
                  {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing(r)}><Pencil className="w-3.5 h-3.5" /></Button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {editing && (
        <EditModal
          title={editing === "new" ? `Add to ${title.toLowerCase()}` : `Edit ${String((editing as Row).name ?? (editing as Row).code ?? (editing as Row).key ?? "")}`}
          fields={fields}
          initial={editing === "new" ? defaults : editing}
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            if (editing === "new") await api.post(createPath, body);
            else await api.patch(updatePath(editing), body);
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </Card>
  );
}

function toText(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null) return f.type === "json" ? "" : "";
  if (f.type === "json") return JSON.stringify(v, null, 2);
  if (f.type === "list") return (v as string[]).join("\n");
  if (f.type === "datetime") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return String(v);
}

function EditModal({ title, fields, initial, isNew, onClose, onSave }: {
  title: string; fields: FieldDef[]; initial: Record<string, unknown>; isNew: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? !!initial[f.key] : f.type === "multiselect" ? (initial[f.key] as string[] | undefined) ?? [] : toText(f, initial[f.key])])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = fields.filter((f) => isNew || !f.createOnly);

  const save = async () => {
    setError(null);
    const body: Record<string, unknown> = {};
    try {
      for (const f of shown) {
        const raw = form[f.key];
        let v: unknown;
        if (f.type === "checkbox" || f.type === "multiselect") v = raw;
        else if (f.type === "number") v = raw === "" ? undefined : Number(raw);
        else if (f.type === "json") v = (raw as string).trim() ? JSON.parse(raw as string) : undefined;
        else if (f.type === "list") v = (raw as string).split("\n").map((x) => x.trim()).filter(Boolean);
        else if (f.type === "datetime") v = (raw as string) ? new Date(raw as string).toISOString() : undefined;
        else v = (raw as string).trim() === "" ? undefined : (raw as string).trim();
        if (f.required && (v === undefined || v === "")) throw new Error(`${f.label} is required`);
        // On edit, send only what changed
        if (!isNew && JSON.stringify(v ?? null) === JSON.stringify(initial[f.key] ?? null)) continue;
        if (v !== undefined) body[f.key] = v;
        else if (!isNew) body[f.key] = null;
      }
    } catch (err) {
      setError(err instanceof SyntaxError ? "One of the JSON fields is not valid JSON" : (err as Error).message);
      return;
    }
    setSaving(true);
    try {
      await onSave(body);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        {shown.map((f) => {
          const v = form[f.key];
          const set = (x: unknown) => setForm({ ...form, [f.key]: x });
          if (f.type === "checkbox") return <Checkbox key={f.key} label={f.label} description={f.hint} checked={!!v} onChange={(e) => set(e.target.checked)} />;
          return (
            <Field key={f.key} label={f.label} hint={f.hint} required={f.required}>
              {f.type === "datetime" ? (
                <Input type="datetime-local" value={v as string} onChange={(e) => set(e.target.value)} />
              ) : f.type === "textarea" || f.type === "json" || f.type === "list" ? (
                <Textarea rows={f.type === "json" ? 6 : f.type === "list" ? 4 : 3} className={f.type === "json" ? "font-mono text-xs" : ""} value={v as string} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
              ) : f.type === "select" ? (
                <Select value={v as string} onChange={(e) => set(e.target.value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === "multiselect" ? (
                <div className="grid sm:grid-cols-3 gap-2">
                  {f.options?.map((o) => (
                    <Checkbox key={o.value} label={o.label} checked={(v as string[]).includes(o.value)}
                      onChange={(e) => set(e.target.checked ? [...(v as string[]), o.value] : (v as string[]).filter((x) => x !== o.value))} />
                  ))}
                </div>
              ) : (
                <Input type={f.type === "number" ? "number" : "text"} value={v as string} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
              )}
            </Field>
          );
        })}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

/** Tabs used by the pages built on ResourceEditor */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${value === t.key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const opts = (values: string[]) => values.map((v) => ({ value: v, label: v.replace(/_/g, " ").toLowerCase() }));
