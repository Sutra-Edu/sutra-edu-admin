"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import {
  Alert, Button, Card, EmptyState, Field, Input, LANGUAGES, PageHeader, Select, Spinner, StatusBadge, Table, Td, Textarea, fmtDate,
} from "@/components/ui";
import type { BookSummary, GeneratedKind, Generation, GenerationOptions } from "@/lib/types";
import { KIND_META, ReviewBadge, stepLabel } from "@/components/ai";

export default function AiStudioPage() {
  // useSearchParams needs a Suspense boundary in Next 16
  return (
    <Suspense>
      <AiStudio />
    </Suspense>
  );
}

function AiStudio() {
  const { can } = useAuth();
  const params = useSearchParams();
  const [filter, setFilter] = useState({ status: "", kind: "", bookId: params.get("bookId") ?? "" });
  const qs = new URLSearchParams({ take: "100", ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) }).toString();
  const gens = useApi<Generation[]>(`/admin/generations?${qs}`, []);

  // Refresh while something is queued or running
  const active = gens.data.some((g) => g.status === "QUEUED" || g.status === "RUNNING");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => gens.reload(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, qs]);

  return (
    <>
      <PageHeader title="AI Studio" description="Turn book pages into lessons, narration, illustrations and explainer videos. The AI reads only the extracted pages you choose; nothing reaches students until it is approved." />
      <div className="grid gap-6 xl:grid-cols-5">
        {can(P.GENERATE_CONTENT) && (
          <div className="xl:col-span-2">
            <NewGeneration initialBookId={params.get("bookId") ?? ""} onCreated={() => gens.reload()} />
          </div>
        )}
        <div className={can(P.GENERATE_CONTENT) ? "xl:col-span-3" : "xl:col-span-5"}>
          <Card title="Generations" actions={
            <div className="flex gap-2">
              <Select className="w-32" value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
                <option value="">All kinds</option>
                {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </Select>
              <Select className="w-36" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                <option value="">Any status</option>
                {["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
              </Select>
            </div>
          }>
            {filter.bookId && (
              <div className="mb-3 text-sm text-slate-600">Showing one book. <button className="text-indigo-600 underline" onClick={() => setFilter({ ...filter, bookId: "" })}>Show all</button></div>
            )}
            {gens.error && <Alert>{gens.error}</Alert>}
            {gens.loading ? <Spinner /> : gens.data.length === 0 ? <EmptyState title="Nothing generated yet" description="Pick a book and pages on the left to start." /> : (
              <Table head={["What", "Book & pages", "Status", "Review", "Requested"]}>
                {gens.data.map((g) => {
                  const Icon = KIND_META[g.kind].icon;
                  const main = (g as Generation & { assets?: { reviewStatus: string }[] }).assets?.[0];
                  return (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/dashboard/ai/${g.id}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-indigo-600">
                          <Icon className="w-4 h-4 text-slate-400" /> {KIND_META[g.kind].label} · {g.purpose}
                        </Link>
                        <div className="text-xs text-slate-500">{LANGUAGES.find((l) => l.value === g.language)?.label ?? g.language}</div>
                      </Td>
                      <Td>
                        <div className="truncate max-w-[220px]">{g.book.title}</div>
                        <div className="text-xs text-slate-500">v{g.bookFile.version} · pages {g.pageFrom}{g.pageTo !== g.pageFrom ? `–${g.pageTo}` : ""}</div>
                      </Td>
                      <Td>
                        <StatusBadge status={g.status} />
                        {g.status === "RUNNING" && g.progress && <div className="text-xs text-slate-500 mt-1">{stepLabel(g.progress)}</div>}
                        {g.error && <div className="text-xs text-red-600 mt-1 max-w-xs line-clamp-2" title={g.error}>{g.error}</div>}
                      </Td>
                      <Td>{main ? <ReviewBadge status={main.reviewStatus} /> : <span className="text-slate-400">—</span>}</Td>
                      <Td className="text-slate-500 whitespace-nowrap text-xs">{fmtDate(g.createdAt)}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function NewGeneration({ initialBookId, onCreated }: { initialBookId: string; onCreated: () => void }) {
  const router = useRouter();
  const books = useApi<BookSummary[]>("/admin/books?take=200&status=READY", []);
  const options = useApi<GenerationOptions | null>("/admin/generations/options", null);
  const [bookId, setBookId] = useState(initialBookId);
  const [kind, setKind] = useState<GeneratedKind>("TEXT");
  const [form, setForm] = useState({ purpose: "", pageFrom: "1", pageTo: "1", language: "", instructions: "", voice: "", width: "", height: "", maxScenes: "5" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = books.data.find((b) => b.id === bookId);
  const live = book?.files?.find((f) => f.isCurrent) ?? book?.files?.[0];
  const kindInfo = options.data?.kinds.find((k) => k.kind === kind);
  const purpose = form.purpose || kindInfo?.purposes[0]?.value || "";
  const missing = kindInfo?.models.filter((m) => !m.active).map((m) => m.task) ?? [];
  const pages = Number(form.pageTo) - Number(form.pageFrom) + 1;
  const maxPages = options.data?.maxPages ?? 30;
  const rangeError = useMemo(() => {
    if (!live?.pageCount) return null;
    const from = Number(form.pageFrom), to = Number(form.pageTo);
    if (!from || !to || from > to) return "Choose a valid page range";
    if (to > live.pageCount) return `This book has ${live.pageCount} pages`;
    if (pages > maxPages) return `At most ${maxPages} pages per request`;
    return null;
  }, [form.pageFrom, form.pageTo, live, pages, maxPages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const opts: Record<string, unknown> = {};
    if ((kind === "AUDIO" || kind === "VIDEO") && form.voice.trim()) opts.voice = form.voice.trim();
    if ((kind === "IMAGE" || kind === "VIDEO") && form.width) opts.width = Number(form.width);
    if ((kind === "IMAGE" || kind === "VIDEO") && form.height) opts.height = Number(form.height);
    if (kind === "VIDEO" && form.maxScenes) opts.maxScenes = Number(form.maxScenes);
    try {
      const res = await api.post<Generation>(`/admin/books/${bookId}/generations`, {
        kind, purpose, pageFrom: Number(form.pageFrom), pageTo: Number(form.pageTo),
        language: form.language || undefined, instructions: form.instructions.trim() || undefined,
        options: Object.keys(opts).length ? opts : undefined,
      });
      onCreated();
      router.push(`/dashboard/ai/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="New generation">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Book" required hint="Only books with a fully processed version are listed">
          <Select value={bookId} onChange={(e) => setBookId(e.target.value)} required>
            <option value="">Select a book…</option>
            {books.data.map((b) => (
              <option key={b.id} value={b.id}>{b.title} ({b.subject.name}, {b.classes.map((c) => c.class.name).join("/")})</option>
            ))}
          </Select>
        </Field>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Make</span>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(KIND_META) as GeneratedKind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              return (
                <button type="button" key={k} onClick={() => { setKind(k); setForm({ ...form, purpose: "" }); }}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition ${kind === k ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  <Icon className="w-5 h-5" /> {KIND_META[k].label}
                </button>
              );
            })}
          </div>
        </div>

        {missing.length > 0 && (
          <Alert kind="info">
            {KIND_META[kind].label} needs an active model for: {missing.join(", ")}. <Link href="/dashboard/models" className="underline font-medium">Set up AI models</Link>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purpose">
            <Select value={purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {kindInfo?.purposes.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Language" hint="Default: the book's language">
            <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="">Book language{book ? ` (${book.language})` : ""}</option>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
          <Field label="From page" required><Input type="number" min={1} value={form.pageFrom} onChange={(e) => setForm({ ...form, pageFrom: e.target.value })} /></Field>
          <Field label="To page" required hint={live?.pageCount ? `${live.pageCount} pages in v${live.version}` : undefined}>
            <Input type="number" min={1} value={form.pageTo} onChange={(e) => setForm({ ...form, pageTo: e.target.value })} />
          </Field>
        </div>

        {(kind === "AUDIO" || kind === "VIDEO") && (
          <Field label="Voice" hint="Optional; a voice name your TTS model supports"><Input value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })} /></Field>
        )}
        {(kind === "IMAGE" || kind === "VIDEO") && (
          <div className="grid gap-4 grid-cols-3">
            <Field label="Width"><Input type="number" placeholder={kind === "VIDEO" ? "1280" : "1024"} value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></Field>
            <Field label="Height"><Input type="number" placeholder={kind === "VIDEO" ? "720" : "768"} value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></Field>
            {kind === "VIDEO" && <Field label="Max scenes"><Input type="number" min={1} max={20} value={form.maxScenes} onChange={(e) => setForm({ ...form, maxScenes: e.target.value })} /></Field>}
          </div>
        )}

        <Field label="Instructions" hint="Optional guidance, e.g. 'use cricket examples' or 'keep it under 2 minutes'">
          <Textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </Field>

        {bookId && (
          <Link href={`/dashboard/books/${bookId}`} className="block text-xs text-indigo-600 hover:underline">Open the book to check its pages first</Link>
        )}
        {rangeError && <p className="text-xs text-red-600">{rangeError}</p>}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" loading={saving} disabled={!bookId || !purpose || !!rangeError}>
          <Sparkles className="w-4 h-4" /> Generate
        </Button>
      </form>
    </Card>
  );
}
