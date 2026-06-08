import type {
  ProjectRevenueCatConnector,
  RevenueCatConnectorPublic,
} from "@/lib/types";
import { encryptConnectorSecret, decryptConnectorSecret } from "./encrypt";
import { validateRevenueCatSecretKey } from "./revenueCatManagement";
import { mintWebhookSecret, revenueCatWebhookUrl } from "./webhookUrls";

export function revenueCatConnectorPublic(
  connector: ProjectRevenueCatConnector | null | undefined
): RevenueCatConnectorPublic | null {
  return connector?.public ?? null;
}

export function decryptRevenueCatSecrets(connector: ProjectRevenueCatConnector): {
  publicApiKey: string;
  secretApiKey: string;
  webhookSecret: string;
} {
  return {
    publicApiKey: decryptConnectorSecret(connector.publicApiKeyEnc),
    secretApiKey: decryptConnectorSecret(connector.secretApiKeyEnc),
    webhookSecret: decryptConnectorSecret(connector.webhookSecretEnc),
  };
}

export async function linkRevenueCatProject(input: {
  projectId: string;
  publicApiKey: string;
  secretApiKey: string;
}): Promise<ProjectRevenueCatConnector> {
  const publicApiKey = input.publicApiKey.trim();
  const secretApiKey = input.secretApiKey.trim();

  if (publicApiKey.length < 8 || secretApiKey.length < 8) {
    throw new Error("INVALID_KEYS");
  }

  const valid = await validateRevenueCatSecretKey(secretApiKey);
  if (!valid) throw new Error("INVALID_SECRET_KEY");

  const webhookSecret = mintWebhookSecret();
  const webhookUrl = revenueCatWebhookUrl(input.projectId);

  return {
    public: {
      status: "connected",
      connectedAt: new Date().toISOString(),
      publicApiKeyHint: maskKey(publicApiKey),
      webhookUrl,
      webhooksConfigured: false,
    },
    publicApiKeyEnc: encryptConnectorSecret(publicApiKey),
    secretApiKeyEnc: encryptConnectorSecret(secretApiKey),
    webhookSecretEnc: encryptConnectorSecret(webhookSecret),
  };
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function revenueCatConnectorForBuilder(
  connector: ProjectRevenueCatConnector | null | undefined
) {
  if (!connector || connector.public.status === "disconnected") return null;
  const secrets = decryptRevenueCatSecrets(connector);
  return {
    status: connector.public.status,
    publicApiKey: secrets.publicApiKey,
    secretApiKey: secrets.secretApiKey,
    webhookUrl: connector.public.webhookUrl,
    webhookSecret: secrets.webhookSecret,
  };
}
