"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Cloud, Library, ListChecks, Upload } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { Card, PageHeader, StatusBadge, fullName } from "@/components/ui";
import type { BookSummary, Offering } from "@/lib/types";

interface StorageStatus { configured: boolean; reachable: boolean; bucket: string; error?: string }
interface JobStat { type: string; status: string; count: number }

export default function DashboardHome() {
  const { user, can } = useAuth();
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [jobs, setJobs] = useState<JobStat[] | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    if (can(P.VIEW_BOOKS)) api.get("/admin/books?take=200&includeArchived=true").then((r) => setBooks(r.data)).catch(() => setBooks([]));
    if (can(P.VIEW_CURRICULUM)) api.get("/admin/offerings").then((r) => setOfferings(r.data)).catch(() => setOfferings([]));
    if (can(P.VIEW_JOBS)) api.get("/admin/jobs/stats").then((r) => setJobs(r.data)).catch(() => setJobs([]));
    if (can(P.MANAGE_SYSTEM_SETTINGS)) api.get("/admin/storage/status").then((r) => setStorage(r.data)).catch(() => setStorage(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jobCount = (status: string) => (jobs ?? []).filter((j) => j.status === status).reduce((n, j) => n + j.count, 0);
  const booksWithFiles = (books ?? []).filter((b) => b.files?.length).length;

  const steps = [
    { done: !!storage?.reachable, label: "Connect cloud storage (R2 bucket)", href: "/dashboard/storage", show: can(P.MANAGE_SYSTEM_SETTINGS) },
    { done: (offerings?.length ?? 0) > 0, label: "Set up syllabi (board + class + subject)", href: "/dashboard/curriculum", show: can(P.VIEW_CURRICULUM) },
    { done: booksWithFiles > 0, label: "Upload your first book", href: "/dashboard/books/upload", show: can(P.UPLOAD_BOOKS) },
  ].filter((s) => s.show);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.firstName || fullName(user ?? {})}`}
        description="Upload books into a syllabus, track their processing, and manage who can do what."
        actions={can(P.UPLOAD_BOOKS) && (
          <Link href="/dashboard/books/upload" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Upload className="w-4 h-4" /> Upload a book
          </Link>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {can(P.VIEW_BOOKS) && <Stat icon={Library} label="Books" value={books?.length} sub={`${booksWithFiles} with a PDF`} href="/dashboard/books" />}
        {can(P.VIEW_CURRICULUM) && <Stat icon={BookOpen} label="Syllabi" value={offerings?.length} sub="board + class + subject" href="/dashboard/curriculum" />}
        {can(P.VIEW_JOBS) && (
          <Stat icon={ListChecks} label="Jobs running / queued" value={jobs ? jobCount("RUNNING") + jobCount("QUEUED") : undefined}
            sub={jobs ? `${jobCount("FAILED") + jobCount("DEAD")} failed` : ""} href="/dashboard/jobs" />
        )}
        {can(P.MANAGE_SYSTEM_SETTINGS) && (
          <Link href="/dashboard/storage" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition">
            <div className="flex items-center gap-2 text-sm text-slate-500"><Cloud className="w-4 h-4" /> Cloud storage</div>
            <div className="mt-3">
              {storage === null ? <span className="text-slate-400 text-sm">Checking…</span>
                : storage.reachable ? <StatusBadge status="READY" />
                : <span className="text-sm font-medium text-amber-700">{storage.configured ? "Not reachable" : "Not configured"}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-2 truncate">Bucket: {storage?.bucket ?? "—"}</div>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {steps.length > 0 && (
          <Card title="Getting started" className="lg:col-span-1">
            <ul className="space-y-3">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-3 text-sm group">
                    {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
                    <span className={s.done ? "text-slate-500 line-through" : "text-slate-800 group-hover:text-indigo-600"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {can(P.VIEW_BOOKS) && (
          <Card title="Recently updated books" className="lg:col-span-2"
            actions={<Link href="/dashboard/books" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">All books <ArrowRight className="w-3.5 h-3.5" /></Link>}>
            {!books ? <p className="text-sm text-slate-400">Loading…</p> : books.length === 0 ? (
              <p className="text-sm text-slate-500">No books yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 -my-2">
                {books.slice(0, 6).map((b) => (
                  <li key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                    <Link href={`/dashboard/books/${b.id}`} className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate hover:text-indigo-600">{b.title}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {b.boards.map((x) => x.board.code).join(", ")} · {b.classes.map((x) => x.class.name).join(", ")} · {b.subject.name}
                      </div>
                    </Link>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, sub, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; sub?: string; href: string }) {
  return (
    <Link href={href} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition">
      <div className="flex items-center gap-2 text-sm text-slate-500"><Icon className="w-4 h-4" /> {label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-2">{value ?? "…"}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </Link>
  );
}
