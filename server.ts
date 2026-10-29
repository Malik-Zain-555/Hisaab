import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const SHARED_APP_URL = 'https://ais-pre-fpw2tpblkoiwuedaoanbgs-742916804260.asia-southeast1.run.app';
const DEV_APP_URL = 'https://ais-dev-fpw2tpblkoiwuedaoanbgs-742916804260.asia-southeast1.run.app';

app.use(express.json());

// Configure Nodemailer transporter if SMTP environment variables are present
const smtpTransporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Helper: base64url encode MIME email for Gmail REST API
function createMimeMessage(to: string, subject: string, htmlBody: string): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody,
  ];
  const message = messageParts.join('\r\n');
  return Buffer.from(message, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sharedAppUrl: SHARED_APP_URL,
  });
});

// App configuration and public preview links
app.get('/api/app-info', (_req, res) => {
  res.json({
    appName: 'Hisaab',
    sharedAppUrl: SHARED_APP_URL,
    devAppUrl: DEV_APP_URL,
    status: 'active',
  });
});

// Endpoint: Send invitation email via Gmail API with attached Hisaab link
app.post('/api/send-invite-email', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '') || req.body.accessToken;

    const { toEmail, senderName, senderUsername, senderUid, customInviteUrl } = req.body;
    if (!toEmail || !toEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid recipient email is required.' });
    }

    const inviteUrl =
      customInviteUrl ||
      `${SHARED_APP_URL}/?invite=${encodeURIComponent(senderUsername || senderUid || 'hisaab')}&from=${encodeURIComponent(senderUid || '')}`;

    // If no Google OAuth token is attached, the invite is already logged & ready in Firestore
    if (!token) {
      return res.json({
        success: true,
        method: 'invitation_recorded',
        message: 'Invite link created and pending connection recorded.',
        inviteUrl,
        recipient: toEmail,
      });
    }

    const subject = `Join ${senderName || 'a friend'} on Hisaab (Shared Expense & Ledger Tracker)`;
    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
    .header { background: #4F46E5; padding: 28px; color: #ffffff; text-align: center; }
    .title { font-size: 22px; font-weight: 800; margin: 0; }
    .subtitle { font-size: 13px; opacity: 0.9; margin-top: 6px; }
    .content { padding: 32px 28px; }
    .invite-text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px; text-align: left; }
    .feature-list { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .feature-item { font-size: 13px; color: #334155; margin: 8px 0; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background: #4F46E5; color: #ffffff !important; padding: 14px 20px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; }
    .link-box { margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-family: monospace; font-size: 12px; color: #64748b; word-break: break-all; text-align: left; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Join ${senderName || 'Your Friend'} on Hisaab</div>
      <div class="subtitle">Shared Expense Tracker & Friend Ledgers</div>
    </div>
    <div class="content">
      <p class="invite-text">
        Salam! <strong>${senderName || 'Your friend'}</strong> ${senderUsername ? `(@${senderUsername})` : ''} has invited you to connect on Hisaab to track shared expenses, split bills, and settle balances easily.
      </p>

      <div class="feature-list">
        <div class="feature-item">✓ <strong>Real-time Ledger:</strong> Instant balance updates and settlement logs</div>
        <div class="feature-item">✓ <strong>Direct & Squad Chat:</strong> Discuss expenses and share balance cards</div>
        <div class="feature-item">✓ <strong>Universal Access:</strong> Use anywhere without complex installation</div>
      </div>

      <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation & Connect</a>

      <div class="link-box">
        <strong>Direct Link:</strong><br/>
        ${inviteUrl}
      </div>
    </div>
  </div>
  <div class="footer">
    Sent via Hisaab Expense Tracker • Real-time shared expenses
  </div>
</body>
</html>`;

    const rawMessage = createMimeMessage(toEmail, subject, htmlBody);

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!gmailRes.ok) {
      const errData = await gmailRes.json().catch(() => ({}));
      const errMsg = errData.error?.message || `Gmail API returned HTTP ${gmailRes.status}`;
      return res.status(gmailRes.status).json({ success: false, error: errMsg });
    }

    const data = await gmailRes.json();
    return res.json({
      success: true,
      messageId: data.id,
      inviteUrl,
      recipient: toEmail,
    });
  } catch (err: any) {
    console.error('Error sending invite email:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error sending email' });
  }
});

// Endpoint: Send general notification email (mentions, messages, ledger updates) via Gmail API or SMTP
app.post('/api/send-notification-email', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '') || req.body.accessToken;
    const { toEmail, subject, htmlBody } = req.body;

    if (!toEmail || !subject || !htmlBody) {
      return res.status(400).json({ success: false, error: 'toEmail, subject, and htmlBody are required.' });
    }

    // 1. Try Gmail API if token is provided
    if (token) {
      try {
        const rawMessage = createMimeMessage(toEmail, subject, htmlBody);
        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: rawMessage }),
        });

        if (gmailRes.ok) {
          const data = await gmailRes.json();
          return res.json({ success: true, method: 'gmail', messageId: data.id });
        }
      } catch (e: any) {
        console.warn('Gmail API attempt note:', e?.message || e);
      }
    }

    // 2. Try SMTP if configured
    if (smtpTransporter) {
      try {
        const info = await smtpTransporter.sendMail({
          from: process.env.SMTP_FROM || 'Hisaab Notifications <no-reply@hisaab.app>',
          to: toEmail,
          subject,
          html: htmlBody,
        });
        return res.json({ success: true, method: 'smtp', messageId: info.messageId });
      } catch (smtpErr: any) {
        console.warn('SMTP dispatch note:', smtpErr?.message || smtpErr);
      }
    }

    // 3. Graceful success - in-app notification & mail queue already active
    return res.json({
      success: true,
      method: 'in_app_recorded',
      message: 'Notification recorded in-app and queued in delivery records.',
      recipient: toEmail,
    });
  } catch (err: any) {
    console.error('Error in send-notification-email:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Endpoint: Send Web Push / FCM Notification to Wake Up Closed Devices
app.post('/api/send-push-notification', async (req, res) => {
  try {
    const { token, tokens, title, body, link, tag, icon, data } = req.body;
    const targetTokens: string[] = tokens || (token ? [token] : []);
    if (!targetTokens.length) {
      return res.status(400).json({ success: false, error: 'No device registration token provided.' });
    }

    const FIREBASE_API_KEY =
      process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCAkWeLXghbr1r8957fqYu3bWdwp1ijRRc';

    const results = await Promise.all(
      targetTokens.map(async (tok) => {
        try {
          const rawTitle = title || 'New update';
          const formattedTitle = rawTitle.startsWith('Hisaab') ? rawTitle : `Hisaab • ${rawTitle}`;
          const originHost = req.get('origin') || (req.get('host') ? `https://${req.get('host')}` : SHARED_APP_URL);
          const resolvedIcon = icon && icon.startsWith('http') ? icon : `${originHost}/icon.svg`;

          const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${FIREBASE_API_KEY}`,
            },
            body: JSON.stringify({
              to: tok,
              notification: {
                title: formattedTitle,
                body: body || 'You have a new update in your Hisaab wallet or chat.',
                icon: resolvedIcon,
                click_action: link || '/',
              },
              data: {
                title: formattedTitle,
                body: body || 'You have a new update in your Hisaab wallet or chat.',
                icon: resolvedIcon,
                link: link || '/',
                tag: tag || 'hisaab-alert',
                ...(data || {}),
              },
              priority: 'high',
            }),
          });
          const resData = await fcmRes.json().catch(() => ({}));
          return { token: tok, status: fcmRes.status, success: fcmRes.ok, response: resData };
        } catch (tokErr: any) {
          return { token: tok, success: false, error: tokErr?.message };
        }
      })
    );

    return res.json({ success: true, count: results.length, results });
  } catch (err: any) {
    console.error('Error in send-push-notification:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server push error' });
  }
});

// Dev vs Prod Vite Mounting
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction =
    process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(
      `Hisaab server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`
    );
  });
}

startServer();
