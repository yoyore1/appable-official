import { AsyncLocalStorage } from "node:async_hooks";
import { chargeAiBudget, type ChargeBudgetResult } from "@/lib/aiBudgetAccount";

type BillingStore = {
  costs: number[];
  projectId: string;
  ownerUserId: string;
  isGuest: boolean;
};

const storage = new AsyncLocalStorage<BillingStore>();

/** Called by every DeepInfra client after a response — accumulates real USD. */
export function trackLlmCost(costUsd: number): void {
  if (costUsd <= 0) return;
  const store = storage.getStore();
  if (store) store.costs.push(costUsd);
}

export function isAiBillingActive(): boolean {
  return Boolean(storage.getStore());
}

/** Sum of real costs recorded in the current billing scope. */
export function pendingLlmCostUsd(): number {
  const store = storage.getStore();
  if (!store) return 0;
  return store.costs.reduce((sum, n) => sum + n, 0);
}

/**
 * Run server work inside a billing scope — all trackLlmCost() calls flush once at the end.
 */
export async function runWithAiBilling<T>(
  scope: { projectId: string; ownerUserId: string; isGuest: boolean },
  fn: () => Promise<T>
): Promise<{ result: T; charge: ChargeBudgetResult; costUsd: number }> {
  const costs: number[] = [];
  const result = await storage.run(
    { costs, projectId: scope.projectId, ownerUserId: scope.ownerUserId, isGuest: scope.isGuest },
    fn
  );
  const costUsd = costs.reduce((sum, n) => sum + n, 0);
  const charge = await chargeAiBudget({
    projectId: scope.projectId,
    ownerUserId: scope.ownerUserId,
    isGuest: scope.isGuest,
    costUsd,
  });
  return { result, charge, costUsd };
}
