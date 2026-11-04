"use client";

import { use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, StatusBadge, Table, Td, fmtDate } from "@/components/ui";

interface Profile {
  profile: {
    summary: string;
    preferences: { pace?: string; prefers?: string[]; languageMix?: string };
    strengths: { title: string; mastery: number }[];
    weaknesses: { title: string; mastery: number }[];
    misconceptions: { text: string; count: number }[];
    sessionsSummarized: number;
  };
  notes: { id: string; kind: string; content: string; createdAt: string; topic: { title: string } | null }[];
}
interface Points {
  summary?: { balance?: number; level?: number; currentStreak?: number; bestStreak?: number; lifetimePoints?: number };
  badges?: unknown[];
}
interface Sub { id: string; status: string; provider: string; currentPeriodEnd: string | null; plan: { name: string } }

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const profile = useApi<Profile | null>(`/admin/students/${id}/learning-profile`, null);
  const points = useApi<Points | null>(can(P.VIEW_GAMIFICATION) ? `/admin/gamification/students/${id}` : null, null);
  const subs = useApi<Sub[]>(can(P.VIEW_SUBSCRIPTIONS) ? `/admin/billing/subscriptions?userId=${id}` : null, []);
  const p = profile.data?.profile;

  return (
    <>
      <PageHeader title="Student" description={`Id ${id} (use it to give a plan or adjust points)`} />
      {profile.error && <Alert>{profile.error}</Alert>}
      {!p ? <Spinner /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="How this student learns" actions={<Badge>{p.sessionsSummarized} lessons summarised</Badge>}>
            <div className="space-y-3 text-sm">
              <p className="text-slate-800">{p.summary || "Nothing yet: the AI writes this after the student's first lessons."}</p>
              <div className="flex flex-wrap gap-2">
                {p.preferences.pace && <Badge color="blue">pace: {p.preferences.pace}</Badge>}
                {p.preferences.prefers?.map((x) => <Badge key={x} color="purple">likes {x}</Badge>)}
                {p.preferences.languageMix && <Badge>{p.preferences.languageMix}</Badge>}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Strong</div>
                {p.strengths.length ? p.strengths.map((s) => <div key={s.title}>{s.title} <span className="text-slate-500">{Math.round(s.mastery * 100)}%</span></div>) : "—"}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Needs work</div>
                {p.weaknesses.length ? p.weaknesses.map((s) => <div key={s.title}>{s.title} <span className="text-slate-500">{Math.round(s.mastery * 100)}%</span></div>) : "—"}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Mistakes that keep coming back</div>
                {p.misconceptions.length ? p.misconceptions.map((m) => <div key={m.text}>{m.text} <span className="text-slate-500">×{m.count}</span></div>) : "—"}
              </div>
            </div>
          </Card>
          <div className="space-y-6">
            {points.data?.summary && (
              <Card title="Points">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <Stat label="balance" value={points.data.summary.balance} />
                  <Stat label="level" value={points.data.summary.level} />
                  <Stat label="streak" value={points.data.summary.currentStreak} />
                  <Stat label="badges" value={points.data.badges?.length} />
                </div>
              </Card>
            )}
            {can(P.VIEW_SUBSCRIPTIONS) && (
              <Card title="Plan">
                {!subs.data.length ? <EmptyState title="No plan" /> : (
                  <Table head={["Plan", "Status", "Until", "Via"]}>
                    {subs.data.map((s) => (
                      <tr key={s.id}><Td>{s.plan.name}</Td><Td><StatusBadge status={s.status} /></Td><Td className="text-xs">{fmtDate(s.currentPeriodEnd)}</Td><Td className="text-xs">{s.provider}</Td></tr>
                    ))}
                  </Table>
                )}
              </Card>
            )}
          </div>
          <Card title="Lesson notes" className="xl:col-span-2">
            {!profile.data?.notes.length ? <EmptyState title="No notes yet" /> : (
              <Table head={["When", "Topic", "Note"]}>
                {profile.data.notes.map((n) => (
                  <tr key={n.id}><Td className="text-xs">{fmtDate(n.createdAt)}</Td><Td>{n.topic?.title ?? "—"}</Td><Td><Badge>{n.kind.replace("_", " ")}</Badge> {n.content}</Td></tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

const Stat = ({ label, value }: { label: string; value?: number }) => (
  <div><div className="text-2xl font-semibold text-slate-900">{value ?? 0}</div><div className="text-xs text-slate-500">{label}</div></div>
);
