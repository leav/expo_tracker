import {
  DEFAULT_GOOGLE_REDIRECT_URI,
  GOOGLE_SCOPES,
  googleSettingsHref,
  type GoogleOAuthEnvKey,
} from "../../google/config";

const CONSOLE = "https://console.cloud.google.com/";
const GMAIL_API = "https://console.cloud.google.com/apis/library/gmail.googleapis.com";
const CALENDAR_API = "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com";
const CONSENT = "https://console.cloud.google.com/auth/overview";
const CREDENTIALS = "https://console.cloud.google.com/apis/credentials";

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] break-all">{children}</code>
  );
}

function ConsoleLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} className="underline underline-offset-4" rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

function Diagram({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="overflow-hidden rounded-md border bg-muted/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} className="w-full" height={300} src={src} width={640} />
    </figure>
  );
}

export function GoogleOAuthSetup({
  reason,
  missing,
}: {
  reason: string;
  missing: readonly GoogleOAuthEnvKey[];
}) {
  return (
    <div className="grid gap-4 text-sm">
      <p>
        {reason} Calendar reminders and later Gmail stay off until a Google Cloud{" "}
        <strong>Web</strong> client exists. Cons, Lineups, Calendar, and Import still work.
      </p>
      <p>
        Missing in <Code>.env.local</Code>:{" "}
        {missing.map((key, index) => (
          <span key={key}>
            {index > 0 ? ", " : null}
            <Code>{key}</Code>
          </span>
        ))}
        .
      </p>
      <ul className="list-disc space-y-2 rounded-md border bg-muted/40 px-5 py-3">
        <li>
          Add <strong>your own Gmail</strong> as a test user on the OAuth consent screen. Until you do,
          Google blocks sign-in even if the client ID and secret are correct.
        </li>
        <li>
          Open the app at <Code>{googleSettingsHref()}</Code>. Do not use localhost. Google sends the
          login cookie only to <Code>127.0.0.1</Code>.
        </li>
      </ul>
      <ol className="list-decimal space-y-6 pl-5">
        <li className="space-y-2 pl-1">
          <p>
            Open <ConsoleLink href={CONSOLE}>Google Cloud Console</ConsoleLink> and create or pick a
            project. A personal project is enough.
          </p>
        </li>
        <li className="space-y-2 pl-1">
          <p>
            Enable the{" "}
            <ConsoleLink href={GMAIL_API}>Gmail API</ConsoleLink> and the{" "}
            <ConsoleLink href={CALENDAR_API}>Google Calendar API</ConsoleLink> for that project.
          </p>
        </li>
        <li className="space-y-2 pl-1">
          <p>
            Open the{" "}
            <ConsoleLink href={CONSENT}>OAuth consent screen</ConsoleLink>. User type External.
            Publishing status <strong>Testing</strong>. Do not publish the app.
          </p>
          <p className="text-muted-foreground">
            On the consent screen, add these scopes:{" "}
            {GOOGLE_SCOPES.map((scope, index) => (
              <span key={scope}>
                {index > 0 ? ", " : ""}
                <Code>{scope}</Code>
              </span>
            ))}
            .
          </p>
        </li>
        <li className="space-y-2 pl-1">
          <p>
            On that same consent screen, open <strong>Test users</strong> and add the Gmail address you
            will sign in with. This is required. Google OAuth will not let you through until your email
            is on that list.
          </p>
          <Diagram
            alt="Wireframe of the OAuth consent screen with Publishing status Testing and your Gmail added as a test user."
            src="/google-oauth/consent-testing.svg"
          />
        </li>
        <li className="space-y-2 pl-1">
          <p>
            In <ConsoleLink href={CREDENTIALS}>Credentials</ConsoleLink>, create an OAuth client. Set
            the type to <strong>Web application</strong>.
          </p>
          <Diagram
            alt="Wireframe of Create OAuth client with Application type Web application selected."
            src="/google-oauth/web-client.svg"
          />
        </li>
        <li className="space-y-2 pl-1">
          <p>
            Add this exact Authorized redirect URI: <Code>{DEFAULT_GOOGLE_REDIRECT_URI}</Code>. Use{" "}
            <Code>127.0.0.1</Code>, not localhost.
          </p>
          <Diagram
            alt="Wireframe of the Authorized redirect URIs field filled with http://127.0.0.1:4747/api/google/callback."
            src="/google-oauth/redirect-uri.svg"
          />
        </li>
        <li className="space-y-2 pl-1">
          <p>
            Copy <Code>.env.example</Code> to <Code>.env.local</Code> if you have not already. Paste
            the client ID and client secret. Set <Code>SESSION_SECRET</Code> to any long random string
            (for example the output of <Code>openssl rand -hex 32</Code>).{" "}
            <Code>OWNER_EMAIL</Code> is optional; if set, only that Google account can connect.
          </p>
          <Diagram
            alt="Wireframe of a .env.local file with SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and optional OWNER_EMAIL."
            src="/google-oauth/env-local.svg"
          />
        </li>
        <li className="space-y-2 pl-1">
          <p>
            Restart <Code>pnpm dev</Code>. Open <Code>{googleSettingsHref()}</Code> — not localhost —
            then press <strong>Connect Google</strong>.
          </p>
        </li>
      </ol>
    </div>
  );
}
