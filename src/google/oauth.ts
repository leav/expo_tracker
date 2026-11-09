import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { GOOGLE_SCOPES, googleOAuthConfig } from "./config";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function createOAuthState(secret: string, now = Date.now()): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${nonce}.${now}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

export function verifyOAuthState(secret: string, value: string, now = Date.now()): boolean {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [nonce, timestamp, mac] = parts;
  if (!nonce || !timestamp || !mac) return false;
  const payload = `${nonce}.${timestamp}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const actualBuffer = Buffer.from(mac, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  const createdAt = Number(timestamp);
  if (!Number.isFinite(createdAt)) return false;
  if (createdAt > now + 60_000) return false;
  if (now - createdAt > STATE_MAX_AGE_MS) return false;
  return true;
}

export type GoogleOAuthCallbackCheck =
  | { ok: true; code: string }
  | { ok: false; error: string };

export function googleOAuthCallbackCheck(input: {
  code: string | null;
  state: string | null;
  cookie: string | undefined;
  secret: string;
  appOrigin: string;
  now?: number;
}): GoogleOAuthCallbackCheck {
  if (!input.code || !input.state) {
    return { ok: false, error: "Google connection was missing an authorization code. Try Connect Google again." };
  }
  if (!input.cookie) {
    return {
      ok: false,
      error: `Open the app at ${input.appOrigin} (not localhost) and try Connect Google again.`,
    };
  }
  if (input.cookie !== input.state || !verifyOAuthState(input.secret, input.state, input.now)) {
    return {
      ok: false,
      error: `Google connection could not be verified. Try Connect Google again from ${input.appOrigin}.`,
    };
  }
  return { ok: true, code: input.code };
}

export function googleAuthorizationUrl(state: string): string | { error: string } {
  const config = googleOAuthConfig();
  if (!config.ready) return { error: config.reason };
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export type GoogleTokenSet = {
  email: string;
  refreshToken: string;
  accessToken: string | null;
  expiry: number | null;
  scopes: string;
};

export async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenSet> {
  const config = googleOAuthConfig();
  if (!config.ready) throw new Error(config.reason);

  const payload = await postToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Disconnect and connect again with consent.");
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  const email = emailFromIdToken(payload.id_token) ?? (accessToken ? await emailFromUserInfo(accessToken) : null);
  if (!email) throw new Error("Google did not return an email address.");

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : Number(payload.expires_in);
  const expiry = Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : null;
  const scopes = typeof payload.scope === "string" ? payload.scope : GOOGLE_SCOPES.join(" ");

  return { email, refreshToken, accessToken, expiry, scopes };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiry: number;
  refreshToken?: string;
}> {
  const config = googleOAuthConfig();
  if (!config.ready) throw new Error(config.reason);

  const payload = await postToken({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) throw new Error("Google did not return an access token.");
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : Number(payload.expires_in);
  const expiry = Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3600 * 1000);
  const nextRefresh = typeof payload.refresh_token === "string" ? payload.refresh_token : undefined;
  return { accessToken, expiry, refreshToken: nextRefresh };
}

async function postToken(params: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const description = typeof payload.error_description === "string" ? payload.error_description : "Google token request failed.";
    throw new Error(description);
  }
  return payload;
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function emailFromUserInfo(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { email?: unknown };
  return typeof payload.email === "string" ? payload.email : null;
}
