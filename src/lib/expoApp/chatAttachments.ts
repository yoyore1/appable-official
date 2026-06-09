import type { ChatAttachmentUpload } from "@/lib/types";

export const MAX_CHAT_ATTACHMENTS = 3;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_FILE_BYTES = 120 * 1024;

const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;
const TEXT_MIME =
  /^text\/(plain|markdown|csv)|application\/(json|xml)|text\/html$/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|xml|html?)$/i;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name);
}

export function isAcceptedChatFile(file: File): boolean {
  if (isVideoFile(file)) return false;
  if (IMAGE_MIME.test(file.type)) return true;
  if (TEXT_MIME.test(file.type)) return true;
  if (TEXT_EXT.test(file.name)) return true;
  return false;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

/** Small JPEG thumb for chat bubbles — keeps DB light. */
export async function makeImageThumb(dataUrl: string, maxPx = 96): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export type PendingChatAttachment = ChatAttachmentUpload & {
  id: string;
};

/** Images from clipboard paste (screenshots, copied photos). */
export function getClipboardImageFiles(data: DataTransfer): File[] {
  const files: File[] = [];
  const seen = new Set<string>();

  function push(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const key = `${file.type}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(normalizeClipboardImageFile(file));
  }

  if (data.files?.length) {
    for (const file of Array.from(data.files)) push(file);
  }
  if (!files.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        push(item.getAsFile());
      }
    }
  }
  return files;
}

function normalizeClipboardImageFile(file: File): File {
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "png";
  const generic = !file.name || /^image\.\w+$/i.test(file.name) || file.name === "blob";
  if (!generic) return file;
  return new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type || "image/png" });
}

export async function attachChatFiles(
  files: File[],
  opts: {
    currentCount: number;
    onAttach: (attachment: PendingChatAttachment) => void;
    onError: (message: string) => void;
  }
): Promise<number> {
  let count = opts.currentCount;
  for (const file of files) {
    if (count >= MAX_CHAT_ATTACHMENTS) {
      opts.onError(`Max ${MAX_CHAT_ATTACHMENTS} attachments.`);
      break;
    }
    if (isVideoFile(file)) {
      opts.onError("Videos aren't supported — use a photo or text file.");
      continue;
    }
    if (!isAcceptedChatFile(file)) {
      opts.onError("Use a photo or text file (TXT, MD, CSV, JSON).");
      continue;
    }
    const att = await readChatAttachment(file);
    opts.onAttach(att);
    count++;
  }
  return count;
}

export async function readChatAttachment(file: File): Promise<PendingChatAttachment> {
  if (isVideoFile(file)) {
    throw new Error("Videos aren't supported — attach a photo or document.");
  }
  if (!isAcceptedChatFile(file)) {
    throw new Error("Use a photo (PNG, JPG, WebP) or text file (TXT, MD, CSV, JSON).");
  }

  const isImage = IMAGE_MIME.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_TEXT_FILE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      isImage ? "Image too large — max 4 MB." : "File too large — max 120 KB."
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  let thumbDataUrl: string | undefined;
  if (isImage) {
    thumbDataUrl = await makeImageThumb(dataUrl);
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: file.type || (isImage ? "image/png" : "text/plain"),
    dataUrl,
    thumbDataUrl,
  };
}
