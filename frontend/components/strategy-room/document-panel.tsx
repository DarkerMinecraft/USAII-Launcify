"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadDocument, deleteDocument } from "@/actions/advisor";
import type { AdvisorDocument } from "@/lib/types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface DocumentPanelProps {
  sessionId: string;
  documents: AdvisorDocument[];
  onUpload: (doc: AdvisorDocument) => void;
  onDelete: (docId: string) => void;
}

export const DocumentPanel = ({
  sessionId,
  documents,
  onUpload,
  onDelete,
}: DocumentPanelProps) => {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    // Also check by extension for .md which browsers may not report as text/markdown
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && ext !== "md") {
      toast.error("Only PDF, .txt, and .md files are supported");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const doc = await uploadDocument(sessionId, formData);
      onUpload(doc);
      toast.success(`${file.name} uploaded (${doc.chunkCount} chunks)`);
    } catch {
      toast.error("Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await deleteDocument(sessionId, docId);
      onDelete(docId);
    } catch {
      toast.error("Could not delete — try again");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload document"
        className={[
          "border border-dashed rounded-[10px] px-3 py-5 flex flex-col items-center gap-2 cursor-pointer transition-colors",
          dragOver
            ? "border-border/60 bg-surface-2"
            : "border-border hover:border-border/70 hover:bg-surface-2",
          uploading ? "pointer-events-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 text-text-faint animate-spin" />
        ) : (
          <Upload className="w-5 h-5 text-text-faint" />
        )}
        <p className="text-[11.5px] text-text-faint text-center leading-relaxed">
          {uploading ? "Uploading…" : "Drop PDF or text file\nor click to browse"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {documents.length === 0 && !uploading && (
          <p className="text-[11px] text-text-faint text-center py-2">No documents yet</p>
        )}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 bg-surface-2 rounded-[8px] px-2.5 py-2 border border-border"
          >
            <FileText className="w-3.5 h-3.5 text-text-faint shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] text-foreground truncate leading-snug">{doc.filename}</p>
              <p className="text-[10px] text-text-faint mt-0.5">
                {formatDate(doc.uploadedAt)} &middot; {doc.chunkCount} chunks
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-text-faint hover:text-foreground shrink-0"
              disabled={deletingId === doc.id}
              onClick={() => void handleDelete(doc.id)}
              aria-label={`Delete ${doc.filename}`}
            >
              {deletingId === doc.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {documents.length > 0 && (
        <p className="text-[10.5px] text-text-faint shrink-0">
          Docs are searched on each message you send.
        </p>
      )}
    </div>
  );
};
