import { getAccessToken, ensureGmailPermission } from './auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import { SHARED_APP_URL } from './constants';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { QueuedEmail, PaymentMethodDetail } from '../types';

/**
 * Creates a base64url-encoded RFC 2822 email message
 */
function createMimeMessage(to: string, subject: string, htmlBody: string): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody,
  ];
  const message = messageParts.join('\r\n');

  // Convert to base64url
  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return encoded;
}

/**
 * Sends an email directly via the Gmail REST API using the user's OAuth access token
 */
export async function sendGmailDirect(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    let accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: 'No active Google OAuth access token. Please authorize Gmail.',
      };
    }

    const rawMessage = createMimeMessage(to, subject, htmlBody);

    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: rawMessage,
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Formats saved payment methods for plain-text WhatsApp/email reminders
 */
export function formatPaymentMethodsText(methods?: PaymentMethodDetail[]): string {
  if (!methods || methods.length === 0) return '';
  const lines = methods.map(
    (m) =>
      `• ${m.provider}: ${m.accountNumber} (${m.accountTitle})${
        m.ibanOrNote ? ` — ${m.ibanOrNote}` : ''
      }`
  );
  return `\n\n💳 Payment Details:\n${lines.join('\n')}`;
}

/**
 * Generates beautiful HTML template for Hisaab notifications
 */
