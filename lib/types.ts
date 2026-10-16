export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; description?: string | null } | null;
  permissions: string[];
  customPermissions?: { id: string; action: string }[];
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Offering {
  id: string;
  boardId: string;
  classId: string;
  subjectId: string;
  requiresBookSelection: boolean;
  isActive: boolean;
  board: CatalogItem;
  class: CatalogItem;
  subject: CatalogItem;
  _count?: { chapters: number };
}

export type BookStatus = "DRAFT" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
export type FileStatus = "PENDING_UPLOAD" | "UPLOADED" | "SPLITTING" | "PROCESSING" | "READY" | "FAILED" | "SUPERSEDED";

export interface BookFile {
  id: string;
  version: number;
  isCurrent: boolean;
  r2Key: string;
  label: string | null;
  originalFilename: string;
  sizeBytes: number | null;
  pageCount: number | null;
  status: FileStatus;
  error: string | null;
  createdAt: string;
  pageStatus?: Record<string, number>;
}

export interface BookSummary {
  id: string;
  code: string;
  title: string;
  language: string;
  publisher: string | null;
  edition: string | null;
  author?: string | null;
  isbn?: string | null;
  status: BookStatus;
  contentRelation: "SAME_SYLLABUS_VARIATION" | "DIFFERENT_CONTENT";
  updatedAt: string;
  subject: { id: string; name: string; code?: string };
  boards: { board: { id: string; code: string; name: string } }[];
  classes: { class: { id: string; code: string; name: string } }[];
  files: BookFile[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  forUserType: string;
  permissions: { id: string; action: string; description: string | null }[];
  _count: { users: number };
}

export interface PermissionRow {
  id: string;
  action: string;
  description: string | null;
}
