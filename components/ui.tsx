"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- Layout ----------

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: string; actions?: React.ReactNode }) {
  return (
    <section className={cx("bg-white border border-slate-200 rounded-2xl shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// ---------- Controls ----------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "primary", loading, className, children, size = "md", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-60 disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        BUTTON[variant],
        className,
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

const FIELD = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100";

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, props.className)} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(FIELD, props.className)}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(FIELD, props.className)} />;
}

export function Checkbox({ label, description, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className={cx("flex items-start gap-2.5", props.disabled ? "opacity-60" : "cursor-pointer")}>
      <input type="checkbox" {...props} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
      <span>
        <span className="block text-sm text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

// ---------- Feedback ----------

const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", BADGE[color])}>{children}</span>;
}

const STATUS_COLOR: Record<string, keyof typeof BADGE> = {
  READY: "green", ACTIVE: "green", SUCCEEDED: "green", APPROVED: "green", EXTRACTED: "green", IN_USE: "green",
  PROCESSING: "blue", SPLITTING: "blue", UPLOADED: "blue", RUNNING: "blue", QUEUED: "blue", SCHEDULED: "blue", PENDING: "blue",
  DRAFT: "gray", PENDING_UPLOAD: "amber", NEEDS_REVIEW: "amber", SUSPENDED: "amber", INACTIVE: "gray", ENDED: "gray", SUPERSEDED: "gray", CANCELLED: "gray",
  FAILED: "red", DEAD: "red", ARCHIVED: "gray", DEACTIVATED: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLOR[status] ?? "gray"}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function Alert({ kind = "error", children, onClose }: { kind?: "error" | "success" | "info"; children: React.ReactNode; onClose?: () => void }) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-indigo-50 border-indigo-200 text-indigo-800",
  }[kind];
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", styles)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 break-words">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ---------- Overlays ----------

export function Modal({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cx("relative bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Tables ----------

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="px-5 py-2.5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cx("px-5 py-3 align-top", className)}>{children}</td>
);

// ---------- Formatting ----------

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
export const fmtBytes = (n?: number | null) => {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
};
export const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.phone || "—";

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];
