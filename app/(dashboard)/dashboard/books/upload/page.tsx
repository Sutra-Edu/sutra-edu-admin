"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CloudUpload, FileText, Server } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { putWithProgress } from "@/lib/upload";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Button, Card, Checkbox, Field, Input, LANGUAGES, PageHeader, ProgressBar, Select, fmtBytes } from "@/components/ui";
import type { BookFile, BookSummary, Offering } from "@/lib/types";

type Mode = "server" | "direct";
interface Result { book: { id: string; code: string; title: string }; file: BookFile | null }

const EMPTY_FORM = {
  title: "", language: "en", publisher: "", edition: "", author: "", isbn: "", code: "", fileLabel: "",
  contentRelation: "SAME_SYLLABUS_VARIATION", activate: true,
};

export default function UploadPage() {
  // useSearchParams needs a Suspense boundary in Next 16 (see node_modules/next/dist/docs)
  return (
    <Suspense>
      <UploadForm />
    </Suspense>
  );
}

function UploadForm() {
  const { can } = useAuth();
  const params = useSearchParams();
  const { boards, classes, subjects, loading: catalogLoading, error: catalogError } = useCatalog();

  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  // Syllabus lookup result for one board+class+subject; `offering` is undefined until the current selection is looked up
  const [lookup, setLookup] = useState<{ key: string; offering: Offering | null } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("server");
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Preselect from ?offeringId= (links from the curriculum page)
  useEffect(() => {
    const id = params.get("offeringId");
    if (!id) return;
    api.get<Offering>(`/admin/offerings/${id}`).then((r) => {
      setBoardId(r.data.boardId);
      setClassId(r.data.classId);
      setSubjectId(r.data.subjectId);
    }).catch(() => undefined);
  }, [params]);

  useEffect(() => {
    if (!can(P.MANAGE_SYSTEM_SETTINGS)) return;
    api.get("/admin/storage/status").then((r) => {
      if (!r.data.reachable) setStorageWarning(r.data.error ?? "Cloud storage isn't reachable");
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find the syllabus for the chosen board + class + subject
  const selectionKey = boardId && classId && subjectId ? `${boardId}/${classId}/${subjectId}` : "";
  const offering = selectionKey && lookup?.key === selectionKey ? lookup.offering : undefined;
  const setOffering = (o: Offering | null) => setLookup({ key: selectionKey, offering: o });
  useEffect(() => {
    if (!selectionKey) return;
    let cancelled = false;
    api.get<Offering[]>(`/admin/offerings?boardId=${boardId}&classId=${classId}&subjectId=${subjectId}`)
      .then((r) => !cancelled && setLookup({ key: selectionKey, offering: r.data[0] ?? null }))
      .catch(() => !cancelled && setLookup({ key: selectionKey, offering: null }));
    return () => { cancelled = true; };
  }, [selectionKey, boardId, classId, subjectId]);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const canCreateSyllabus = can(P.MANAGE_CURRICULUM);
  const needsSyllabus = offering === null;
  const ready = boardId && classId && subjectId && offering !== undefined && form.title.trim() && file && (!needsSyllabus || canCreateSyllabus);

  const names = useMemo(() => ({
    board: boards.find((b) => b.id === boardId),
    klass: classes.find((c) => c.id === classId),
    subject: subjects.find((s) => s.id === subjectId),
  }), [boards, classes, subjects, boardId, classId, subjectId]);

  const metadata = () => {
    const body: Record<string, string | boolean> = { title: form.title.trim(), language: form.language, contentRelation: form.contentRelation, activate: form.activate };
    for (const k of ["publisher", "edition", "author", "isbn", "code", "fileLabel"] as const) {
      if (form[k].trim()) body[k] = k === "code" ? form[k].trim().toLowerCase() : form[k].trim();
    }
    return body;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !ready) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    let createdBook: Result["book"] | null = null;
    try {
      let off = offering;
      if (!off) {
        setStage("Creating syllabus…");
        const r = await api.post<Offering>("/admin/offerings", { boardId, classId, subjectId });
        off = r.data;
        setOffering(r.data);
      }

      if (mode === "server") {
        setStage("Uploading to cloud storage…");
        const fd = new FormData();
        Object.entries(metadata()).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append("file", file);
        const r = await api.post<{ book: BookSummary; file: BookFile }>(`/admin/offerings/${off.id}/books/upload`, fd, {
          onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
        });
        setResult({ book: r.data.book, file: r.data.file });
      } else {
        setStage("Creating book…");
        const { fileLabel, ...meta } = metadata();
        const created = await api.post<{ book: BookSummary }>(`/admin/offerings/${off.id}/books/new`, meta);
        createdBook = created.data.book;
        setStage("Getting upload link…");
        const presign = await api.post<{ bookFileId: string; uploadUrl: string; headers: Record<string, string> }>(
          `/admin/books/${createdBook.id}/files/presign`,
          { filename: file.name, sizeBytes: file.size, label: fileLabel || undefined },
        );
        setStage("Uploading directly to cloud storage…");
        await putWithProgress(presign.data.uploadUrl, file, presign.data.headers, setProgress);
        setStage("Finishing…");
        const done = await api.post<BookFile>(`/admin/books/${createdBook.id}/files/${presign.data.bookFileId}/complete`);
        setResult({ book: createdBook, file: done.data });
      }
      setProgress(100);
    } catch (err) {
      const msg = errorMessage(err, "Upload failed");
      setError(createdBook
        ? `${msg}. The book "${createdBook.title}" was created without a file; open it to retry the upload.`
        : msg);
      if (createdBook) setResult({ book: createdBook, file: null });
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setFile(null);
    setResult(null);
    setProgress(null);
    setError(null);
  };

  if (result?.file) {
    return (
      <>
        <PageHeader title="Upload book" />
        <Card>
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <h2 className="text-lg font-semibold">&ldquo;{result.book.title}&rdquo; uploaded</h2>
            <p className="text-sm text-slate-500 max-w-lg">
              Version {result.file.version} is in cloud storage and queued for processing (split into pages, then extracted).
            </p>
            <code className="text-xs bg-slate-100 rounded-lg px-3 py-2 break-all max-w-full">{result.file.r2Key}</code>
            <div className="flex gap-2 mt-2">
              <Link href={`/dashboard/books/${result.book.id}`} className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Open book</Link>
              <Button variant="secondary" onClick={reset}>Upload another</Button>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Upload book"
        description="Choose the syllabus (board, class, subject), add the book details and upload its PDF. The file is stored as books/{board}/{class}/{subject}/{book}/v1/ in the cloud bucket."
      />

      {storageWarning && (
        <div className="mb-4">
          <Alert kind="info">
            Cloud storage isn&apos;t ready: {storageWarning}. <Link href="/dashboard/storage" className="underline font-medium">Check storage</Link>
          </Alert>
        </div>
      )}
      {catalogError && <div className="mb-4"><Alert>{catalogError}</Alert></div>}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="1. Syllabus">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Board" required>
                <Select value={boardId} onChange={(e) => setBoardId(e.target.value)} required disabled={catalogLoading}>
                  <option value="">Select…</option>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Class" required>
                <Select value={classId} onChange={(e) => setClassId(e.target.value)} required disabled={catalogLoading}>
                  <option value="">Select…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Subject" required>
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required disabled={catalogLoading}>
                  <option value="">Select…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            {boardId && classId && subjectId && (
              <div className="mt-4 text-sm">
                {offering === undefined && <span className="text-slate-400">Looking up syllabus…</span>}
                {offering && <span className="text-emerald-700">✓ Syllabus found: {offering.board.name} · {offering.class.name} · {offering.subject.name}</span>}
                {needsSyllabus && (canCreateSyllabus
                  ? <span className="text-amber-700">No syllabus for {names.board?.name} · {names.klass?.name} · {names.subject?.name} yet. It will be created when you upload.</span>
                  : <span className="text-red-700">No syllabus for this combination, and you don&apos;t have permission to create one (manage:curriculum).</span>)}
              </div>
            )}
            {boards.length === 0 && !catalogLoading && (
              <p className="mt-3 text-sm text-slate-500">No boards yet. <Link href="/dashboard/curriculum" className="text-indigo-600 underline">Add them in Curriculum</Link>.</p>
            )}
          </Card>

          <Card title="2. Book details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Title" required>
                  <Input value={form.title} onChange={set("title")} placeholder="e.g. Science Textbook for Class 10" required />
                </Field>
              </div>
              <Field label="Language" required>
                <Select value={form.language} onChange={set("language")}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </Select>
              </Field>
              <Field label="Publisher"><Input value={form.publisher} onChange={set("publisher")} placeholder="e.g. NCERT" /></Field>
              <Field label="Edition"><Input value={form.edition} onChange={set("edition")} placeholder="e.g. 2025-26" /></Field>
              <Field label="Author"><Input value={form.author} onChange={set("author")} /></Field>
              <Field label="ISBN"><Input value={form.isbn} onChange={set("isbn")} /></Field>
              <Field label="Book code" hint="Optional unique id, e.g. ncert-science-10-en. Generated from publisher, title, edition and language if empty.">
                <Input value={form.code} onChange={set("code")} placeholder="auto" />
              </Field>
              <Field label="How it relates to other books on this syllabus">
                <Select value={form.contentRelation} onChange={set("contentRelation")}>
                  <option value="SAME_SYLLABUS_VARIATION">Same syllabus (variation, taught together)</option>
                  <option value="DIFFERENT_CONTENT">Different content (students must pick a book)</option>
                </Select>
              </Field>
              <Field label="Version label" hint="Optional, e.g. 2025 reprint">
                <Input value={form.fileLabel} onChange={set("fileLabel")} />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox checked={form.activate} onChange={set("activate")} label="Use this book now"
                  description="Untick to link it to the syllabus without teaching it yet (e.g. next year's replacement)." />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="3. PDF file">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-4 py-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition">
              <FileText className="w-8 h-8 text-slate-400" />
              {file ? (
                <>
                  <span className="text-sm font-medium text-slate-800 break-all">{file.name}</span>
                  <span className="text-xs text-slate-500">{fmtBytes(file.size)} · click to change</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-700">Choose a PDF</span>
                  <span className="text-xs text-slate-500">Up to 500 MB</span>
                </>
              )}
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>

            <div className="mt-5 space-y-2">
              <div className="text-sm font-medium text-slate-700">Upload method</div>
              <ModeOption active={mode === "server"} onClick={() => setMode("server")} icon={Server} title="Through the API"
                text="Simplest; works without bucket CORS settings." />
              <ModeOption active={mode === "direct"} onClick={() => setMode("direct")} icon={CloudUpload} title="Directly to cloud"
                text="Faster for large files. Needs a CORS rule on the bucket allowing PUT from this site." />
            </div>
          </Card>

          <Card>
            {error && <div className="mb-4"><Alert>{error}{result?.book && <> <Link className="underline font-medium" href={`/dashboard/books/${result.book.id}`}>Open book</Link></>}</Alert></div>}
            {progress !== null && busy && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-600"><span>{stage}</span><span>{progress}%</span></div>
                <ProgressBar value={progress} />
              </div>
            )}
            <Button type="submit" className="w-full" loading={busy} disabled={!ready}>
              <CloudUpload className="w-4 h-4" /> Upload book
            </Button>
            {!ready && !busy && <p className="text-xs text-slate-500 mt-2 text-center">Pick the syllabus, enter a title and choose a PDF.</p>}
          </Card>
        </div>
      </form>
    </>
  );
}

function ModeOption({ active, onClick, icon: Icon, title, text }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left flex gap-3 rounded-xl border px-3 py-2.5 transition ${active ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
      <Icon className={`w-5 h-5 mt-0.5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
      <span>
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}
