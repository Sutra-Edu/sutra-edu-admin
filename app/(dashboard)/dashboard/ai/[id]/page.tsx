"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, RefreshCw, Trash2, X } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { KIND_META, ReviewBadge, stepLabel } from "@/components/ai";
import { Alert, Button, Card, LANGUAGES, PageHeader, Spinner, StatusBadge, fmtBytes, fmtDate, fullName } from "@/components/ui";
import type { GeneratedAsset, Generation } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  main: "Result", script: "Narration script", storyboard: "Storyboard", scene_image: "Scene image", scene_audio: "Scene narration",
};

export default function GenerationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data: gen, loading, error, reload } = useApi<Generation | null>(`/admin/generations/${id}`, null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const running = gen?.status === "QUEUED" || gen?.status === "RUNNING";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => reload(), 2500);
    return () => clearInterval(t);
  }, [running, reload]);

  const act = async (key: string, fn: () => Promise<unknown>, text: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: "success", text });
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  if (loading && !gen) return <Spinner />;
  if (error || !gen) return <Alert>{error ?? "Generation not found"}</Alert>;

  const assets = gen.assets ?? [];
  const main = assets.find((a) => a.role === "main");
  const parts = assets.filter((a) => a.role !== "main");
  const scenes = groupScenes(parts);
  const others = parts.filter((a) => a.sceneIndex === null);
  const Icon = KIND_META[gen.kind].icon;

  return (
    <>
      <Link href="/dashboard/ai" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 mb-3">
        <ArrowLeft className="w-4 h-4" /> AI Studio
      </Link>
      <PageHeader
        title={main?.title || `${KIND_META[gen.kind].label} · ${gen.purpose}`}
        description={`${gen.book.title} · v${gen.bookFile.version} · pages ${gen.pageFrom}${gen.pageTo !== gen.pageFrom ? `–${gen.pageTo}` : ""} · ${LANGUAGES.find((l) => l.value === gen.language)?.label ?? gen.language}`}
        actions={<>
          <StatusBadge status={gen.status} />
          {can(P.REVIEW_CONTENT) && gen.status === "SUCCEEDED" && <>
            <Button loading={busy === "approve"} onClick={() => act("approve", () => api.post(`/admin/generations/${id}/review`, { status: "APPROVED" }), "Approved: students can now see it")}><Check className="w-4 h-4" /> Approve all</Button>
            <Button variant="secondary" loading={busy === "reject"} onClick={() => act("reject", () => api.post(`/admin/generations/${id}/review`, { status: "REJECTED" }), "Rejected")}><X className="w-4 h-4" /> Reject</Button>
          </>}
          {can(P.GENERATE_CONTENT) && running && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel", () => api.post(`/admin/generations/${id}/cancel`), "Cancelled")}>Cancel</Button>}
          {can(P.GENERATE_CONTENT) && (gen.status === "FAILED" || gen.status === "CANCELLED") && (
            <Button variant="secondary" loading={busy === "retry"} onClick={() => act("retry", () => api.post(`/admin/generations/${id}/retry`), "Queued again")}><RefreshCw className="w-4 h-4" /> Retry</Button>
          )}
          {can(P.GENERATE_CONTENT) && !running && (
            <Button variant="danger" loading={busy === "delete"} onClick={async () => {
              if (!confirm("Delete this generation and all its files?")) return;
              setBusy("delete");
              try {
                await api.delete(`/admin/generations/${id}`);
                router.replace("/dashboard/ai");
              } catch (err) {
                setNotice({ kind: "error", text: errorMessage(err) });
                setBusy(null);
              }
            }}><Trash2 className="w-4 h-4" /></Button>
          )}
        </>}
      />

      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      {gen.status === "FAILED" && gen.error && <div className="mb-4"><Alert>{gen.error}</Alert></div>}
      {running && (
        <div className="mb-4"><Alert kind="info">{gen.progress ? stepLabel(gen.progress) : "Waiting for a worker"}…</Alert></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {main ? (
            <Card title="Result" actions={<AssetReview asset={main} canReview={can(P.REVIEW_CONTENT)} onDone={reload} />}>
              <AssetView asset={main} large />
            </Card>
          ) : !running && gen.status !== "FAILED" && (
            <Card><p className="text-sm text-slate-500">No result.</p></Card>
          )}

          {scenes.length > 0 && (
            <Card title={`Scenes (${scenes.length})`}>
              <div className="space-y-4">
                {scenes.map((s) => (
                  <div key={s.index} className="grid gap-3 sm:grid-cols-[200px_1fr] items-start border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    {/* Signed, short-lived R2 links: next/image would cache them past expiry */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.image && <img src={s.image.url} alt={`Scene ${s.index + 1}`} className="rounded-lg border border-slate-200 w-full bg-slate-50" />}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500">Scene {s.index + 1}</div>
                      {s.audio?.text && <p className="text-sm text-slate-800">{s.audio.text}</p>}
                      {s.audio && <audio controls src={s.audio.url} className="w-full h-9" />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {others.map((a) => (
            <Card key={a.id} title={ROLE_LABEL[a.role] ?? a.role}>
              <AssetView asset={a} />
            </Card>
          ))}
        </div>

        <Card title="Details" className="h-fit">
          <dl className="space-y-3 text-sm">
            <Row label="Kind"><span className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4 text-slate-400" /> {KIND_META[gen.kind].label} · {gen.purpose}</span></Row>
            <Row label="Book"><Link href={`/dashboard/books/${gen.book.id}`} className="text-indigo-600 hover:underline">{gen.book.title}</Link></Row>
            <Row label="Read from">Version {gen.bookFile.version}, pages {gen.pageFrom}–{gen.pageTo}</Row>
            {gen.instructions && <Row label="Instructions">{gen.instructions}</Row>}
            <Row label="Requested">{gen.requestedBy ? fullName(gen.requestedBy) : "—"} · {fmtDate(gen.createdAt)}</Row>
            {gen.finishedAt && <Row label="Finished">{fmtDate(gen.finishedAt)}</Row>}
            <Row label="Files">{assets.length} ({fmtBytes(assets.reduce((n, a) => n + (a.sizeBytes ?? 0), 0))})</Row>
            {main && <Row label="Stored at"><code className="text-xs break-all bg-slate-100 rounded px-1.5 py-0.5">{main.r2Key}</code></Row>}
          </dl>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900 mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function groupScenes(parts: GeneratedAsset[]) {
  const map = new Map<number, { index: number; image?: GeneratedAsset; audio?: GeneratedAsset }>();
  for (const a of parts) {
    if (a.sceneIndex === null) continue;
    const s = map.get(a.sceneIndex) ?? { index: a.sceneIndex };
    if (a.role === "scene_image") s.image = a;
    if (a.role === "scene_audio") s.audio = a;
    map.set(a.sceneIndex, s);
  }
  return [...map.values()].sort((a, b) => a.index - b.index);
}

function AssetView({ asset, large }: { asset: GeneratedAsset; large?: boolean }) {
  const meta = asset.metadata ?? {};
  switch (asset.kind) {
    case "VIDEO":
      return <video controls src={asset.url} className="w-full rounded-lg bg-black" />;
    case "IMAGE":
      return (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived R2 link */}
          <img src={asset.url} alt={String(meta.altText ?? asset.title ?? "Generated image")} className={`rounded-lg border border-slate-200 bg-slate-50 ${large ? "w-full" : "max-w-sm"}`} />
          {typeof meta.altText === "string" && <figcaption className="text-xs text-slate-500">{meta.altText}</figcaption>}
        </figure>
      );
    case "AUDIO":
      return (
        <div className="space-y-3">
          <audio controls src={asset.url} className="w-full" />
          {asset.text && <details className="text-sm"><summary className="cursor-pointer text-slate-500">Script</summary><p className="mt-2 whitespace-pre-wrap text-slate-800">{asset.text}</p></details>}
        </div>
      );
    default:
      return asset.mimeType === "application/json"
        ? <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-auto max-h-96">{asset.text}</pre>
        : <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 max-h-[32rem] overflow-y-auto">{asset.text}</div>;
  }
}

function AssetReview({ asset, canReview, onDone }: { asset: GeneratedAsset; canReview: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const set = async (status: string) => {
    setBusy(true);
    try {
      await api.patch(`/admin/generated-assets/${asset.id}`, { status });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <ReviewBadge status={asset.reviewStatus} />
      {canReview && asset.reviewStatus !== "APPROVED" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("APPROVED")}>Approve</Button>}
      {canReview && asset.reviewStatus !== "REJECTED" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("REJECTED")}>Reject</Button>}
    </div>
  );
}
