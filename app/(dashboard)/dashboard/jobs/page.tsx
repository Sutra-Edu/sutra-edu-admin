"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import api, { errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Button, Card, EmptyState, PageHeader, Select, Spinner, StatusBadge, Table, Td, fmtDate } from "@/components/ui";

interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
  bookFile: { id: string; version: number; book: { id: string; code: string; title: string } } | null;
  page: { id: string; pageNumber: number } | null;
}
interface JobStat { type: string; status: string; count: number }

const STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "DEAD", "CANCELLED"];

export default function JobsPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const qs = new URLSearchParams({ take: "100", ...(status && { status }), ...(type && { type }) }).toString();
  const jobs = useApi<Job[]>(`/admin/jobs?${qs}`, []);
  const stats = useApi<JobStat[]>("/admin/jobs/stats", []);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // Refresh while work is in flight
  const active = stats.data.some((s) => (s.status === "RUNNING" || s.status === "QUEUED") && s.count > 0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { jobs.reload(); stats.reload(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, qs]);

  const total = (s: string) => stats.data.filter((x) => x.status === s).reduce((n, x) => n + x.count, 0);
  const act = async (job: Job, what: "retry" | "cancel") => {
    try {
      await api.post(`/admin/jobs/${job.id}/${what}`);
      setNotice({ kind: "success", text: what === "retry" ? "Job queued again" : "Job cancelled" });
      jobs.reload();
      stats.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="Processing jobs" description="Each uploaded PDF is split into pages, then every page is extracted. Failed jobs retry automatically; dead ones ran out of retries."
        actions={<Button variant="secondary" onClick={() => { jobs.reload(); stats.reload(); }}><RefreshCw className="w-4 h-4" /> Refresh</Button>} />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)}
            className={`text-left bg-white border rounded-xl p-4 shadow-sm transition ${status === s ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
            <div className="text-xs text-slate-500 capitalize">{s.toLowerCase()}</div>
            <div className="text-2xl font-bold mt-1">{total(s)}</div>
          </button>
        ))}
      </div>

      <Card title="Jobs" actions={
        <Select className="w-48" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {["SPLIT_BOOK_FILE", "PROCESS_PAGE", "CHUNK_BOOK_FILE", "EMBED_CHUNKS", "SUGGEST_MAPPINGS"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}
        </Select>
      }>
        {notice && <div className="mb-4"><Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert></div>}
        {jobs.error && <Alert>{jobs.error}</Alert>}
        {jobs.loading && !jobs.data.length ? <Spinner /> : jobs.data.length === 0 ? <EmptyState title="No jobs" description="Jobs appear here once a book is uploaded." /> : (
          <Table head={["Job", "Book", "Status", "Attempts", "Created", ""]}>
            {jobs.data.map((j) => (
              <tr key={j.id}>
                <Td>
                  <div className="font-medium capitalize">{j.type.replace(/_/g, " ").toLowerCase()}</div>
                  {j.page && <div className="text-xs text-slate-500">Page {j.page.pageNumber}</div>}
                </Td>
                <Td>
                  {j.bookFile ? (
                    <Link href={`/dashboard/books/${j.bookFile.book.id}`} className="text-indigo-600 hover:underline">{j.bookFile.book.title} <span className="text-slate-400">v{j.bookFile.version}</span></Link>
                  ) : "—"}
                </Td>
                <Td>
                  <StatusBadge status={j.status} />
                  {j.lastError && <div className="text-xs text-red-600 mt-1 max-w-sm break-words line-clamp-3" title={j.lastError}>{j.lastError}</div>}
                </Td>
                <Td>{j.attempts}/{j.maxAttempts}</Td>
                <Td className="text-slate-500 whitespace-nowrap">{fmtDate(j.createdAt)}</Td>
                <Td className="text-right whitespace-nowrap">
                  {can(P.MANAGE_JOBS) && <>
                    {["FAILED", "DEAD", "CANCELLED"].includes(j.status) && <Button size="sm" variant="ghost" onClick={() => act(j, "retry")}>Retry</Button>}
                    {["QUEUED", "FAILED"].includes(j.status) && <Button size="sm" variant="ghost" onClick={() => act(j, "cancel")}>Cancel</Button>}
                  </>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
