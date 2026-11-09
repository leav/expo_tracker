export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const DEFAULT_GOOGLE_REDIRECT_URI = "http://127.0.0.1:4747/api/google/callback";

export function googleAppOrigin(redirectUri = DEFAULT_GOOGLE_REDIRECT_URI): string {
  return new URL(redirectUri).origin;
}

export function googleConnectHref(redirectUri = DEFAULT_GOOGLE_REDIRECT_URI): string {
  return `${googleAppOrigin(redirectUri)}/api/google/connect`;
}

export function googleSettingsHref(redirectUri = DEFAULT_GOOGLE_REDIRECT_URI): string {
  return `${googleAppOrigin(redirectUri)}/settings`;
}

export function googleConnectHostRedirect(
  requestHost: string | null,
  redirectUri = DEFAULT_GOOGLE_REDIRECT_URI,
): string | null {
  const expected = new URL(googleAppOrigin(redirectUri)).host.toLowerCase();
  const actual = (requestHost ?? "").toLowerCase();
  if (actual === expected) return null;
  return googleConnectHref(redirectUri);
}

export const GOOGLE_OAUTH_ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
] as const;

export type GoogleOAuthEnvKey = (typeof GOOGLE_OAUTH_ENV_KEYS)[number];

export type GoogleOAuthConfig =
  | {
      ready: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      sessionSecret: string;
    }
  | { ready: false; reason: string; missing: GoogleOAuthEnvKey[] };

export function missingGoogleOAuthKeys(env: {
  clientId?: string | null;
  clientSecret?: string | null;
  sessionSecret?: string | null;
}): GoogleOAuthEnvKey[] {
  const missing: GoogleOAuthEnvKey[] = [];
  if (!(env.clientId?.trim() ?? "")) missing.push("GOOGLE_CLIENT_ID");
  if (!(env.clientSecret?.trim() ?? "")) missing.push("GOOGLE_CLIENT_SECRET");
  if (!(env.sessionSecret?.trim() ?? "")) missing.push("SESSION_SECRET");
  return missing;
}

export function googleOAuthNotReadyReason(missing: readonly GoogleOAuthEnvKey[]): string {
  if (missing.includes("GOOGLE_CLIENT_ID") || missing.includes("GOOGLE_CLIENT_SECRET")) {
    return "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local to connect Google.";
  }
  return "Set SESSION_SECRET in .env.local to connect Google.";
}

export function googleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const sessionSecret = process.env.SESSION_SECRET?.trim() ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || DEFAULT_GOOGLE_REDIRECT_URI;
  const missing = missingGoogleOAuthKeys({ clientId, clientSecret, sessionSecret });

  if (missing.length > 0) {
    return { ready: false, reason: googleOAuthNotReadyReason(missing), missing };
  }
  return { ready: true, clientId, clientSecret, redirectUri, sessionSecret };
}

export function ownerEmailEnv(): string | null {
  const value = process.env.OWNER_EMAIL?.trim() ?? "";
  return value.length > 0 ? value : null;
}
