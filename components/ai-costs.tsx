"use client";

import { useState } from "react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Spinner, Table, Td, Textarea } from "@/components/ui";

type Phase = "RUNPOD_NOW" | "API_NOW" | "API_THEN_RUNPOD" | "NO_GPU";
export interface PlanItem {
  key: string; task: string; workload: "LIVE" | "BATCH" | "ANY"; title: string; phase: Phase;
  start: string; later: string; gpu: string; moveWhenMonthlyUsdOver: number | null; notes: string;
}
interface PlanStatus extends PlanItem {
  currentModel: { id: string; name: string; provider: string; onRunpod: boolean } | null;
  projectedMonthlyUsd: number; status: string; advice: string;
}
interface Totals {
  calls: number; errors: number; avgLatencyMs: number; latencyMsMax: number; inputTokens: number; outputTokens: number;
  characters: number; images: number; audioSeconds: number; gpuSeconds: number; costUsd: number; projectedMonthlyUsd: number;
}
interface Report {
  days: number; since: string; total: Totals; projectedMonthlyUsd: number;
  byTask: (Totals & { task: string; workload: string })[];
  byFeature: (Totals & { task: string; workload: string; feature: string; model: string })[];
  daily: { day: string; calls: number; errors: number; costUsd: number }[];
  plan: PlanStatus[];
  unpricedModels: { id: string; name: string; task: string }[];
}

