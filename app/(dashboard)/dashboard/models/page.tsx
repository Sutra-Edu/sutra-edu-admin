"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, fmtDate } from "@/components/ui";
import type { ModelConfig } from "@/lib/types";
import { Tabs } from "@/components/resource-editor";
import { AiCosts, HostingPlan } from "@/components/ai-costs";

// What each task is used for (mirrors ModelTask in the backend schema)
const TASKS: { task: string; label: string; use: string }[] = [
  { task: "LLM", label: "Language model", use: "Tutor answers, topic → page mapping, lessons, notes, quizzes, scripts, game rounds, learner notes" },
  { task: "EMBEDDING", label: "Embeddings", use: "Tutor searches every book of a syllabus by meaning (keyword search works without it)" },
  { task: "MODERATION", label: "Moderation", use: "Child-safety check on students' questions and the tutor's answers" },
  { task: "STT", label: "Speech to text", use: "Voice doubts and vivas" },
  { task: "TTS", label: "Text to speech", use: "Narration, video voice-over, the 3D tutor's voice (ElevenLabs also gives lip-sync timings)" },
  { task: "VISION", label: "Vision", use: "Describes book figures; reads students' photos of questions" },
  { task: "IMAGE_GEN", label: "Image generation", use: "Illustrations, diagrams and video scene images" },
  { task: "VIDEO_GEN", label: "Video assembly", use: "Turns scene images + narration into a video" },
  { task: "OCR", label: "OCR", use: "Reads scanned pages that have no text layer" },
  { task: "LAYOUT", label: "Layout", use: "Finds headings, paragraphs, figures, tables on each page" },
  { task: "EQUATION", label: "Equations & tables", use: "Turns equations into LaTeX and tables into Markdown" },
  { task: "GRADING", label: "Grading", use: "Marks student answers (later)" },
];

const ENDPOINT_HINT: Record<string, string> = {
  runpod: "https://api.runpod.ai/v2/<endpoint-id>",
  http: "The backend POSTs { task, model, params, input } here",
  openai: "API base, e.g. https://api.openai.com/v1 · Gemini: https://generativelanguage.googleapis.com/v1beta/openai · vLLM on RunPod: https://api.runpod.ai/v2/<id>/openai/v1",
  elevenlabs: "https://api.elevenlabs.io",
};
const PARAMS_HINT: Record<string, string> = {
  runpod: 'Model-specific options, e.g. {"voice": "anushka"}',
  http: 'Model-specific options, e.g. {"voice": "anushka"}',
  openai: 'Optional. {"apiKeyEnv": "GEMINI_API_KEY"} names the server env var holding the key (default OPENAI_API_KEY); TTS: {"voice": "alloy"}',
  elevenlabs: '{"voiceId": "<voice id>", "voices": {"hi": "<voice id>"}} · key from ELEVENLABS_API_KEY (or "apiKeyEnv")',
};

const WORKLOAD_LABEL: Record<string, string> = { ANY: "live + batch", LIVE: "live", BATCH: "batch" };
const PRICE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "inputPerMTokens", label: "Input, per 1M tokens", hint: "Language models, embeddings" },
  { key: "outputPerMTokens", label: "Output, per 1M tokens", hint: "Language models" },
  { key: "per1kChars", label: "Per 1,000 characters", hint: "Text-to-speech APIs" },
  { key: "perImage", label: "Per image", hint: "Image APIs" },
  { key: "perAudioMinute", label: "Per audio minute", hint: "Speech-to-text APIs" },
  { key: "perGpuSecond", label: "Per GPU second", hint: "RunPod: hourly price ÷ 3600" },
  { key: "perCall", label: "Per call", hint: "Anything charged per request" },
];

export default function ModelsPage() {
  const [tab, setTab] = useState<"models" | "costs" | "plan">("models");
  return (
    <>
      <PageHeader
        title="AI models"
        description="Which model each task uses, for live work (a student is waiting) and batch work (content generation), what it costs, and the plan for moving work onto your own GPUs."
      />
      <Tabs tabs={[{ key: "models", label: "Models" }, { key: "costs", label: "Costs" }, { key: "plan", label: "Hosting plan" }]} value={tab} onChange={setTab} />
      {tab === "models" && <Models />}
      {tab === "costs" && <AiCosts />}
      {tab === "plan" && <HostingPlan />}
    </>
  );
}

