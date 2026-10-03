/** The social sign-ins the login page knows how to offer. */
export const PROVIDER_IDS = ["google", "apple"] as const;
export type Provider = (typeof PROVIDER_IDS)[number];

/**
 * Which of them are switched on in this deployment's Supabase project.
 *
 * Read from Auth's public settings (`external.<provider>: true`) rather than
 * assumed: a button for a provider nobody enabled sends the person to a bare
 * JSON error page on Supabase's domain, which the app never sees and cannot
 * explain. Throws if the settings cannot be read; the caller offers none.
 */
export async function enabledProviders(): Promise<Provider[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Accounts are not configured.");
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`Auth settings answered ${response.status}.`);
  const { external } = (await response.json()) as { external?: Record<string, boolean> };
  return PROVIDER_IDS.filter((id) => external?.[id] === true);
}
