// Mirrors AppPermission in sutra-edu-backend/src/rbac/permissions.enum.ts
export const P = {
  VIEW_CURRICULUM: "view:curriculum",
  MANAGE_CURRICULUM: "manage:curriculum",
  VIEW_BOOKS: "view:books",
  MANAGE_BOOKS: "manage:books",
  UPLOAD_BOOKS: "upload:books",
  REVIEW_PAGES: "review:pages",
  VIEW_JOBS: "view:jobs",
  MANAGE_JOBS: "manage:jobs",
  VIEW_MODEL_CONFIGS: "view:model_configs",
  MANAGE_MODEL_CONFIGS: "manage:model_configs",
  VIEW_STUDENTS: "view:students",
  MANAGE_ADMIN_ACCOUNTS: "manage:admin_accounts",
  MANAGE_ROLES: "manage:roles",
  VIEW_AUDIT_LOGS: "view:audit_logs",
  MANAGE_SYSTEM_SETTINGS: "manage:system_settings",
} as const;

export type Permission = (typeof P)[keyof typeof P];

// Groups for the permission checklists on the roles / admins pages
export const PERMISSION_GROUPS: { title: string; prefix: string[] }[] = [
  { title: "Curriculum", prefix: ["view:curriculum", "manage:curriculum"] },
  { title: "Books", prefix: ["view:books", "manage:books", "upload:books", "review:pages"] },
  { title: "Processing", prefix: ["view:jobs", "manage:jobs", "view:model_configs", "manage:model_configs"] },
  { title: "Students", prefix: ["view:students"] },
  { title: "Administration", prefix: ["manage:admin_accounts", "manage:roles", "view:audit_logs", "manage:system_settings"] },
];

/** Every permission in `required` (super admins hold "*") */
export const hasAll = (granted: string[], required: string[]) =>
  granted.includes("*") || required.every((p) => granted.includes(p));

export const hasAny = (granted: string[], required: string[]) =>
  required.length === 0 || granted.includes("*") || required.some((p) => granted.includes(p));
