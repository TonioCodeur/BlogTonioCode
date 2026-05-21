import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extForMime, type DetectedMime } from "@/lib/storage/mime-detect";

// ─── Public types ────────────────────────────────────────────────────────────

export type UploadedCoverImage = {
  /** Public URL to store in Post.coverImage. */
  url: string;
  /** Storage key for future deletion (relative path / blob pathname). */
  storageKey: string;
};

export interface CoverImageStorage {
  upload(input: {
    file: ArrayBuffer;
    contentType: DetectedMime;
    ownerId: string;
  }): Promise<UploadedCoverImage>;
  delete(storageKey: string): Promise<void>;
}

// ─── Filename generation ─────────────────────────────────────────────────────

/**
 * Generate a server-controlled filename. We intentionally ignore the client
 * filename to remove any path-traversal / encoding risk (spec §B.2.2).
 *
 * `crypto.randomUUID()` is used instead of an additional `cuid` dep — both
 * give a sufficiently collision-free identifier for filenames.
 */
function generateFilename(mime: DetectedMime): string {
  const id = crypto.randomUUID();
  return `${id}.${extForMime(mime)}`;
}

// ─── Local implementation (MVP / dev) ────────────────────────────────────────

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "posts");
const LOCAL_URL_PREFIX = "/uploads/posts";

export const localCoverImageStorage: CoverImageStorage = {
  async upload({ file, contentType }) {
    // mkdir is idempotent with { recursive: true }; race-safe between requests.
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });

    const filename = generateFilename(contentType);
    const filePath = path.join(LOCAL_UPLOAD_DIR, filename);

    // Buffer.from(ArrayBuffer) avoids an extra copy — the buffer is already
    // bounded to 1 MiB by the route handler.
    await fs.writeFile(filePath, Buffer.from(file));

    return {
      url: `${LOCAL_URL_PREFIX}/${filename}`,
      storageKey: filename,
    };
  },

  async delete(storageKey) {
    // Defensive: never let a caller break out of the upload dir. The key is
    // server-generated, but we re-check just in case it's ever piped from a
    // user-controlled source.
    if (storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
      throw new Error("Invalid storage key");
    }
    const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey);
    await fs.unlink(filePath).catch(() => {
      // Idempotent: silently swallow ENOENT and similar — the file is gone.
    });
  },
};

// ─── Storage selection ───────────────────────────────────────────────────────

/**
 * The active storage backend.
 *
 * MVP: writes to `public/uploads/posts/`.
 *
 * Production note (spec §B.2.3): local writes do NOT work on Vercel
 * (read-only filesystem in serverless functions). Before deploying to prod
 * on Vercel, swap to a Vercel Blob implementation here. The minimum work
 * required for that swap:
 *
 *   1. Install `@vercel/blob`.
 *   2. Create `lib/storage/cover-image.vercel-blob.ts` exporting an object
 *      that satisfies `CoverImageStorage`, using `put()` from `@vercel/blob`.
 *   3. Replace the export below with:
 *        export const coverImageStorage: CoverImageStorage =
 *          process.env.BLOB_READ_WRITE_TOKEN
 *            ? vercelBlobCoverImageStorage
 *            : localCoverImageStorage;
 *
 * No other application code needs to change — the route handler and the
 * client form only depend on the `CoverImageStorage` interface.
 */
export const coverImageStorage: CoverImageStorage = localCoverImageStorage;
