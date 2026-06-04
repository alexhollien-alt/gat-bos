// /u/[token] -- one-click unsubscribe. Single URL for both the visible email
// link (GET, returns a confirmation page) and the RFC 8058 one-click header
// (POST, returns 200). Flips contacts.email_status to 'unsubscribed' instantly.
import { suppressByToken } from "@/lib/open-house/suppress";

/* eslint-disable no-restricted-syntax -- standalone HTML response (not an app
   component); canonical palette inlined as the source block, like email. */
function confirmationHtml(success: boolean): string {
  const ground = "#FCFBFB";
  const structure = "#192A56";
  const signal = "#F7D794";
  const body = success
    ? `<h1 style="font-size:22px;margin:0 0 10px 0;">You are unsubscribed.</h1>
       <p style="margin:0;opacity:0.8;">You will not receive any more open house emails from this list. This took effect immediately.</p>`
    : `<h1 style="font-size:22px;margin:0 0 10px 0;">Link not recognized.</h1>
       <p style="margin:0;opacity:0.8;">This unsubscribe link is invalid or expired. Reply to the email and we will remove you by hand.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribe</title></head>
    <body style="margin:0;background:${ground};color:${structure};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:96px 24px;text-align:center;">
        <div style="height:4px;width:44px;background:${signal};margin:0 auto 28px auto;border-radius:2px;"></div>
        ${body}
      </div>
    </body></html>`;
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const result = await suppressByToken(params.token, "one-click unsubscribe (POST)");
  // RFC 8058: one-click expects a 200 regardless; never reveal contact details.
  return new Response(result.ok ? "Unsubscribed" : "Not found", {
    status: result.ok ? 200 : 404,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const result = await suppressByToken(params.token, "unsubscribe link (GET)");
  return new Response(confirmationHtml(result.ok), {
    status: result.ok ? 200 : 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
