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

export type GeneratedKind = "TEXT" | "AUDIO" | "IMAGE" | "VIDEO";
export type GenerationStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface GeneratedAsset {
  id: string;
  kind: GeneratedKind;
  role: string;
  sceneIndex: number | null;
  r2Key: string;
  mimeType: string;
  sizeBytes: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  text: string | null;
  metadata: Record<string, unknown> | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  url: string;
}

export interface Generation {
  id: string;
  kind: GeneratedKind;
  purpose: string;
  pageFrom: number;
  pageTo: number;
  language: string;
  instructions: string | null;
  status: GenerationStatus;
  error: string | null;
  progress: { step: string; done?: number; total?: number } | null;
  createdAt: string;
  finishedAt: string | null;
  book: { id: string; code: string; title: string };
  bookFile: { id: string; version: number };
  requestedBy: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  assets?: GeneratedAsset[];
  _count?: { assets: number };
}

export interface GenerationOptions {
  maxPages: number;
  languages: string[];
  kinds: { kind: GeneratedKind; purposes: { value: string; label: string }[]; models: { task: string; active: boolean }[]; ready: boolean }[];
}

export interface ModelConfig {
  id: string;
  task: string;
  name: string;
  provider: string;
  endpointUrl: string;
  modelName: string | null;
  params: Record<string, unknown> | null;
  isActive: boolean;
  timeoutMs: number;
  updatedAt: string;
}
