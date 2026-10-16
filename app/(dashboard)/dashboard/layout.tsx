import { DashboardShell } from "@/components/dashboard-shell";

// Every admin page loads its data in the browser after the session is checked, so navigations are allowed to block
// (opts these routes out of Next's dev-only instant-navigation validation; `instant` can't live in a Client Component)
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