function Models() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_MODEL_CONFIGS);
  const { data: models, loading, error, reload } = useApi<ModelConfig[]>("/admin/models", []);
  const [editing, setEditing] = useState<ModelConfig | { task: string } | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [testing, setTesting] = useState<ModelConfig | null>(null);

  const act = async (fn: () => Promise<unknown>, text: string) => {
    try {
      await fn();
      setNotice({ kind: "success", text });
      reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <>
      <p className="text-sm text-slate-500 mb-4">
        One active model per task and workload: <b>live</b> calls come from the app while a student waits, <b>batch</b> calls from background jobs.
        A task with a single model set to <b>live + batch</b> uses it for both. Embeddings always use one model (books and questions must match).
      </p>
      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      {error && <Alert>{error}</Alert>}
      {loading ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TASKS.map((t) => {
            const rows = models.filter((m) => m.task === t.task);
            const active = rows.filter((m) => m.isActive);
            return (
              <Card key={t.task} title={t.label}
                actions={canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing({ task: t.task })}><Plus className="w-3.5 h-3.5" /> Add</Button>}>
                <p className="text-sm text-slate-500 -mt-1 mb-3">{t.use}</p>
                {!active.length && <div className="mb-3"><Badge color="amber">No active model</Badge></div>}
                {rows.length === 0 ? <p className="text-sm text-slate-400">None configured.</p> : (
                  <ul className="divide-y divide-slate-100 -my-2">
                    {rows.map((m) => (
                      <li key={m.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2 flex-wrap">{m.name} {m.isActive && <Badge color="green">active</Badge>}<Badge color={m.workload === "LIVE" ? "blue" : m.workload === "BATCH" ? "purple" : "gray"}>{WORKLOAD_LABEL[m.workload] ?? m.workload}</Badge>{!m.pricing && <Badge color="amber">no prices</Badge>}</div>
                          <div className="text-xs text-slate-500 break-all">{m.provider} · {m.endpointUrl}{m.modelName ? ` · ${m.modelName}` : ""}</div>
                          <div className="text-xs text-slate-400">Updated {fmtDate(m.updatedAt)}</div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => setTesting(m)}>Test</Button>
                            {!m.isActive
                              ? <Button size="sm" variant="ghost" onClick={() => act(() => api.patch(`/admin/models/${m.id}`, { isActive: true }), `${m.name} is now active for ${t.label}`)}>Activate</Button>
                              : <Button size="sm" variant="ghost" onClick={() => act(() => api.patch(`/admin/models/${m.id}`, { isActive: false }), `${m.name} deactivated`)}>Deactivate</Button>}
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${m.name}?`) && act(() => api.delete(`/admin/models/${m.id}`), `${m.name} deleted`)}>Delete</Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-4">Changes reach running workers within 30 seconds. RunPod endpoints use RUNPOD_API_KEY from the backend .env. Endpoints speak the contracts in sutra-edu-backend/src/model-router/contracts.ts; ready-made GPU workers are in sutra-edu-backend/services (see RUNPOD.md).</p>
      {testing && <TestModal model={testing} onClose={() => setTesting(null)} />}
      {editing && <ModelModal model={"id" in editing ? editing : null} task={editing.task} onClose={() => setEditing(null)}
        onSaved={(msg) => { setEditing(null); reload(); setNotice({ kind: "success", text: msg }); }} />}
    </>
  );
}

function ModelModal({ model, task, onClose, onSaved }: { model: ModelConfig | null; task: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState({
    name: model?.name ?? "", provider: model?.provider ?? "runpod", endpointUrl: model?.endpointUrl ?? "",
    modelName: model?.modelName ?? "", timeoutMs: String(model?.timeoutMs ?? 120000),
    params: model?.params ? JSON.stringify(model.params, null, 2) : "", activate: !model,
    workload: model?.workload ?? "ANY",
    pricing: Object.fromEntries(PRICE_FIELDS.map((f) => [f.key, model?.pricing?.[f.key] != null ? String(model.pricing[f.key]) : ""])) as Record<string, string>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = TASKS.find((t) => t.task === task)?.label ?? task;

  const save = async () => {
    setError(null);
    let params: Record<string, unknown> | undefined;
    if (form.params.trim()) {
      try {
        params = JSON.parse(form.params);
      } catch {
        setError("Params must be valid JSON");
        return;
      }
    }
    const pricing: Record<string, number> = {};
    for (const f of PRICE_FIELDS) {
      const v = form.pricing[f.key].trim();
      if (!v) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${f.label} must be a number`);
        return;
      }
      pricing[f.key] = n;
    }
    setSaving(true);
    const body = {
      workload: form.workload, pricing: Object.keys(pricing).length ? pricing : model ? null : undefined,
      name: form.name.trim(), provider: form.provider, endpointUrl: form.endpointUrl.trim(),
      modelName: form.modelName.trim() || undefined, timeoutMs: Number(form.timeoutMs) || 120000, params,
    };
    try {
      if (model) {
        await api.patch(`/admin/models/${model.id}`, body);
      } else {
        const res = await api.post<ModelConfig>("/admin/models", { ...body, task });
        if (form.activate) await api.patch(`/admin/models/${res.data.id}`, { isActive: true });
      }
      onSaved(`${body.name} saved`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={model ? `Edit ${model.name}` : `Add ${label} model`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} disabled={!form.name.trim() || !form.endpointUrl.trim()} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Llama 3.1 70B (RunPod)" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              <option value="runpod">RunPod serverless</option>
              <option value="http">HTTP (own service)</option>
              <option value="openai">OpenAI-compatible API (OpenAI, Gemini, Groq, vLLM…)</option>
              <option value="elevenlabs">ElevenLabs (TTS with lip-sync timings)</option>
            </Select>
          </Field>
          <Field label="Timeout (ms)"><Input type="number" min={1000} value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })} /></Field>
        </div>
        {task !== "EMBEDDING" && (
          <Field label="Workload" hint="Live: while a student waits (tutor, doubts, games). Batch: background jobs (lessons, narration, images, book processing).">
            <Select value={form.workload} onChange={(e) => setForm({ ...form, workload: e.target.value as ModelConfig["workload"] })}>
              <option value="ANY">Live + batch</option>
              <option value="LIVE">Live only</option>
              <option value="BATCH">Batch only</option>
            </Select>
          </Field>
        )}
        <Field label="Endpoint URL" required hint={ENDPOINT_HINT[form.provider] ?? ""}>
          <Input value={form.endpointUrl} onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} />
        </Field>
        <Field label="Model name" hint={form.provider === "openai" ? "Required, e.g. gpt-4.1-mini, gemini-2.5-flash, text-embedding-3-small, whisper-1" : form.provider === "elevenlabs" ? "e.g. eleven_multilingual_v2" : "Passed to the worker; optional"}><Input value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} /></Field>
        <Field label="Params (JSON)" hint={PARAMS_HINT[form.provider] ?? ""}>
          <Textarea rows={3} className="font-mono text-xs" value={form.params} onChange={(e) => setForm({ ...form, params: e.target.value })} />
        </Field>
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">Prices (USD, for the cost report)</div>
          <p className="text-xs text-slate-500 mb-2">Fill in only what this model is charged for.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRICE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Input type="number" min={0} step="any" value={form.pricing[f.key]} onChange={(e) => setForm({ ...form, pricing: { ...form.pricing, [f.key]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </div>
        {!model && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activate} onChange={(e) => setForm({ ...form, activate: e.target.checked })} className="rounded border-slate-300 text-indigo-600" />
            Make it the active {label} model
          </label>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}

const IMAGE_TASKS = ["VISION", "OCR", "EQUATION", "LAYOUT"];

function TestModal({ model, onClose }: { model: ModelConfig; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState("");
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; latencyMs: number; summary?: string; sample?: unknown; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsImage = IMAGE_TASKS.includes(model.task);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post(`/admin/models/${model.id}/test`, { imageUrl: imageUrl.trim() || undefined, text: text.trim() || undefined });
      setResult(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };
  const sample = typeof result?.sample === "string" ? result.sample : result?.sample != null ? JSON.stringify(result.sample, null, 2) : null;

  return (
    <Modal open onClose={onClose} title={`Test ${model.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button loading={running} disabled={needsImage && !imageUrl.trim()} onClick={run}>Run test</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Sends one small real request to this model (active or not). It is billed like any other call and shows in Costs under “admin.test”.</p>
        {needsImage
          ? <Field label="Image link" required hint="A public https link, or a data: URL, to a page, figure or equation"><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></Field>
          : model.task !== "STT" && model.task !== "VIDEO_GEN" && <Field label="Text (optional)" hint="Leave empty for a standard sample"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {model.task === "STT" && <p className="text-sm text-slate-500">The sample audio is made with the active text-to-speech model.</p>}
        {error && <Alert>{error}</Alert>}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Badge color={result.ok ? "green" : "red"}>{result.ok ? "works" : "failed"}</Badge><span className="text-xs text-slate-500">{(result.latencyMs / 1000).toFixed(1)} s</span></div>
            {result.summary && <div className="text-sm">{result.summary}</div>}
            {result.error && <div className="text-sm text-red-700 break-all">{result.error}</div>}
            {sample && sample.startsWith("data:audio") && <audio controls src={sample} className="w-full" />}
            {sample && sample.startsWith("data:image") && <img src={sample} alt="Generated sample" className="max-h-80 rounded border border-slate-200" />}
            {sample && !sample.startsWith("data:") && <pre className="text-xs bg-slate-50 rounded p-2 whitespace-pre-wrap break-words max-h-60 overflow-auto">{sample}</pre>}
          </div>
        )}
      </div>
    </Modal>
  );
}
