"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Archive, ArrowLeft, ExternalLink, Pencil, RefreshCw, RotateCcw, Upload } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { putWithProgress } from "@/lib/upload";
import {
  Alert, Badge, Button, Card, Field, Input, LANGUAGES, Modal, PageHeader, ProgressBar, Select, Spinner, StatusBadge, Table, Td, fmtBytes, fmtDate,
} from "@/components/ui";
import type { BookFile, BookSummary } from "@/lib/types";

interface Usage {
  id: string;
  state: string;
  isActive: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  offering: { id: string; board: { code: string }; class: { code: string }; subject: { code: string } };
  replacedBy: { id: string; code: string; title: string } | null;
}
type BookDetail = BookSummary & { usedIn: Usage[] };

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: book, loading, error, reload } = useApi<BookDetail | null>(`/admin/books/${id}`, null);
  const storage = useApi<{ bucket: string; nextVersion: number; folder: string } | null>(`/admin/books/${id}/storage-path`, null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const action = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: "success", text: success });
      await Promise.all([reload(), storage.reload()]);
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const openPdf = async (file: BookFile) => {
    try {
      const res = await api.get<{ originalUrl: string | null }>(`/admin/books/${id}/files/${file.id}`);
      if (res.data.originalUrl) window.open(res.data.originalUrl, "_blank", "noopener");
      else setNotice({ kind: "error", text: "This version hasn't finished uploading" });
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  const archive = async () => {
    if (!confirm("Archive this book? Students stop seeing it. You can restore it later.")) return;
    setBusy("archive");
    setNotice(null);
    try {
      await api.delete(`/admin/books/${id}`);
      setNotice({ kind: "success", text: "Book archived" });
      await reload();
    } catch (err) {
      const msg = errorMessage(err);
      // Refused when it's the only book in use on a syllabus
      if (confirm(`${msg}\n\nArchive anyway?`)) {
        await action("archive", () => api.delete(`/admin/books/${id}?force=true`), "Book archived");
      } else {
        setNotice({ kind: "error", text: msg });
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading && !book) return <Spinner />;
  if (error || !book) return <Alert>{error ?? "Book not found"}</Alert>;

  const archived = book.status === "ARCHIVED";

  return (
    <>
      <Link href="/dashboard/books" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 mb-3">
        <ArrowLeft className="w-4 h-4" /> Books
      </Link>
      <PageHeader
        title={book.title}
        description={`${book.subject.name} · ${book.boards.map((b) => b.board.name).join(", ")} · ${book.classes.map((c) => c.class.name).join(", ")}`}
        actions={<>
          <StatusBadge status={book.status} />
          {can(P.MANAGE_BOOKS) && !archived && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" /> Edit</Button>}
          {can(P.UPLOAD_BOOKS) && !archived && <Button onClick={() => setUploading(true)}><Upload className="w-4 h-4" /> New version</Button>}
          {can(P.MANAGE_BOOKS) && (archived
            ? <Button variant="secondary" loading={busy === "restore"} onClick={() => action("restore", () => api.post(`/admin/books/${id}/restore`), "Book restored")}><RotateCcw className="w-4 h-4" /> Restore</Button>
            : <Button variant="danger" loading={busy === "archive"} onClick={archive}><Archive className="w-4 h-4" /> Archive</Button>)}
        </>}
      />

      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row label="Code"><span className="font-mono">{book.code}</span></Row>
            <Row label="Language">{LANGUAGES.find((l) => l.value === book.language)?.label ?? book.language}</Row>
            <Row label="Publisher">{book.publisher || "—"}</Row>
            <Row label="Edition">{book.edition || "—"}</Row>
            <Row label="Author">{book.author || "—"}</Row>
            <Row label="ISBN">{book.isbn || "—"}</Row>
            <Row label="Relation">{book.contentRelation === "DIFFERENT_CONTENT" ? "Different content (students pick)" : "Same syllabus variation"}</Row>
            {storage.data && (
              <Row label="Next upload goes to">
                <code className="text-xs break-all bg-slate-100 rounded px-1.5 py-0.5">{storage.data.bucket}/{storage.data.folder}/</code>
              </Row>
            )}
          </dl>
        </Card>

        <Card title="Versions" className="lg:col-span-2">
          {book.files.length === 0 ? (
            <div className="text-sm text-slate-500">
              No PDF uploaded yet.{" "}
              {can(P.UPLOAD_BOOKS) && !archived && <button className="text-indigo-600 underline" onClick={() => setUploading(true)}>Upload one</button>}
            </div>
          ) : (
            <Table head={["Version", "File", "Pages", "Status", ""]}>
              {book.files.map((f) => (
                <tr key={f.id}>
                  <Td>
                    <div className="font-medium">v{f.version} {f.isCurrent && <Badge color="green">live</Badge>}</div>
                    {f.label && <div className="text-xs text-slate-500">{f.label}</div>}
                    <div className="text-xs text-slate-400">{fmtDate(f.createdAt)}</div>
                  </Td>
                  <Td>
                    <div className="break-all">{f.originalFilename}</div>
                    <div className="text-xs text-slate-500">{fmtBytes(f.sizeBytes)}</div>
                  </Td>
                  <Td><PageProgress file={f} /></Td>
                  <Td>
                    <StatusBadge status={f.status} />
                    {f.error && <div className="text-xs text-red-600 mt-1 max-w-xs break-words">{f.error}</div>}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      {f.status !== "PENDING_UPLOAD" && <Button size="sm" variant="ghost" onClick={() => openPdf(f)} title="Open the original PDF"><ExternalLink className="w-3.5 h-3.5" /> PDF</Button>}
                      {can(P.UPLOAD_BOOKS) && f.status !== "PENDING_UPLOAD" && (
                        <Button size="sm" variant="ghost" loading={busy === `re-${f.id}`} title="Split and extract again"
                          onClick={() => confirm("Reprocess this version? Its extracted pages are discarded and rebuilt.") &&
                            action(`re-${f.id}`, () => api.post(`/admin/books/${id}/files/${f.id}/reprocess`), `v${f.version} queued for reprocessing`)}>
                          <RefreshCw className="w-3.5 h-3.5" /> Reprocess
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Where it's used" className="lg:col-span-3">
          {book.usedIn.length === 0 ? <p className="text-sm text-slate-500">Not linked to any syllabus.</p> : (
            <Table head={["Syllabus", "State", "Window", "Replaced by"]}>
              {book.usedIn.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium">{u.offering.board.code} · Class {u.offering.class.code} · {u.offering.subject.code}</Td>
                  <Td><StatusBadge status={u.state} /></Td>
                  <Td className="text-slate-500">{u.activeFrom || u.activeUntil ? `${u.activeFrom ? new Date(u.activeFrom).toLocaleDateString() : "…"} → ${u.activeUntil ? new Date(u.activeUntil).toLocaleDateString() : "…"}` : "Always"}</Td>
                  <Td>{u.replacedBy ? <Link className="text-indigo-600 hover:underline" href={`/dashboard/books/${u.replacedBy.id}`}>{u.replacedBy.title}</Link> : "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {editing && <EditBookModal book={book} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); storage.reload(); setNotice({ kind: "success", text: "Book updated" }); }} />}
      {uploading && <NewVersionModal bookId={book.id} onClose={() => setUploading(false)}
        onDone={(v) => { setUploading(false); reload(); storage.reload(); setNotice({ kind: "success", text: `Version ${v} uploaded and queued for processing` }); }} />}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900 mt-0.5">{children}</dd>
    </div>
  );
}

function PageProgress({ file }: { file: BookFile }) {
  const counts = file.pageStatus ?? {};
  const total = file.pageCount ?? Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return <span className="text-slate-400">—</span>;
  const done = (counts.EXTRACTED ?? 0) + (counts.APPROVED ?? 0) + (counts.NEEDS_REVIEW ?? 0);
  return (
    <div className="w-36 space-y-1">
      <ProgressBar value={(done / total) * 100} />
      <div className="text-xs text-slate-500">{done}/{total} extracted{counts.NEEDS_REVIEW ? ` · ${counts.NEEDS_REVIEW} need review` : ""}{counts.FAILED ? ` · ${counts.FAILED} failed` : ""}</div>
    </div>
  );
}

function EditBookModal({ book, onClose, onSaved }: { book: BookSummary; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: book.title, code: book.code, language: book.language, publisher: book.publisher ?? "", edition: book.edition ?? "",
    author: book.author ?? "", isbn: book.isbn ?? "", contentRelation: book.contentRelation,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/books/${book.id}`, form);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit book" wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title" required><Input value={form.title} onChange={set("title")} /></Field></div>
        <Field label="Code" hint="Changing it doesn't move files already uploaded"><Input value={form.code} onChange={set("code")} /></Field>
        <Field label="Language">
          <Select value={form.language} onChange={set("language")}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</Select>
        </Field>
        <Field label="Publisher"><Input value={form.publisher} onChange={set("publisher")} /></Field>
        <Field label="Edition"><Input value={form.edition} onChange={set("edition")} /></Field>
        <Field label="Author"><Input value={form.author} onChange={set("author")} /></Field>
        <Field label="ISBN"><Input value={form.isbn} onChange={set("isbn")} /></Field>
        <div className="sm:col-span-2">
          <Field label="Relation to other books on its syllabi">
            <Select value={form.contentRelation} onChange={set("contentRelation")}>
              <option value="SAME_SYLLABUS_VARIATION">Same syllabus (variation, taught together)</option>
              <option value="DIFFERENT_CONTENT">Different content (students must pick a book)</option>
            </Select>
          </Field>
        </div>
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    </Modal>
  );
}

function NewVersionModal({ bookId, onClose, onDone }: { bookId: string; onClose: () => void; onDone: (version: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [direct, setDirect] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      if (!direct) {
        const fd = new FormData();
        if (label.trim()) fd.append("label", label.trim());
        fd.append("file", file);
        const res = await api.post<BookFile>(`/admin/books/${bookId}/files`, fd, {
          onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
        });
        onDone(res.data.version);
      } else {
        const presign = await api.post<{ bookFileId: string; version: number; uploadUrl: string; headers: Record<string, string> }>(
          `/admin/books/${bookId}/files/presign`, { filename: file.name, sizeBytes: file.size, label: label.trim() || undefined },
        );
        await putWithProgress(presign.data.uploadUrl, file, presign.data.headers, setProgress);
        await api.post(`/admin/books/${bookId}/files/${presign.data.bookFileId}/complete`);
        onDone(presign.data.version);
      }
    } catch (err) {
      setError(errorMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title="Upload a new version"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!file} onClick={upload}><Upload className="w-4 h-4" /> Upload</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">The book keeps its identity. Students keep seeing the current version until every page of the new one is processed.</p>
        <Field label="PDF file" required>
          <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Version label" hint="Optional, e.g. 2025 reprint"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
          Upload directly to cloud (large files; needs bucket CORS)
        </label>
        {progress !== null && busy && <ProgressBar value={progress} />}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
