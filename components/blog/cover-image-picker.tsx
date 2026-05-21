"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/locales/client";

/** 1 Mo, base 1024 — spec §B.2.2. */
const MAX_FILE_SIZE_BYTES = 1_048_576;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export type CoverImagePickerProps = {
  /** Current `Post.coverImage` URL (controlled value). Empty string means "no cover". */
  value: string;
  onChange: (next: string) => void;
  /** Disable user interaction (e.g. while the parent form is submitting). */
  disabled?: boolean;
  /**
   * When true, the picker reports its own upload state to the parent so the
   * submit button can be disabled during upload (spec §B.5.2).
   */
  onUploadingChange?: (uploading: boolean) => void;
  /** Optional Post id (passed to the upload route in edit mode). */
  postId?: string;
};

// The route handler returns `{ success: true, data: { url } }` (cf.
// `app/api/upload/post-cover/route.ts`). Keep the client matching the API
// shape rather than changing the API contract.
type UploadResponse =
  | { success: true; data: { url: string } }
  | { success: false; error: string };

/**
 * Cover-image picker with two tabs (Upload | External URL).
 *
 * - Upload: validates file size & MIME client-side, POSTs to
 *   `/api/upload/post-cover`, then propagates the returned URL via onChange.
 * - URL: keeps the previous behaviour (free-form URL input) so existing posts
 *   pointing to remote images keep working (spec §B.2.6).
 */
export function CoverImagePicker({
  value,
  onChange,
  disabled = false,
  onUploadingChange,
  postId,
}: CoverImagePickerProps) {
  const t = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Notify parent so it can disable submit (spec §B.5.2 race condition).
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  // Revoke object URLs to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const resetFileSelection = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      resetFileSelection();
      return;
    }
    // Client-side validation BEFORE upload (spec §B.5.1).
    if (!isAllowedMime(file.type)) {
      toast.error(t("upload.errors.invalidFormat"));
      resetFileSelection();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t("upload.errors.tooLarge"));
      resetFileSelection();
      return;
    }
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setSelectedFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (postId) formData.append("postId", postId);

      const res = await fetch("/api/upload/post-cover", {
        method: "POST",
        body: formData,
      });

      // Try to parse JSON either way — server returns structured errors.
      let payload: UploadResponse | null = null;
      try {
        payload = (await res.json()) as UploadResponse;
      } catch {
        payload = null;
      }

      if (!res.ok || !payload || !payload.success) {
        // Map well-known status codes to scoped messages (spec §B.5.2).
        if (res.status === 401 || res.status === 403) {
          toast.error(t("upload.errors.unauthorized"));
        } else if (res.status === 413) {
          toast.error(t("upload.errors.tooLarge"));
        } else if (res.status === 415 || res.status === 400) {
          toast.error(t("upload.errors.invalidFormat"));
        } else {
          toast.error(
            (payload && !payload.success && payload.error) ||
              t("upload.errors.network"),
          );
        }
        return;
      }

      onChange(payload.data.url);
      resetFileSelection();
      toast.success(t("upload.success"));
    } catch {
      toast.error(t("upload.errors.network"));
    } finally {
      setIsUploading(false);
    }
  };

  const hasCurrentValue = value.trim().length > 0;

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "url")}>
        <TabsList>
          <TabsTrigger value="upload" disabled={disabled || isUploading}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {t("upload.tabs.upload")}
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled || isUploading}>
            {t("upload.tabs.url")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3">
          <div
            className={cn(
              "rounded-lg border border-dashed bg-muted/30 p-4 transition-colors",
              "flex flex-col items-center gap-3 text-center",
            )}
          >
            {localPreviewUrl ? (
              <div className="relative w-full max-w-md overflow-hidden rounded-md border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localPreviewUrl}
                  alt=""
                  className="h-48 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-6 text-muted-foreground">
                <ImagePlus className="h-8 w-8" aria-hidden />
                <p className="text-sm">{t("upload.dropzone.empty")}</p>
                <p className="text-xs text-muted-foreground/80">
                  {t("upload.constraints.formats")} · {t("upload.constraints.size")}
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelected}
              disabled={disabled || isUploading}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
              >
                {selectedFile
                  ? t("upload.dropzone.replace")
                  : t("upload.dropzone.button")}
              </Button>
              {selectedFile ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUpload}
                    disabled={disabled || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t("upload.uploading")}
                      </>
                    ) : (
                      t("upload.actions.send")
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFileSelection}
                    disabled={disabled || isUploading}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    {t("upload.actions.cancel")}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://example.com/cover.jpg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isUploading}
          />
          <p className="text-xs text-muted-foreground">
            {t("upload.url.hint")}
          </p>
        </TabsContent>
      </Tabs>

      {hasCurrentValue ? (
        <div className="flex items-start gap-3 rounded-md border bg-card p-3">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded border bg-muted">
            {/* Use a plain <img> here: the URL might be local (`/uploads/...`) or
                external; we don't need next/image optimisation for a tiny preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium">{t("upload.current.title")}</p>
            <p className="truncate text-muted-foreground">{value}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={disabled || isUploading}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            {t("upload.actions.remove")}
          </Button>
        </div>
      ) : null}

    </div>
  );
}
