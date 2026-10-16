"use client";

import { AudioLines, Clapperboard, FileText, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import type { GeneratedKind } from "@/lib/types";

export const KIND_META: Record<GeneratedKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  TEXT: { label: "Text", icon: FileText },
  AUDIO: { label: "Audio", icon: AudioLines },
  IMAGE: { label: "Image", icon: ImageIcon },
  VIDEO: { label: "Video", icon: Clapperboard },
};

export function ReviewBadge({ status }: { status: string }) {
  if (status === "APPROVED") return <Badge color="green">approved</Badge>;
  if (status === "REJECTED") return <Badge color="red">rejected</Badge>;
  return <Badge color="amber">needs review</Badge>;
}

export function stepLabel(p: { step: string; done?: number; total?: number }) {
  const labels: Record<string, string> = {
    starting: "Starting", reading_book: "Reading the book", writing: "Writing", writing_script: "Writing the script",
    speaking: "Recording narration", planning_image: "Planning the image", drawing: "Drawing", storyboard: "Writing the storyboard",
    scenes: "Making scenes", assembling_video: "Assembling the video", done: "Done",
  };
  const base = labels[p.step] ?? p.step;
  return p.total ? `${base} ${(p.done ?? 0) + 1}/${p.total}` : base;
}
