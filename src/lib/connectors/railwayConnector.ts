import type { ProjectRailwayConnector, RailwayConnectorPublic } from "@/lib/types";
import { encryptConnectorSecret, decryptConnectorSecret } from "./encrypt";
import { validateRailwayApiToken } from "./railwayManagement";

export function railwayConnectorPublic(
  connector: ProjectRailwayConnector | null | undefined
): RailwayConnectorPublic | null {
  return connector?.public ?? null;
}

export function decryptRailwaySecrets(connector: ProjectRailwayConnector): {
  apiToken: string;
} {
  return {
    apiToken: decryptConnectorSecret(connector.apiTokenEnc),
  };
}

function normalizeServiceUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("INVALID_URL");
  }
  return url;
}

export async function linkRailwayProject(input: {
  apiToken: string;
  serviceUrl: string;
}): Promise<ProjectRailwayConnector> {
  const apiToken = input.apiToken.trim();
  const serviceUrl = normalizeServiceUrl(input.serviceUrl);

  if (apiToken.length < 8) throw new Error("INVALID_TOKEN");

  const valid = await validateRailwayApiToken(apiToken);
  if (!valid.ok) throw new Error("INVALID_TOKEN");

  const accountHint = valid.email
    ? maskEmail(valid.email)
    : valid.name
      ? valid.name
      : "Railway account";

  return {
    public: {
      status: "connected",
      connectedAt: new Date().toISOString(),
      serviceUrl,
      accountHint,
    },
    apiTokenEnc: encryptConnectorSecret(apiToken),
  };
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.length <= 2 ? user[0] ?? "" : user.slice(0, 2);
  return `${head}…@${domain}`;
}

export function railwayConnectorForBuilder(
  connector: ProjectRailwayConnector | null | undefined
) {
  if (!connector || connector.public.status === "disconnected") return null;
  const secrets = decryptRailwaySecrets(connector);
  return {
    status: connector.public.status,
    serviceUrl: connector.public.serviceUrl,
    apiToken: secrets.apiToken,
    accountHint: connector.public.accountHint,
  };
}
