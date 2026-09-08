import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing) — skipped email to ${to}: "${subject}"`);
    return;
  }
  await t.sendMail({
    from: `"ClickUp Clone" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export function buildInviteUrl(token: string): string {
  return `${FRONTEND_URL}/invite/${token}`;
}

export async function sendInviteEmail(opts: {
  to: string;
  workspaceName: string;
  inviterName: string;
  token: string;
}): Promise<void> {
  const link = buildInviteUrl(opts.token);
  await sendEmail(
    opts.to,
    `${opts.inviterName} invited you to join ${opts.workspaceName} on ClickUp Clone`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #101828;">You've been invited!</h2>
        <p style="color: #667085; font-size: 15px; line-height: 1.5;">
          <strong>${opts.inviterName}</strong> invited you to join <strong>${opts.workspaceName}</strong> on ClickUp Clone.
        </p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #6D4FE0; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review &amp; accept invite
          </a>
        </p>
        <p style="color: #98A2B3; font-size: 12px;">You'll be asked to confirm before joining. This invite expires in 7 days — if you didn't expect it, you can ignore this email.</p>
      </div>
    `,
  );
}

/** The 6-digit two-factor code. `purpose` only tweaks the wording. */
export async function sendOtpEmail(opts: {
  to: string;
  code: string;
  purpose: 'enable' | 'disable' | 'login';
}): Promise<void> {
  const heading =
    opts.purpose === 'login' ? 'Your sign-in code'
    : opts.purpose === 'enable' ? 'Confirm two-factor authentication'
    : 'Confirm turning off two-factor authentication';
  const line =
    opts.purpose === 'login' ? 'Use this code to finish signing in to ClickUp Clone.'
    : opts.purpose === 'enable' ? 'Enter this code to turn on two-factor authentication.'
    : 'Enter this code to turn off two-factor authentication.';

  await sendEmail(
    opts.to,
    `${heading} — ${opts.code}`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #101828;">${heading}</h2>
        <p style="color: #667085; font-size: 15px; line-height: 1.5;">${line}</p>
        <p style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #101828; margin: 24px 0;">
          ${opts.code}
        </p>
        <p style="color: #98A2B3; font-size: 12px;">
          This code expires in 5 minutes and can only be used once. If you didn't request it, you can ignore this email.
        </p>
      </div>
    `,
  );
}

export async function sendAddedToWorkspaceEmail(opts: {
  to: string;
  workspaceName: string;
  inviterName: string;
}): Promise<void> {
  const link = `${FRONTEND_URL}/login`;
  await sendEmail(
    opts.to,
    `${opts.inviterName} added you to ${opts.workspaceName} on ClickUp Clone`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #101828;">You're in!</h2>
        <p style="color: #667085; font-size: 15px; line-height: 1.5;">
          <strong>${opts.inviterName}</strong> added you to <strong>${opts.workspaceName}</strong> on ClickUp Clone.
        </p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #6D4FE0; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Log in to see it
          </a>
        </p>
      </div>
    `,
  );
}
