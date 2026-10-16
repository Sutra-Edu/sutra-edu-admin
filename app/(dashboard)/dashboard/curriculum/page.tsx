"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi, useCatalog } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td } from "@/components/ui";
import type { CatalogItem, Offering } from "@/lib/types";

type Kind = "board" | "class" | "subject";
const TABS: { key: Kind | "syllabi"; label: string }[] = [
  { key: "syllabi", label: "Syllabi" },
  { key: "board", label: "Boards" },
  { key: "class", label: "Classes" },
  { key: "subject", label: "Subjects" },
];

export default function CurriculumPage() {
  const [tab, setTab] = useState<Kind | "syllabi">("syllabi");
  return (
    <>
      <PageHeader
        title="Curriculum"
        description="Boards, classes and subjects, and the syllabi that combine them. Books are uploaded into a syllabus (board + class + subject)."
      />
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "syllabi" ? <Syllabi /> : <CatalogTab key={tab} kind={tab} />}
    </>
  );
}

function CatalogTab({ kind }: { kind: Kind }) {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_CURRICULUM);
  const { data: items, loading, error, reload } = useApi<CatalogItem[]>(`/admin/catalog/${kind}?includeInactive=true`, []);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const label = { board: "board", class: "class", subject: "subject" }[kind];

  const toggle = async (item: CatalogItem) => {
    try {
      await api.patch(`/admin/catalog/${kind}/${item.id}`, { isActive: !item.isActive });
      reload();
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };

  return (
    <Card title={`${label[0].toUpperCase()}${label.slice(1)}${kind === "class" ? "es" : "s"}`}
      actions={canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4" /> Add {label}</Button>}>
      {(error || notice) && <div className="mb-4"><Alert onClose={() => setNotice(null)}>{error || notice}</Alert></div>}
      {loading ? <Spinner /> : items.length === 0 ? <EmptyState title={`No ${label}s yet`} /> : (
        <Table head={["Name", "Code", "Order", "Status", ""]}>
          {items.map((i) => (
            <tr key={i.id} className={i.isActive ? "" : "opacity-60"}>
              <Td className="font-medium">{i.name}</Td>
              <Td className="font-mono text-xs">{i.code}</Td>
              <Td>{i.sortOrder}</Td>
              <Td>{i.isActive ? <Badge color="green">active</Badge> : <Badge>inactive</Badge>}</Td>
              <Td className="text-right whitespace-nowrap">
                {canEdit && <>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(i)}>{i.isActive ? "Deactivate" : "Activate"}</Button>
                </>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <CatalogModal kind={kind} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </Card>
  );
}

function CatalogModal({ kind, item, onClose, onSaved }: { kind: Kind; item: CatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: item?.code ?? "", name: item?.name ?? "", sortOrder: String(item?.sortOrder ?? 0) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hints: Record<Kind, [string, string]> = {
    board: ["CBSE", "CBSE"], class: ["10", "Class 10"], subject: ["SCIENCE", "Science"],
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const body = { code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 };
    try {
      if (item) await api.patch(`/admin/catalog/${kind}/${item.id}`, body);
      else await api.post(`/admin/catalog/${kind}`, body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${kind}` : `Add ${kind}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save} disabled={!form.code.trim() || !form.name.trim()}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={hints[kind][1]} /></Field>
        <Field label="Code" required hint="Letters, digits, _ and -. Used in storage paths (e.g. books/cbse/class-10/science/…)">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={hints[kind][0]} />
        </Field>
        <Field label="Sort order"><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

function Syllabi() {
  const { can } = useAuth();
  const { boards, classes, subjects } = useCatalog();
  const [filter, setFilter] = useState({ boardId: "", classId: "" });
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const { data: offerings, loading, error, reload } = useApi<Offering[]>(`/admin/offerings${qs ? `?${qs}` : ""}`, []);
  const [creating, setCreating] = useState(false);

  return (
    <Card title="Syllabi" actions={can(P.MANAGE_CURRICULUM) && <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New syllabus</Button>}>
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Select value={filter.boardId} onChange={(e) => setFilter({ ...filter, boardId: e.target.value })}>
          <option value="">All boards</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={filter.classId} onChange={(e) => setFilter({ ...filter, classId: e.target.value })}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading ? <Spinner /> : offerings.length === 0 ? (
        <EmptyState title="No syllabi" description="Create one, or just upload a book: the upload page creates the syllabus for you." />
      ) : (
        <Table head={["Board", "Class", "Subject", "Chapters", "Students pick a book", ""]}>
          {offerings.map((o) => (
            <tr key={o.id} className={o.isActive ? "" : "opacity-60"}>
              <Td className="font-medium">{o.board.name}</Td>
              <Td>{o.class.name}</Td>
              <Td>{o.subject.name}</Td>
              <Td>{o._count?.chapters ?? 0}</Td>
              <Td>{o.requiresBookSelection ? <Badge color="amber">yes</Badge> : <span className="text-slate-400">no</span>}</Td>
              <Td className="text-right">
                {can(P.UPLOAD_BOOKS) && (
                  <Link href={`/dashboard/books/upload?offeringId=${o.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                    <Upload className="w-3.5 h-3.5" /> Upload book
                  </Link>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {creating && (
        <CreateSyllabusModal boards={boards} classes={classes} subjects={subjects} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }} />
      )}
    </Card>
  );
}

function CreateSyllabusModal({ boards, classes, subjects, onClose, onSaved }: {
  boards: CatalogItem[]; classes: CatalogItem[]; subjects: CatalogItem[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ boardId: "", classId: "", subjectIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One syllabus per selected subject; existing ones are reported and skipped
  const save = async () => {
    setSaving(true);
    setError(null);
    const failed: string[] = [];
    for (const subjectId of form.subjectIds) {
      try {
        await api.post("/admin/offerings", { boardId: form.boardId, classId: form.classId, subjectId });
      } catch (err) {
        failed.push(`${subjects.find((s) => s.id === subjectId)?.name}: ${errorMessage(err)}`);
      }
    }
    setSaving(false);
    if (failed.length) setError(failed.join("\n"));
    else onSaved();
  };

  const toggleSubject = (id: string) =>
    setForm((f) => ({ ...f, subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter((x) => x !== id) : [...f.subjectIds, id] }));

  return (
    <Modal open onClose={onClose} title="New syllabus"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={saving} onClick={save} disabled={!form.boardId || !form.classId || !form.subjectIds.length}>Create {form.subjectIds.length || ""}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Board" required>
            <Select value={form.boardId} onChange={(e) => setForm({ ...form, boardId: e.target.value })}>
              <option value="">Select…</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Class" required>
            <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Select…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Subjects" required hint="One syllabus is created per subject">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} className="rounded border-slate-300 text-indigo-600" />
                {s.name}
              </label>
            ))}
          </div>
        </Field>
        {error && <Alert><span className="whitespace-pre-line">{error}</span></Alert>}
      </div>
    </Modal>
  );
}
