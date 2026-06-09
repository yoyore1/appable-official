import { visionComplete } from "@/lib/deepinfra";
import type { ChatAttachmentRef, ChatAttachmentUpload } from "@/lib/types";

const IMAGE_MIME = /^image\//i;
const TEXT_MIME =
  /^text\/(plain|markdown|csv)|application\/(json|xml)|text\/html$/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|xml|html?)$/i;

function dataUrlPayload(dataUrl: string): string {
  const m = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return "";
  return m[1] ?? "";
}

function isImageAttachment(att: ChatAttachmentUpload): boolean {
  return IMAGE_MIME.test(att.mimeType) || /\.(jpe?g|png|webp|gif)$/i.test(att.name);
}

function isTextAttachment(att: ChatAttachmentUpload): boolean {
  return (
    TEXT_MIME.test(att.mimeType) ||
    TEXT_EXT.test(att.name) ||
    (!isImageAttachment(att) && att.mimeType.startsWith("text/"))
  );
}

function visionPrompt(userText: string, appName: string, mode: "brainstorm" | "build"): string {
  const role =
    mode === "build"
      ? `You help a founder edit their live app preview for "${appName}".`
      : `You help a founder brainstorm their mobile app "${appName}".`;

  if (userText.trim()) {
    return (
      `${role} They attached an image and wrote: "${userText.trim()}". ` +
      `Describe what's in the image that matters for their request — UI layout, copy, colors, branding, competitor reference, wireframe, or inspiration. ` +
      `Transcribe any visible text. Be specific and actionable.`
    );
  }

  return (
    `${role} They attached an image with no caption. ` +
    `Infer what they likely want help with (UI feedback, copy, branding, competitor app, sketch, screenshot of a problem, etc.) ` +
    `and describe it concretely. Transcribe any visible text.`
  );
}

async function analyzeImage(
  att: ChatAttachmentUpload,
  userText: string,
  appName: string,
  mode: "brainstorm" | "build"
): Promise<string> {
  const { text } = await visionComplete({
    imageUrl: att.dataUrl,
    prompt: visionPrompt(userText, appName, mode),
    maxTokens: 500,
  });
  return text.trim() || "Could not read this image clearly.";
}

function readTextFile(att: ChatAttachmentUpload): string {
  const b64 = dataUrlPayload(att.dataUrl);
  if (!b64) return "";
  const raw = Buffer.from(b64, "base64").toString("utf8");
  return raw.trim().slice(0, 4000);
}

export type AnalyzedChatAttachments = {
  effectiveMessage: string;
  storedAttachments: ChatAttachmentRef[];
};

/** Merge typed message + file/image understanding into one coach-ready message. */
export async function analyzeChatAttachments(
  attachments: ChatAttachmentUpload[],
  userText: string,
  ctx: { appName: string; mode: "brainstorm" | "build" }
): Promise<AnalyzedChatAttachments> {
  const trimmed = userText.trim();
  if (!attachments.length) {
    return { effectiveMessage: trimmed, storedAttachments: [] };
  }

  const storedAttachments: ChatAttachmentRef[] = attachments.map((a) => ({
    name: a.name,
    kind: isImageAttachment(a) ? "image" : "file",
    thumbDataUrl: a.thumbDataUrl,
  }));

  const blocks: string[] = [];

  for (const att of attachments) {
    if (isImageAttachment(att)) {
      const summary = await analyzeImage(att, trimmed, ctx.appName, ctx.mode);
      blocks.push(`[Image: ${att.name}]\n${summary}`);
      continue;
    }
    if (isTextAttachment(att)) {
      const body = readTextFile(att);
      blocks.push(
        body
          ? `[File: ${att.name}]\n${body}`
          : `[File: ${att.name}]\n(empty or unreadable text file)`
      );
      continue;
    }
    blocks.push(`[File: ${att.name}]\n(unsupported file type)`);
  }

  const attachmentBlock = blocks.join("\n\n");

  let effectiveMessage: string;
  if (trimmed) {
    effectiveMessage =
      `${trimmed}\n\n---\nAttached for context:\n${attachmentBlock}\n---`;
  } else {
    effectiveMessage =
      `The founder attached file(s) with no typed message. Use the attachment context below.\n\n` +
      `---\n${attachmentBlock}\n---`;
  }

  return { effectiveMessage, storedAttachments };
}