export const PHASE_LABEL: Record<Phase, string> = {
  RUNPOD_NOW: "Own GPUs from day one",
  API_THEN_RUNPOD: "API first, then own GPUs",
  API_NOW: "Stays on an API",
  NO_GPU: "No GPU needed",
};
const STATUS: Record<string, { label: string; color: "green" | "amber" | "red" | "gray" | "blue" }> = {
  ON_PLAN: { label: "on plan", color: "green" },
  ON_RUNPOD: { label: "on RunPod", color: "blue" },
  GET_READY: { label: "get ready", color: "amber" },
  MOVE_NOW: { label: "move now", color: "red" },
  NOT_SET: { label: "not set up", color: "gray" },
};
const toItem = (p: PlanItem): PlanItem => ({
  key: p.key, task: p.task, workload: p.workload, title: p.title, phase: p.phase, start: p.start, later: p.later, gpu: p.gpu,
  moveWhenMonthlyUsdOver: p.moveWhenMonthlyUsdOver, notes: p.notes,
});
const usd = (n: number) => (n >= 100 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`);
const num = (n: number) => n.toLocaleString();
const workloadLabel = (w: string) => (w === "ANY" ? "live + batch" : w.toLowerCase());

function usageLine(t: Totals) {
  const parts: string[] = [];
  if (t.inputTokens || t.outputTokens) parts.push(`${num(t.inputTokens)} in / ${num(t.outputTokens)} out tokens`);
  if (t.characters) parts.push(`${num(t.characters)} chars`);
  if (t.images) parts.push(`${num(t.images)} images`);
  if (t.audioSeconds) parts.push(`${Math.round(t.audioSeconds / 60)} audio min`);
  if (t.gpuSeconds) parts.push(`${(t.gpuSeconds / 3600).toFixed(1)} GPU h`);
  return parts.join(" · ") || "—";
}

export function AiCosts() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useApi<Report | null>(`/admin/models/usage?days=${days}`, null);
  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;
  const maxDay = Math.max(...data.daily.map((d) => d.costUsd), 0.01);
  const moves = data.plan.filter((p) => p.status === "MOVE_NOW" || p.status === "GET_READY");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Period</span>
        <div className="w-44">
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </Select>
        </div>
      </div>

      {data.unpricedModels.length > 0 && (
        <Alert kind="info">
          No prices on {data.unpricedModels.map((m) => `${m.name} (${m.task})`).join(", ")}, so their cost shows as $0. Add prices under Models → Edit.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={`Spent, last ${data.days} days`} value={usd(data.total.costUsd)} />
        <Stat label="Projected per month" value={usd(data.projectedMonthlyUsd)} hint="From the last 7 days" />
        <Stat label="AI calls" value={num(data.total.calls)} hint={data.total.errors ? `${num(data.total.errors)} failed` : "none failed"} />
        <Stat label="Average response" value={`${(data.total.avgLatencyMs / 1000).toFixed(1)} s`} />
      </div>

      {moves.length > 0 && (
        <Card title="Should move to your own GPUs">
          <ul className="space-y-2">
            {moves.map((p) => (
              <li key={p.key} className="text-sm flex gap-2 items-start">
                <Badge color={STATUS[p.status].color}>{STATUS[p.status].label}</Badge>
                <span><b>{p.title}</b>: {p.advice}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="By task">
        {!data.byTask.length ? <EmptyState title="No AI calls in this period" /> : (
          <Table head={["Task", "Workload", "Calls", "Usage", "Avg / max response", "Cost", "Per month"]}>
            {[...data.byTask].sort((a, b) => b.costUsd - a.costUsd).map((r) => (
              <tr key={`${r.task}-${r.workload}`}>
                <Td className="font-medium">{r.task}</Td>
                <Td>{workloadLabel(r.workload)}</Td>
                <Td>{num(r.calls)}{r.errors ? <span className="text-red-600 text-xs"> ({r.errors} failed)</span> : null}</Td>
                <Td className="text-xs">{usageLine(r)}</Td>
                <Td className="text-xs">{(r.avgLatencyMs / 1000).toFixed(1)} / {(r.latencyMsMax / 1000).toFixed(1)} s</Td>
                <Td>{usd(r.costUsd)}</Td>
                <Td>{usd(r.projectedMonthlyUsd)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {data.daily.length > 0 && (
        <Card title="Per day">
          <div className="flex items-end gap-1 h-32" role="img" aria-label="Cost per day">
            {data.daily.map((d) => (
              <div key={d.day} className="flex-1 min-w-[4px] bg-indigo-500/80 rounded-t" style={{ height: `${Math.max((d.costUsd / maxDay) * 100, 2)}%` }}
                title={`${d.day}: ${usd(d.costUsd)}, ${num(d.calls)} calls`} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{data.daily[0].day}</span><span>{data.daily.at(-1)!.day}</span></div>
        </Card>
      )}

      <Card title="By feature">
        {!data.byFeature.length ? <EmptyState title="Nothing yet" /> : (
          <Table head={["Feature", "Task", "Model", "Calls", "Usage", "Cost"]}>
            {data.byFeature.slice(0, 50).map((r, i) => (
              <tr key={i}>
                <Td className="text-xs font-mono">{r.feature || "—"}</Td>
                <Td className="text-xs">{r.task} · {workloadLabel(r.workload)}</Td>
                <Td className="text-xs">{r.model}</Td>
                <Td>{num(r.calls)}</Td>
                <Td className="text-xs">{usageLine(r)}</Td>
                <Td>{usd(r.costUsd)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <p className="text-xs text-slate-500">Costs are estimates from each model’s prices. RunPod GPU time excludes cold starts and idle time before a worker stops, so the real RunPod bill runs a little higher.</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </Card>
  );
}

export function HostingPlan() {
  const { can } = useAuth();
  const canEdit = can(P.MANAGE_MODEL_CONFIGS);
  const report = useApi<Report | null>("/admin/models/usage?days=30", null);
  const [edits, setItems] = useState<PlanItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // Unsaved edits, else the plan as the server has it
  const items: PlanItem[] | null = edits ?? report.data?.plan.map(toItem) ?? null;

  if (report.loading && !report.data) return <Spinner />;
  if (report.error) return <Alert>{report.error}</Alert>;
  if (!items || !report.data) return null;
  const statusOf = new Map(report.data.plan.map((p) => [p.key, p]));
  const set = (key: string, patch: Partial<PlanItem>) => setItems(items.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/models/hosting-plan", { items });
      setItems(null);
      setNotice({ kind: "success", text: "Hosting plan saved" });
      report.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!confirm("Go back to the default plan? Your changes to it will be lost.")) return;
    try {
      await api.post("/admin/models/hosting-plan/reset");
      setItems(null);
      setNotice({ kind: "success", text: "Back to the default plan" });
      report.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  const groups: Phase[] = ["RUNPOD_NOW", "API_THEN_RUNPOD", "API_NOW", "NO_GPU"];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Where each kind of AI work runs. Batch media (narration, images, OCR, lesson writing) runs on your own rented GPUs from day one; live work (the tutor in class)
        starts on APIs and moves once its monthly API bill passes what the GPUs would cost. The status uses the last 7 days of the cost report.
        Set the “move when” amounts from your real RunPod prices.
      </p>
      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      {groups.map((phase) => {
        const rows = items.filter((p) => p.phase === phase);
        if (!rows.length) return null;
        return (
          <Card key={phase} title={PHASE_LABEL[phase]}>
            <div className="divide-y divide-slate-100 -my-2">
              {rows.map((p) => {
                const st = statusOf.get(p.key);
                return (
                  <div key={p.key} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium text-sm">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.task} · {workloadLabel(p.workload)}{st?.currentModel ? ` · now: ${st.currentModel.name}${st.currentModel.onRunpod ? " (RunPod)" : ""}` : ""}</div>
                      </div>
                      {st && <div className="flex items-center gap-2"><Badge color={STATUS[st.status]?.color ?? "gray"}>{STATUS[st.status]?.label ?? st.status}</Badge>{st.projectedMonthlyUsd > 0 && <span className="text-xs text-slate-500">{usd(st.projectedMonthlyUsd)}/month</span>}</div>}
                    </div>
                    {st?.advice && <div className="text-xs text-slate-600">{st.advice}</div>}
                    {canEdit ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-slate-500">Plan
                          <Select value={p.phase} onChange={(e) => set(p.key, { phase: e.target.value as Phase })}>
                            {groups.map((g) => <option key={g} value={g}>{PHASE_LABEL[g]}</option>)}
                          </Select>
                        </label>
                        <label className="text-xs text-slate-500">Move to own GPUs when the API costs more than (USD / month)
                          <Input type="number" min={0} value={p.moveWhenMonthlyUsdOver ?? ""} disabled={p.phase !== "API_THEN_RUNPOD"}
                            onChange={(e) => set(p.key, { moveWhenMonthlyUsdOver: e.target.value === "" ? null : Number(e.target.value) })} />
                        </label>
                        <label className="text-xs text-slate-500">Use now<Input value={p.start} onChange={(e) => set(p.key, { start: e.target.value })} /></label>
                        <label className="text-xs text-slate-500">Own-GPU setup<Input value={p.later} onChange={(e) => set(p.key, { later: e.target.value })} /></label>
                        <label className="text-xs text-slate-500">GPU<Input value={p.gpu} onChange={(e) => set(p.key, { gpu: e.target.value })} /></label>
                        <label className="text-xs text-slate-500 sm:col-span-2">Notes<Textarea rows={2} value={p.notes} onChange={(e) => set(p.key, { notes: e.target.value })} /></label>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div><b>Now:</b> {p.start}</div>
                        {p.later && p.later !== "Same" && <div><b>Own GPUs:</b> {p.later} ({p.gpu})</div>}
                        {p.moveWhenMonthlyUsdOver != null && <div><b>Move when the API passes:</b> {usd(p.moveWhenMonthlyUsdOver)}/month</div>}
                        {p.notes && <div className="text-slate-500">{p.notes}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {canEdit && (
        <div className="flex gap-2">
          <Button loading={saving} onClick={save}>Save plan</Button>
          <Button variant="secondary" onClick={reset}>Reset to default</Button>
        </div>
      )}
    </div>
  );
}
