import imageCompression from 'browser-image-compression';

/**
 * Compress a receipt image in a way that's resilient across mobile browsers / webviews.
 *
 * Key points:
 * - Avoid WebWorker mode (`useWebWorker: false`) because it can fail in some environments
 *   (blocked workers/CSP, blocked CDN importScripts, or embedded browsers).
 * - Never throw: if compression fails, return the original file so "complete job" can proceed.
 */
export async function compressReceiptImage(file: File): Promise<File> {
  try {
    if (!(file instanceof File)) return file;
    if (!file.type?.startsWith('image/')) return file;

    const options = {
      maxSizeMB: 0.03, // 30KB target (matches current behavior)
      maxWidthOrHeight: 1920,
      useWebWorker: false,
    } as const;

    const compressed = await imageCompression(file, options);

    // Extra safety: if for any reason we got a non-Blob back, fall back.
    if (!(compressed instanceof Blob)) return file;

    return compressed as File;
  } catch (err) {
    // Don’t block job completion due to compression issues.
    console.warn('[compressReceiptImage] Compression failed; uploading original file instead.', err);
    return file;
  }
}


