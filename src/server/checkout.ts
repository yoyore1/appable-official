"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { decodeKind, fulfill, startCheckout, type PurchaseKind } from "@/lib/payments";

async function go(kind: PurchaseKind, returnTo: string) {
  const user = await requireUser();
  const url = await startCheckout(user.id, kind, returnTo);
  redirect(url);
}

export async function depositCheckout() {
  await go({ type: "deposit" }, "/dashboard");
}

export async function packCheckout(packId: string) {
  await go({ type: "pack", packId }, "/buy");
}

export async function reviewTopupCheckout() {
  await go({ type: "review_topup" }, "/buy");
}

export async function launchPackCheckout(projectId: string) {
  await go({ type: "launch_pack", projectId }, `/project/${projectId}`);
}

export async function launchAddonCheckout(
  addon: "aso" | "screenshots" | "video",
  projectId: string
) {
  await go({ type: "launch_addon", addon, projectId }, `/project/${projectId}`);
}

export async function courseCheckout(tierId: string) {
  await go({ type: "course", tierId }, "/course");
}

/** Called by the mock checkout confirm screen to apply the purchase. */
export async function confirmMockCheckout(formData: FormData) {
  const user = await requireUser();
  const token = String(formData.get("k") ?? "");
  const returnTo = String(formData.get("r") ?? "/dashboard");
  const kind = decodeKind(token);
  await fulfill(user.id, kind);
  redirect(`${returnTo}?celebrate=1`);
}
