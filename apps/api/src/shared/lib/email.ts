import type { Bindings } from "../../config/env";

/** Resend'in basit HTTP API'si — SDK gerekmiyor, tek bir fetch. */
export async function sendEmail(env: Bindings, params: { to: string; subject: string; html: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend_send_failed: ${await response.text()}`);
  }
}
