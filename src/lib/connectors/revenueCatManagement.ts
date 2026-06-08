const RC_API = "https://api.revenuecat.com/v1";

/** 404 on unknown subscriber = key is valid; 401 = bad key. */
export async function validateRevenueCatSecretKey(secretKey: string): Promise<boolean> {
  const res = await fetch(`${RC_API}/subscribers/appable_connect_probe`, {
    headers: {
      Authorization: `Bearer ${secretKey.trim()}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401 || res.status === 403) return false;
  return res.status === 404 || res.ok;
}

export async function revenueCatEnsureSubscriber(
  secretKey: string,
  appUserId: string
): Promise<void> {
  await fetch(`${RC_API}/subscribers/${encodeURIComponent(appUserId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey.trim()}`,
      "Content-Type": "application/json",
    },
  });
}