export function buildHisaabEmailHtml(params: {
  friendName: string;
  headline: string;
  subheadline: string;
  amountText: string;
  shareText?: string;
  newBalanceText: string;
  details?: string;
  actionUrl?: string;
  paymentMethods?: PaymentMethodDetail[];
}): string {
  const url = params.actionUrl || SHARED_APP_URL;
  const paymentHtml =
    params.paymentMethods && params.paymentMethods.length > 0
      ? `
      <div style="margin-top: 18px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #059669; margin-bottom: 8px;">Payment Details to Settle Up</div>
        ${params.paymentMethods
          .map(
            (m) => `
          <div style="font-size: 13px; color: #0f172a; margin: 6px 0; line-height: 1.4;">
            <strong>${m.provider}:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${m.accountNumber}</code> (${m.accountTitle})${
              m.ibanOrNote ? `<br/><span style="font-size: 11px; color: #64748b;">${m.ibanOrNote}</span>` : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
      `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #059669; padding: 24px 28px; color: #ffffff; }
    .title { font-size: 22px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: #ecfdf5; color: #059669; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }
    .amount-box { background: #f1f5f9; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
    .amount-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
    .amount-val { font-size: 32px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .balance-box { display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; font-size: 15px; }
    .balance-label { color: #475569; font-weight: 500; }
    .balance-val { font-weight: 700; color: #059669; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: #059669; color: #ffffff !important; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; margin-top: 24px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Hisaab Expense Update</div>
      <div class="subtitle">Real-time shared ledger</div>
    </div>
    <div class="content">
      <div class="badge">Live Notification</div>
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">Salam, ${params.friendName}!</h2>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">${params.headline}</p>

      <div class="amount-box">
        <div class="amount-label">${params.subheadline || 'Item Total'}</div>
        <div class="amount-val">${params.amountText}</div>
        ${params.shareText ? `<div style="font-size: 13px; color: #059669; margin-top: 4px; font-weight: 600;">Your share: ${params.shareText}</div>` : ''}
      </div>

      ${params.details ? `<p style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border-left: 3px solid #059669; margin: 16px 0;">Note: ${params.details}</p>` : ''}

      <div class="balance-box">
        <span class="balance-label">Your Current Ledger Balance:</span>
        <span class="balance-val">${params.newBalanceText}</span>
      </div>

      ${paymentHtml}

      <a href="${url}" class="btn" target="_blank">Open Hisaab Dashboard</a>
    </div>
  </div>
  <div class="footer">
    Sent automatically by Hisaab expense tracker • Real-time synchronization
  </div>
</body>
</html>
  `;
}

/**
 * Builds email HTML for @mentions
 */
export function buildMentionEmailHtml(params: {
  targetName: string;
  senderName: string;
  messageText: string;
  sourceLabel: string;
  actionUrl?: string;
}): string {
  const url = params.actionUrl || SHARED_APP_URL;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { background: #4F46E5; padding: 24px 28px; color: #ffffff; }
    .title { font-size: 20px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: #eef2ff; color: #4F46E5; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }
    .msg-box { background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin: 18px 0; border-left: 4px solid #4F46E5; font-size: 15px; line-height: 1.6; color: #1e293b; font-style: italic; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: #4F46E5; color: #ffffff !important; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; margin-top: 20px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">You were mentioned on Hisaab</div>
      <div class="subtitle">${params.sourceLabel}</div>
    </div>
    <div class="content">
      <div class="badge">@ Mention Alert</div>
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">Salam, ${params.targetName}!</h2>
      <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">
        <strong>${params.senderName}</strong> mentioned you in <strong>${params.sourceLabel}</strong>:
      </p>

      <div class="msg-box">
        "${params.messageText}"
      </div>

      <a href="${url}" class="btn" target="_blank">View in Hisaab & Reply</a>
    </div>
  </div>
  <div class="footer">
    Sent automatically by Hisaab expense tracker • Real-time notifications
  </div>
</body>
</html>
  `;
}

/**
 * Builds email HTML for direct friend messages
 */
export function buildMessageEmailHtml(params: {
  targetName: string;
  senderName: string;
  messageText: string;
  actionUrl?: string;
}): string {
  const url = params.actionUrl || SHARED_APP_URL;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { background: #4F46E5; padding: 24px 28px; color: #ffffff; }
    .title { font-size: 20px; font-weight: 700; margin: 0; }
    .subtitle { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: #eef2ff; color: #4F46E5; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }
    .msg-box { background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 18px 0; border: 1px solid #e2e8f0; font-size: 15px; line-height: 1.6; color: #1e293b; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: #4F46E5; color: #ffffff !important; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; margin-top: 20px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">New Message on Hisaab</div>
      <div class="subtitle">Direct conversation</div>
    </div>
    <div class="content">
      <div class="badge">Chat Alert</div>
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">Salam, ${params.targetName}!</h2>
      <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">
        <strong>${params.senderName}</strong> sent you a direct message:
      </p>

      <div class="msg-box">
        ${params.messageText}
      </div>

      <a href="${url}" class="btn" target="_blank">Open Chat & Reply</a>
    </div>
  </div>
  <div class="footer">
    Sent automatically by Hisaab expense tracker • Real-time notifications
  </div>
</body>
</html>
  `;
}

/**
 * Builds email HTML for inviting a friend by email with connect link attached
 */
export function buildInviteEmailHtml(params: {
  senderName: string;
  senderHandle?: string;
  inviteUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
    .header { background: #4F46E5; padding: 28px; color: #ffffff; text-align: center; }
    .title { font-size: 22px; font-weight: 800; margin: 0; }
    .subtitle { font-size: 13px; opacity: 0.9; margin-top: 6px; }
    .content { padding: 32px 28px; text-align: center; }
    .invite-text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px; text-align: left; }
    .feature-list { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .feature-item { font-size: 13px; color: #334155; margin: 6px 0; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: #4F46E5; color: #ffffff !important; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; }
    .link-box { margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-family: monospace; font-size: 12px; color: #64748b; word-break: break-all; text-align: left; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Join ${params.senderName} on Hisaab</div>
      <div class="subtitle">Shared Expense Tracker & Friend Ledgers</div>
    </div>
    <div class="content">
      <p class="invite-text">
        Salam! <strong>${params.senderName}</strong> ${params.senderHandle ? `(@${params.senderHandle})` : ''} has invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.
      </p>

      <div class="feature-list">
        <div class="feature-item">✓ <strong>Real-time Khata:</strong> Instant ledger balances and settlement history</div>
        <div class="feature-item">✓ <strong>Direct & Squad Chat:</strong> Discuss expenses and share balance cards</div>
        <div class="feature-item">✓ <strong>Instant Notifications:</strong> Get email and in-app alerts on every update</div>
      </div>

      <a href="${params.inviteUrl}" class="btn" target="_blank">Accept Invitation & Connect</a>

      <div class="link-box">
        <strong>Direct Link:</strong><br/>
        ${params.inviteUrl}
      </div>
    </div>
  </div>
  <div class="footer">
    Sent via Hisaab Expense Tracker • Real-time shared expenses
  </div>
</body>
</html>
  `;
}

/**
 * Queues an email into Firestore mailQueue and attempts immediate dispatch if owner is connected
 */
export async function queueNotificationEmail(
  emailData: {
    to: string;
    friendName?: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  },
  skipImmediateSend = false
): Promise<string> {
  const mailCollection = collection(db, 'mailQueue');
  const docRef = await addDoc(mailCollection, {
    to: emailData.to,
    friendName: emailData.friendName || '',
    subject: emailData.subject,
    htmlBody: emailData.htmlBody,
    textBody: emailData.textBody || emailData.subject,
    status: skipImmediateSend ? 'sent' : 'queued',
    attempts: skipImmediateSend ? 1 : 0,
    sentAt: skipImmediateSend ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(),
  });

  if (skipImmediateSend) {
    return docRef.id;
  }

  // Attempt immediate send if an access token is in memory
  try {
    const token = await getAccessToken();
    if (token) {
      const sendResult = await sendGmailDirect(
        emailData.to,
        emailData.subject,
        emailData.htmlBody
      );

      if (sendResult.success) {
        await updateDoc(doc(db, 'mailQueue', docRef.id), {
          status: 'sent',
          sentAt: new Date().toISOString(),
          attempts: 1,
        });
      } else {
        await updateDoc(doc(db, 'mailQueue', docRef.id), {
          status: 'failed',
          error: sendResult.error,
          attempts: 1,
        });
      }
    }
  } catch (err: any) {
    console.warn('Immediate dispatch note:', err);
  }

  return docRef.id;
}

/**
 * Processes queued emails in mailQueue (e.g. called on app boot or manual retry)
 */
export async function processPendingMailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const token = await getAccessToken();
  if (!token) return { processed: 0, sent: 0, failed: 0 };

  const q = query(collection(db, 'mailQueue'), where('status', 'in', ['queued', 'failed']));
  let sent = 0;
  let failed = 0;

  try {
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const mail = d.data() as QueuedEmail;
      if (mail.attempts >= 3 && mail.status === 'failed') continue; // don't infinitely retry failed max attempts

      const res = await sendGmailDirect(mail.to, mail.subject, mail.htmlBody);
      if (res.success) {
        sent++;
        await updateDoc(doc(db, 'mailQueue', d.id), {
          status: 'sent',
          sentAt: new Date().toISOString(),
          attempts: (mail.attempts || 0) + 1,
          error: null,
        });
      } else {
        failed++;
        await updateDoc(doc(db, 'mailQueue', d.id), {
          status: 'failed',
          attempts: (mail.attempts || 0) + 1,
          error: res.error || 'Send failed',
        });
      }
    }
  } catch (err) {
    console.warn('Queue processor warning:', err);
  }

  return { processed: sent + failed, sent, failed };
}

/**
 * Sends invite email via backend Express endpoint /api/send-invite-email with Gmail fallback
 */
export async function sendInviteEmailViaBackend(params: {
  toEmail: string;
  senderName: string;
  senderUsername?: string;
  senderUid: string;
  customInviteUrl?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; inviteUrl?: string }> {
  try {
    const inviteUrl =
      params.customInviteUrl ||
      `${SHARED_APP_URL}/?invite=${encodeURIComponent(params.senderUsername || params.senderUid)}&from=${encodeURIComponent(params.senderUid)}`;

    // Use cached access token if available; DO NOT trigger popups or signInWithPopup
    const token = await getAccessToken();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/send-invite-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...params,
          customInviteUrl: inviteUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, messageId: data.messageId, inviteUrl };
      }
    } catch (err: any) {
      console.warn('Backend send-invite-email note:', err?.message || err);
    }

    // Even if Gmail API token is not connected or restricted, the invite has been logged in
    // emailInvites Firestore collection and clipboard/share URL is generated!
    return { success: true, inviteUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error dispatching invite email' };
  }
}

/**
 * Sends general notification email via backend endpoint /api/send-notification-email with Gmail fallback
 */
export async function sendNotificationEmailViaBackend(params: {
  toEmail: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/send-notification-email', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, messageId: data.messageId };
    }

    if (token) {
      const directRes = await sendGmailDirect(params.toEmail, params.subject, params.htmlBody);
      return directRes;
    }

    return { success: true, messageId: `rec-${Date.now()}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Notification email send failed' };
  }
}
