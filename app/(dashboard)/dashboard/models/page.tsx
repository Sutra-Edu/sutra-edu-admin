"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, fmtDate } from "@/components/ui";
import type { ModelConfig } from "@/lib/types";

// What each task is used for (mirrors ModelTask in the backend schema)
const TASKS: { task: string; label: string; use: string }[] = [
  { task: "LLM", label: "Language model", use: "Writes lessons, summaries, narration scripts, image prompts and video storyboards" },
  { task: "TTS", label: "Text to speech", use: "Narration audio for lessons and video scenes" },
  { task: "IMAGE_GEN", label: "Image generation", use: "Illustrations, diagrams and video scene images" },
  { task: "VIDEO_GEN", label: "Video assembly", use: "Turns scene images + narration into a video" },
  { task: "OCR", label: "OCR", use: "Reads scanned pages that have no text layer" },
  { task: "LAYOUT", label: "Layout", use: "Finds headings, paragraphs, figures, tables on each page" },
  { task: "VISION", label: "Vision", use: "Describes figures found in the books" },
  { task: "EQUATION", label: "Equations & tables", use: "Turns equations into LaTeX and tables into Markdown" },
  { task: "EMBEDDING", label: "Embeddings", use: "Search over book content (later)" },
  { task: "GRADING", label: "Grading", use: "Marks student answers (later)" },
];

export default function ModelsPage() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_MODEL_CONFIGS);
  const { data: models, loading, error, reload } = useApi<ModelConfig[]>("/admin/models", []);
  const [editing, setEditing] = useState<ModelConfig | { task: string } | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

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
      <PageHeader
        title="AI models"
        description="The model endpoint each task uses (one active per task). Endpoints are RunPod serverless workers, or any HTTP service that speaks the contracts in sutra-edu-backend/src/model-router/contracts.ts."
      />
      {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
      {error && <Alert>{error}</Alert>}
      {loading ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TASKS.map((t) => {
            const rows = models.filter((m) => m.task === t.task);
            const active = rows.find((m) => m.isActive);
            return (
              <Card key={t.task} title={t.label}
                actions={canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing({ task: t.task })}><Plus className="w-3.5 h-3.5" /> Add</Button>}>
                <p className="text-sm text-slate-500 -mt-1 mb-3">{t.use}</p>
                {!active && <div className="mb-3"><Badge color="amber">No active model</Badge></div>}
                {rows.length === 0 ? <p className="text-sm text-slate-400">None configured.</p> : (
                  <ul className="divide-y divide-slate-100 -my-2">
                    {rows.map((m) => (
                      <li key={m.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">{m.name} {m.isActive && <Badge color="green">active</Badge>}</div>
                          <div className="text-xs text-slate-500 break-all">{m.provider} · {m.endpointUrl}{m.modelName ? ` · ${m.modelName}` : ""}</div>
                          <div className="text-xs text-slate-400">Updated {fmtDate(m.updatedAt)}</div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 shrink-0">
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
      <p className="text-xs text-slate-500 mt-4">Changes reach running workers within 30 seconds. RunPod endpoints use RUNPOD_API_KEY from the backend .env.</p>
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
    setSaving(true);
    const body = {
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
            </Select>
          </Field>
          <Field label="Timeout (ms)"><Input type="number" min={1000} value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })} /></Field>
        </div>
        <Field label="Endpoint URL" required hint={form.provider === "runpod" ? "https://api.runpod.ai/v2/<endpoint-id>" : "The backend POSTs { task, model, params, input } here"}>
          <Input value={form.endpointUrl} onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} />
        </Field>
        <Field label="Model name" hint="Passed to the worker; optional"><Input value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} /></Field>
        <Field label="Params (JSON)" hint='Model-specific options, e.g. {"voice": "anushka"}'>
          <Textarea rows={3} className="font-mono text-xs" value={form.params} onChange={(e) => setForm({ ...form, params: e.target.value })} />
        </Field>
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
