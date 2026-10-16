"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi, useCatalog } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Alert, Card, Checkbox, EmptyState, Input, PageHeader, Select, Spinner, StatusBadge, Table, Td, fmtDate } from "@/components/ui";
import type { BookSummary } from "@/lib/types";

export default function BooksPage() {
  const { can } = useAuth();
  const { boards, classes, subjects } = useCatalog(true);
  const [filters, setFilters] = useState({ boardId: "", classId: "", subjectId: "", status: "", q: "", includeArchived: false });
  const [search, setSearch] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ take: "200" });
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    return `/admin/books?${p}`;
  }, [filters]);
  const { data: books, loading, error } = useApi<BookSummary[]>(query, []);

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Books"
        description="Every book with its syllabus tags and latest uploaded version. Open a book to see its versions, processing status and where it's used."
        actions={can(P.UPLOAD_BOOKS) && (
          <Link href="/dashboard/books/upload" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Upload className="w-4 h-4" /> Upload book
          </Link>
        )}
      />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end" onSubmit={(e) => { e.preventDefault(); setFilters((f) => ({ ...f, q: search.trim() })); }}>
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search title, press Enter" value={search} onChange={(e) => setSearch(e.target.value)}
              onBlur={() => setFilters((f) => ({ ...f, q: search.trim() }))} />
          </div>
          <Select value={filters.boardId} onChange={set("boardId")}>
            <option value="">All boards</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select value={filters.classId} onChange={set("classId")}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.subjectId} onChange={set("subjectId")}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={filters.status} onChange={set("status")}>
            <option value="">Any status</option>
            {["DRAFT", "PROCESSING", "READY", "FAILED", "ARCHIVED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </Select>
          <div className="lg:col-span-6">
            <Checkbox label="Include archived books" checked={filters.includeArchived}
              onChange={(e) => setFilters((f) => ({ ...f, includeArchived: e.target.checked }))} />
          </div>
        </form>
      </Card>

      <Card>
        {error && <Alert>{error}</Alert>}
        {loading ? <Spinner /> : books.length === 0 ? (
          <EmptyState title="No books found" description="Upload a book or change the filters."
            action={can(P.UPLOAD_BOOKS) && <Link href="/dashboard/books/upload" className="text-sm font-medium text-indigo-600 hover:underline">Upload a book</Link>} />
        ) : (
          <Table head={["Book", "Syllabus", "Language", "Latest version", "Status", "Updated"]}>
            {books.map((b) => {
              const latest = b.files?.[0];
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/dashboard/books/${b.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{b.title}</Link>
                    <div className="text-xs text-slate-500 font-mono">{b.code}</div>
                    {(b.publisher || b.edition) && <div className="text-xs text-slate-500">{[b.publisher, b.edition].filter(Boolean).join(" · ")}</div>}
                  </Td>
                  <Td>
                    <div className="text-slate-800">{b.subject.name}</div>
                    <div className="text-xs text-slate-500">{b.boards.map((x) => x.board.code).join(", ")} · {b.classes.map((x) => x.class.name).join(", ")}</div>
                  </Td>
                  <Td>{b.language}</Td>
                  <Td>
                    {latest ? (
                      <div className="space-y-1">
                        <div>v{latest.version}{latest.label ? ` · ${latest.label}` : ""}{latest.pageCount ? ` · ${latest.pageCount} pages` : ""}</div>
                        <StatusBadge status={latest.status} />
                      </div>
                    ) : <span className="text-slate-400">No PDF yet</span>}
                  </Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td className="text-slate-500 whitespace-nowrap">{fmtDate(b.updatedAt)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
