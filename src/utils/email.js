/**
 * Email Notification Service
 * Uses Nodemailer with Gmail SMTP (swappable for SendGrid, etc.)
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Send an email
 * @param {Object} options - { to, subject, html, text }
 */
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email not configured — skipping send.');
    return null;
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `Worknoon Chat <noreply@worknoon.com>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Email send failed:', err.message);
    throw err;
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

async function sendNewMessageNotification({ recipientEmail, recipientName, senderName, preview, conversationId }) {
  return sendEmail({
    to: recipientEmail,
    subject: `New message from ${senderName} — Worknoon Chat`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px;">
        <h2 style="color: #6366f1;">You have a new message</h2>
        <p>Hi <strong>${recipientName}</strong>,</p>
        <p><strong>${senderName}</strong> sent you a message:</p>
        <blockquote style="border-left: 4px solid #6366f1; padding: 12px; background: #f9fafb; border-radius: 4px;">
          ${preview}
        </blockquote>
        <a href="${process.env.CLIENT_URL}/conversations/${conversationId}"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">
          View Conversation
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">Worknoon Chat · Unsubscribe</p>
      </div>
    `,
    text: `Hi ${recipientName}, ${senderName} sent you a message: "${preview}". View it at ${process.env.CLIENT_URL}/conversations/${conversationId}`,
  });
}

async function sendWelcomeEmail({ email, name }) {
  return sendEmail({
    to: email,
    subject: 'Welcome to Worknoon Chat!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px;">
        <h2 style="color: #6366f1;">Welcome aboard, ${name}!</h2>
        <p>Your Worknoon Chat account has been created.</p>
        <a href="${process.env.CLIENT_URL}/login"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">
          Get Started
        </a>
      </div>
    `,
    text: `Welcome ${name}! Your Worknoon Chat account has been created. Login at ${process.env.CLIENT_URL}/login`,
  });
}

module.exports = { sendEmail, sendNewMessageNotification, sendWelcomeEmail };
