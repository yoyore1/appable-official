const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

export async function validateRailwayApiToken(
  token: string
): Promise<{ ok: true; email?: string; name?: string } | { ok: false }> {
  const trimmed = token.trim();
  if (trimmed.length < 8) return { ok: false };

  try {
    const res = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query { me { email name } }`,
      }),
      cache: "no-store",
    });

    if (!res.ok) return { ok: false };

    const json = (await res.json()) as {
      data?: { me?: { email?: string; name?: string } | null };
      errors?: unknown[];
    };

    if (json.errors?.length || !json.data?.me) return { ok: false };

    return {
      ok: true,
      email: json.data.me.email,
      name: json.data.me.name,
    };
  } catch {
    return { ok: false };
  }
}
