import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coverImageStorage } from "@/lib/storage/cover-image";
import { detectImageMime, type DetectedMime } from "@/lib/storage/mime-detect";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_BYTES = 1_048_576; // 1 MiB (spec §B.2.2)

const ALLOWED_MIMES: ReadonlyArray<DetectedMime> = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Note: per spec §B.2.1 plain MODERATOR cannot edit content of other users
// (only trash). Only ADMIN+ may upload on behalf of another author.
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "USER" | "CUSTOMER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

type SuccessBody = { success: true; data: { url: string } };
type ErrorBody = { success: false; error: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const optionalPostIdSchema = z.string().trim().min(1).max(64).optional();

function jsonError(status: number, message: string): NextResponse<ErrorBody> {
  // We deliberately keep the message generic — never leak filesystem paths
  // or stack traces (spec §B.6).
  return NextResponse.json<ErrorBody>(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function jsonSuccess(url: string): NextResponse<SuccessBody> {
  return NextResponse.json<SuccessBody>(
    { success: true, data: { url } },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

async function getActiveBan(userId: string): Promise<boolean> {
  const now = new Date();
  const ban = await prisma.sanction.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      type: { in: ["TEMPORARY_BAN", "PERMANENT_BAN"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return !!ban;
}

// ─── POST ────────────────────────────────────────────────────────────────────

/**
 * POST /api/upload/post-cover
 *
 * Body: multipart/form-data with field `file` (the image) and optional
 * `postId` (string). If `postId` is set and the caller is allowed, the
 * resulting URL is persisted on `Post.coverImage` in the same request.
 *
 * Security checklist (spec §B.6):
 *  - Auth required (verified email, non-banned) BEFORE reading the body.
 *  - `Content-Length` ≤ 1 MiB enforced BEFORE `formData()` parsing.
 *  - `file.size` re-checked after parse (Content-Length can lie).
 *  - MIME validated by magic bytes (`lib/storage/mime-detect.ts`), not by
 *    the client-supplied `Content-Type`.
 *  - Server-generated filename: client name is fully discarded.
 *  - `Cache-Control: no-store` on every response.
 *
 * NOTE on test coverage: this handler is not unit-tested in
 * `__tests__/upload-route.test.ts` for the MVP — mocking `formData()` plus
 * Better Auth's session API plus the local filesystem is non-trivial and
 * brittle. Coverage is provided manually via the acceptance criteria in
 * `docs/likes-and-upload-spec.md` §B.7. Add a route-level integration test
 * post-MVP if/when the upload flow becomes more complex.
 *
 * TODO post-MVP: rate-limit per user (see `lib/rate-limit.ts` when added).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // 1) Auth ----------------------------------------------------------------
    const session = await auth.api
      .getSession({ headers: request.headers })
      .catch(() => null);
    if (!session?.user) return jsonError(401, "Unauthorized");

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, emailVerified: true },
    });
    if (!dbUser) return jsonError(401, "Unauthorized");
    if (!dbUser.emailVerified) return jsonError(403, "Email not verified");

    if (await getActiveBan(dbUser.id)) return jsonError(403, "Banned");

    const role = dbUser.role as Role;
    const isAdmin = ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);

    // 2) Content-Length pre-flight ------------------------------------------
    // Reject oversized payloads BEFORE reading the body into memory.
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        return jsonError(400, "Invalid Content-Length");
      }
      if (contentLength > MAX_BYTES) {
        return jsonError(413, "Payload too large (max 1 MB)");
      }
    }

    // 3) Parse multipart -----------------------------------------------------
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(400, "Invalid form data");
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof Blob)) {
      return jsonError(400, "Missing file");
    }

    // 4) Re-check size after parse -----------------------------------------
    if (fileEntry.size > MAX_BYTES) {
      return jsonError(413, "Payload too large (max 1 MB)");
    }
    if (fileEntry.size === 0) {
      return jsonError(400, "Empty file");
    }

    // 5) Sanity-check client-supplied type before reading buffer ------------
    // We still validate by magic bytes below — this is just a fast reject.
    const clientType = fileEntry.type as DetectedMime | "" | string;
    if (
      clientType &&
      !ALLOWED_MIMES.includes(clientType as DetectedMime)
    ) {
      return jsonError(415, "Unsupported media type");
    }

    // 6) Load the buffer & detect by magic bytes ---------------------------
    const buffer = await fileEntry.arrayBuffer();
    const detected = detectImageMime(buffer);
    if (!detected) {
      return jsonError(400, "MIME mismatch");
    }
    // Cross-check: if the client claimed a MIME, it must match what we
    // detected. Catches the "EXE renamed .png" / "PNG header but Content-
    // Type image/svg+xml" cases (spec §B.6).
    if (clientType && clientType !== detected) {
      return jsonError(400, "MIME mismatch");
    }

    // 7) Optional postId & permission check ---------------------------------
    const rawPostId = formData.get("postId");
    const parsedPostId = optionalPostIdSchema.safeParse(
      typeof rawPostId === "string" ? rawPostId : undefined,
    );
    if (!parsedPostId.success) {
      return jsonError(400, "Invalid postId");
    }
    const postId = parsedPostId.data;

    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true, trashedAt: true, deletedAt: true },
      });
      if (!post || post.deletedAt) return jsonError(404, "Post not found");
      if (post.trashedAt) return jsonError(403, "Post under moderation");

      const isOwner = post.authorId === dbUser.id;
      // MODERATOR is intentionally NOT allowed to edit content of others
      // (spec §B.2.1 — moderators may trash, not rewrite). ADMIN+ can.
      if (!isOwner && !isAdmin) {
        // Silently treat as Forbidden — we do not differentiate between
        // "not yours" and "moderator without rights" for clarity.
        return jsonError(403, "Forbidden");
      }
    }

    // 8) Persist to storage -------------------------------------------------
    let uploaded: { url: string; storageKey: string };
    try {
      uploaded = await coverImageStorage.upload({
        file: buffer,
        contentType: detected,
        ownerId: dbUser.id,
      });
    } catch (err) {
      // Do not leak the underlying error (path, IO error, etc.).
      console.error("[upload/post-cover] storage upload failed", {
        userId: dbUser.id.slice(0, 8),
        contentType: detected,
        size: buffer.byteLength,
        message: err instanceof Error ? err.message : "unknown",
      });
      return jsonError(500, "Upload failed");
    }

    // 9) Persist on Post if a postId was supplied ---------------------------
    if (postId) {
      try {
        await prisma.post.update({
          where: { id: postId },
          data: { coverImage: uploaded.url },
        });
      } catch (err) {
        console.error("[upload/post-cover] post update failed", {
          userId: dbUser.id.slice(0, 8),
          postId: postId.slice(0, 8),
          message: err instanceof Error ? err.message : "unknown",
        });
        // The file is uploaded; we still return the URL so the client can
        // retry the update via the standard PostForm flow.
      }
    }

    return jsonSuccess(uploaded.url);
  } catch (err) {
    console.error("[upload/post-cover] unexpected error", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return jsonError(500, "Upload failed");
  }
}

// Reject other methods explicitly.
export async function GET(): Promise<Response> {
  return jsonError(405, "Method not allowed");
}
