"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BookOpen, Cloud, GraduationCap, KeyRound, LayoutDashboard, Library, ListChecks, LogOut, Menu,
  ShieldCheck, ShieldOff, Upload, UserCog, Users, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasAny, P } from "@/lib/permissions";
import { Spinner, fullName } from "@/components/ui";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // Any of these grants the page (null = every admin)
  permission: string[] | null;
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: null }],
  },
  {
    title: "Content",
    items: [
      { name: "Upload Book", href: "/dashboard/books/upload", icon: Upload, permission: [P.UPLOAD_BOOKS] },
      { name: "Books", href: "/dashboard/books", icon: Library, permission: [P.VIEW_BOOKS] },
      { name: "Curriculum", href: "/dashboard/curriculum", icon: BookOpen, permission: [P.VIEW_CURRICULUM] },
      { name: "Processing Jobs", href: "/dashboard/jobs", icon: ListChecks, permission: [P.VIEW_JOBS] },
    ],
  },
  {
    title: "People",
    items: [
      { name: "Students & Parents", href: "/dashboard/students", icon: GraduationCap, permission: [P.VIEW_STUDENTS] },
      { name: "Admin Staff", href: "/dashboard/admins", icon: Users, permission: [P.MANAGE_ADMIN_ACCOUNTS] },
      { name: "Roles & Permissions", href: "/dashboard/roles", icon: KeyRound, permission: [P.MANAGE_ROLES] },
    ],
  },
  {
    title: "System",
    items: [
      { name: "Cloud Storage", href: "/dashboard/storage", icon: Cloud, permission: [P.MANAGE_SYSTEM_SETTINGS] },
      { name: "Audit Log", href: "/dashboard/audit-logs", icon: Activity, permission: [P.VIEW_AUDIT_LOGS] },
      { name: "My Profile", href: "/dashboard/profile", icon: UserCog, permission: null },
    ],
  },
];

// Longest href first so /dashboard/books/upload isn't matched by /dashboard/books
const ALL_ITEMS = NAV.flatMap((g) => g.items).sort((a, b) => b.href.length - a.href.length);

function requiredFor(pathname: string) {
  // /dashboard itself matches every page, so only a more specific item decides access
  const item = ALL_ITEMS.find((i) => i.href !== "/dashboard" && (pathname === i.href || pathname.startsWith(i.href + "/")));
  return item?.permission ?? null;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, permissions, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading && !user) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Starting Sutra Admin…" /></div>;
  if (!user) return null;

  // Sidebar hiding is cosmetic; this blocks a page reached by direct URL without the permission (the API enforces it anyway)
  const required = requiredFor(pathname);
  const allowed = !required || hasAny(permissions, required);
  const activeHref = ALL_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.href;
  const isActive = (href: string) => href === activeHref;

  const sidebar = (
    <aside className="w-68 bg-slate-900 text-white flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg">S</div>
          <div>
            <div className="font-bold tracking-wide leading-none">SUTRA EDU</div>
            <div className="text-[10px] text-indigo-300 font-semibold tracking-[0.2em] mt-1 uppercase">Admin Portal</div>
          </div>
        </Link>
        <button className="lg:hidden p-1.5 text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || hasAny(permissions, i.permission));
          if (!items.length) return null;
          return (
            <div key={group.title}>
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{group.title}</div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <item.icon className={`w-4.5 h-4.5 ${active ? "text-white" : "text-slate-500"}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-indigo-900 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold uppercase">
            {fullName(user)[0]}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{fullName(user)}</div>
            <div className="text-[11px] text-indigo-300 font-medium flex items-center gap-1">
              {user.isSuperAdmin ? <><ShieldCheck className="w-3 h-3" /> Super admin</> : user.role?.name ?? "No role"}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-300 hover:bg-red-500/15 hover:text-red-300 transition"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:flex shrink-0">{sidebar}</div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="relative">{sidebar}</div>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold">Sutra Edu Admin</span>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {allowed ? children : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                <ShieldOff className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold">Access denied</h2>
              <p className="text-sm text-slate-500 max-w-sm">
                You don&apos;t have the permission this page needs ({required?.join(" or ")}). Ask an admin who manages roles to grant it.
              </p>
              <Link href="/dashboard" className="mt-2 text-sm font-medium text-indigo-600 hover:underline">Back to dashboard</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
