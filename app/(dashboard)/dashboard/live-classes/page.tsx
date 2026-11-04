"use client";

import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/lib/hooks";
import { P } from "@/lib/permissions";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { ResourceEditor } from "@/components/resource-editor";

type Any = Record<string, unknown> & { id: string };

export default function LiveClassesPage() {
  const { can } = useAuth();
  const catalog = useCatalog();
  return (
    <>
      <PageHeader title="Live classes" description='"Live sessions" on the home screen. Students set reminders (notified 10 minutes before) and join from the waiting room; the join link stays hidden until then.' />
      <ResourceEditor<Any>
        title="Upcoming and recent" listPath="/admin/live-classes" createPath="/admin/live-classes" updatePath={(r) => `/admin/live-classes/${r.id}`}
        canEdit={can(P.MANAGE_CONTENT_SETTINGS)} defaults={{ durationMin: 60, waitingRoomMinutes: 15, status: "SCHEDULED" }}
        fields={[
          { key: "title", label: "Title", type: "text", required: true, placeholder: "Chemistry: Organic compounds" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "teacherName", label: "Teacher", type: "text", required: true },
          { key: "teacherImageUrl", label: "Teacher photo URL", type: "text" },
          { key: "startsAt", label: "Starts at", type: "datetime", required: true },
          { key: "durationMin", label: "Duration (minutes)", type: "number" },
          { key: "joinUrl", label: "Join link", type: "text", hint: "Zoom, Google Meet, YouTube Live…" },
          { key: "waitingRoomMinutes", label: "Waiting room opens (minutes before)", type: "number" },
          { key: "boardIds", label: "Only these boards", type: "multiselect", options: catalog.boards.map((b) => ({ value: b.id, label: b.name })) },
          { key: "classIds", label: "Only these classes", type: "multiselect", options: catalog.classes.map((c) => ({ value: c.id, label: c.name })) },
          { key: "offeringId", label: "Syllabus (offering) id", type: "text" },
          { key: "topicId", label: "Topic id", type: "text" },
          { key: "isPremium", label: "Paid plans only", type: "checkbox" },
          { key: "status", label: "Status", type: "select", options: ["SCHEDULED", "LIVE", "ENDED", "CANCELLED"].map((s) => ({ value: s, label: s.toLowerCase() })) },
          { key: "recordingUrl", label: "Recording URL (after it ends)", type: "text" },
        ]}
        columns={[
          { label: "Class", render: (r) => <><div className="font-medium">{String(r.title)}</div><div className="text-xs text-slate-500">with {String(r.teacherName)}</div></> },
          { label: "When", render: (r) => <span className="text-xs">{new Date(String(r.startsAt)).toLocaleString()} · {String(r.durationMin)} min</span> },
          { label: "Reminders", render: (r) => String((r._count as { reminders: number }).reminders) },
          { label: "", render: (r) => <>{r.isPremium ? <Badge color="amber">premium</Badge> : null} <StatusBadge status={String(r.status)} /></> },
        ]}
      />
    </>
  );
}
