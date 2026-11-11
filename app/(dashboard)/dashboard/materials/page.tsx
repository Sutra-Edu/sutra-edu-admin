"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Textarea, fmtBytes } from "@/components/ui";
import { Tabs } from "@/components/resource-editor";

interface Material { id: string; title: string; kind: string; mimeType: string; sizeBytes: number; isPremium: boolean; isActive: boolean; url: string; chapterId: string | null }
interface Book { id: string; code: string; title: string; kind?: string; description?: string | null; isPremium?: boolean; difficulty?: string | null; tags?: string[] }

export default function MaterialsPage() {
  const [tab, setTab] = useState<"materials" | "sidebooks">("materials");
  return (
    <>
      <PageHeader title="Study materials & sidebooks" description='Files on the "In-app notes" screen (per chapter), and books shown as sidebooks with a cover.' />
      <Tabs tabs={[{ key: "materials", label: "Study materials" }, { key: "sidebooks", label: "Books in the app" }]} value={tab} onChange={setTab} />
      {tab === "materials" ? <Materials /> : <Sidebooks />}
    </>
  );
}

function Materials() {
  const { can } = useAuth();
  const [chapterId, setChapterId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const q = chapterId.trim() ? `chapterId=${chapterId.trim()}` : offeringId.trim() ? `offeringId=${offeringId.trim()}` : "";
  const list = useApi<Material[]>(q ? `/admin/materials?${q}` : null, []);
  const [form, setForm] = useState({ title: "", kind: "notes", isPremium: false });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (chapterId.trim()) fd.append("chapterId", chapterId.trim());
      if (offeringId.trim()) fd.append("offeringId", offeringId.trim());
      if (form.title) fd.append("title", form.title);
      fd.append("kind", form.kind);
      fd.append("isPremium", String(form.isPremium));
      await api.post("/admin/materials", fd);
      setMsg({ kind: "success", text: "Uploaded" });
      setFile(null);
      list.reload();
    } catch (err) {
      setMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    await api.delete(`/admin/materials/${id}`);
    list.reload();
  };
  return (
    <div className="space-y-6">
      <Card title="Where">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Chapter id" hint="From Curriculum → syllabus → chapter"><Input value={chapterId} onChange={(e) => setChapterId(e.target.value)} /></Field>
          <Field label="…or syllabus (offering) id" hint="For subject-wide material"><Input value={offeringId} onChange={(e) => setOfferingId(e.target.value)} /></Field>
        </div>
      </Card>
      {q && can(P.MANAGE_CONTENT_SETTINGS) && (
        <Card title="Upload">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="File (PDF, MP4, images…)"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" /></Field>
            <Field label="Title"><Input value={form.title} placeholder="file name" onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Kind">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {["notes", "proofs", "diagrams", "simulation", "worksheet", "other"].map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <Checkbox label="Paid plans only" checked={form.isPremium} onChange={(e) => setForm({ ...form, isPremium: e.target.checked })} />
            <Button loading={busy} disabled={!file} onClick={upload}><Upload className="w-4 h-4" /> Upload</Button>
          </div>
          {msg && <div className="mt-3"><Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert></div>}
        </Card>
      )}
      {q && (
        <Card title="Files">
          {list.loading ? <Spinner /> : !list.data.length ? <EmptyState title="No files here yet" /> : (
            <Table head={["File", "Kind", "Size", "", ""]}>
              {list.data.map((m) => (
                <tr key={m.id}>
                  <Td><a href={m.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">{m.title}</a><div className="text-xs text-slate-500">{m.mimeType}</div></Td>
                  <Td>{m.kind}</Td>
                  <Td className="text-xs">{fmtBytes(m.sizeBytes)}</Td>
                  <Td>{m.isPremium && <Badge color="amber">premium</Badge>}</Td>
                  <Td>{can(P.MANAGE_CONTENT_SETTINGS) && <Button size="sm" variant="secondary" onClick={() => remove(m.id)}>Delete</Button>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

function Sidebooks() {
  const { can } = useAuth();
  const books = useApi<Book[]>("/admin/books", []);
  const [editing, setEditing] = useState<Book | null>(null);
  return (
    <Card title="How each book appears in the app">
      <p className="text-sm text-slate-500 mb-4">Textbooks are the syllabus books. Sidebooks are supplementary guides on the &quot;Select your sidebook&quot; screen; give them a cover and description. Notes are your own teaching notes: the AI uses them together with the textbook when it makes each topic&apos;s videos, and students never see them as a book.</p>
      {books.loading ? <Spinner /> : (
        <Table head={["Book", "Kind", ""]}>
          {books.data.map((b) => (
            <tr key={b.id}>
              <Td><div className="font-medium">{b.title}</div><div className="text-xs text-slate-500">{b.code}</div></Td>
              <Td><Badge color={b.kind === "SIDEBOOK" ? "purple" : b.kind === "NOTES" ? "blue" : "gray"}>{(b.kind ?? "TEXTBOOK").toLowerCase()}</Badge>{b.isPremium && <Badge color="amber">premium</Badge>}</Td>
              <Td>{can(P.MANAGE_BOOKS) && <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>Edit</Button>}</Td>
            </tr>
          ))}
        </Table>
      )}
      {editing && <BookModal book={editing} onClose={() => { setEditing(null); books.reload(); }} />}
    </Card>
  );
}

function BookModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const [form, setForm] = useState({ kind: book.kind ?? "TEXTBOOK", description: book.description ?? "", isPremium: !!book.isPremium, difficulty: book.difficulty ?? "", tags: (book.tags ?? []).join(", ") });
  const [cover, setCover] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try {
      await api.patch(`/admin/books/${book.id}/catalog`, { kind: form.kind, description: form.description || null, isPremium: form.isPremium, difficulty: form.difficulty || null, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) });
      if (cover) {
        const fd = new FormData();
        fd.append("file", cover);
        await api.post(`/admin/books/${book.id}/cover`, fd);
      }
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Modal open onClose={onClose} title={book.title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Kind">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="TEXTBOOK">Textbook</option>
            <option value="SIDEBOOK">Sidebook</option>
            <option value="NOTES">Notes (used by the AI with the textbook, not shown as a book)</option>
          </Select>
        </Field>
        <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulty">
            <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="">—</option><option>Easy</option><option>Medium</option><option>Hard</option>
            </Select>
          </Field>
          <Field label="Tags (comma separated)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
        </div>
        <Field label="Cover image"><input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="text-sm" /></Field>
        <Checkbox label="Paid plans only" checked={form.isPremium} onChange={(e) => setForm({ ...form, isPremium: e.target.checked })} />
        {err && <Alert>{err}</Alert>}
      </div>
    </Modal>
  );
}
