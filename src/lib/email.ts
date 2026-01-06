/*
 * @Date: 2026-01-06 19:46:55
 * @Author: Sube
 * @FilePath: email.ts
 * @LastEditTime: 2026-01-06 19:47:30
 * @Description: 
 */

import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465, // Default to 465 for secure
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email using the configured SMTP server
 */
export async function sendEmail({ to, subject, text, html }: SendMailOptions) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('SMTP settings not configured. Email not sent:', { to, subject });
    // In dev, maybe log the content?
    if (process.env.NODE_ENV === 'development') {
        console.log('--- EMAIL DEBUG ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text: ${text}`);
        console.log('-------------------');
    }
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"MinPic" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send a verification code to the user
 */
export async function sendVerificationCode(to: string, code: string, type: 'register' | 'reset') {
  const isRegister = type === 'register';
  const action = isRegister ? '注册账号' : '重置密码';
  
  const text = `【MinPic】您的验证码是: ${code}。您正在进行${action}操作，5分钟内有效。如非本人操作，请忽略本邮件。`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #333; text-align: center;">MinPic ${action}</h2>
      <p style="color: #666; font-size: 16px;">您好，</p>
      <p style="color: #666; font-size: 16px;">您正在申请${action}，验证码如下：</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; color: #0070f3; letter-spacing: 4px;">${code}</span>
      </div>
      <p style="color: #999; font-size: 14px;">该验证码 5 分钟内有效。</p>
      <p style="color: #999; font-size: 14px;">如果您没有通过 MinPic 进行此操作，请忽略此邮件。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #ccc; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} MinPic</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `【MinPic】${code} 是您的${action}验证码`,
    text,
    html,
  });
}
