// src/server/email/mailer.ts

import 'server-only';

import nodemailer, { TransportOptions } from 'nodemailer';
import { getServerEnv } from '@/config/env';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Создаёт и настраивает Nodemailer transporter.
 * Автовыбор secure: если EMAIL_SECURE задан — используем его,
 * иначе считаем secure = (port === 465).
 */
function createTransporter() {
  const env = getServerEnv();
  const host = env.EMAIL_HOST ?? '';
  const port = parseInt(env.EMAIL_PORT ?? '465', 10);
  const user = env.EMAIL_USER ?? '';
  const pass = env.EMAIL_PASS ?? '';

  // если переменная не задана, то secure по умолчанию = true для 465, иначе false
  const secureEnv = env.EMAIL_SECURE;
  const secure =
      typeof secureEnv === 'string'
          ? secureEnv === 'true'
          : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,

    // снижает шанс подвисаний/повторных коннектов
    pool: true,
    maxConnections: 3,
    maxMessages: 50,

    // таймауты

    connectionTimeout: 10_000, // до установления TCP/TLS
    greetingTimeout: 10_000,   // ожидание SMTP greeting
    socketTimeout: 20_000,     // неактивность сокета

    // отключить строгую проверку сертификата
    tls: {
      rejectUnauthorized: false,
    },

    // лог только на dev
    logger: true,
    debug: true,
  } as TransportOptions);

  // в фоне верифицировать соединение (не блокирует send)
  transporter.verify().then(
      () => {
        console.log(
            `SMTP OK: host=${host} port=${port} secure=${secure} user=${user ? '[set]' : '[empty]'}`
        );
      },
      (err) => {
        console.warn('SMTP verify failed (will still try to send):', err?.message || err);
      }
  );

  console.log('Email config:', { host, port, user, secure });

  return transporter;
}

/**
 * Отправка письма.
 * ВАЖНО: Чтобы не блокировать бизнес-логику, мы НЕ бросаем исключения.
 * Ошибки только логируются.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = createTransporter();
  const env = getServerEnv();
  const from = env.EMAIL_FROM ?? 'CI Work <no-reply@ciwork.pro>';

  const mailData = {
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailData);
    console.log('Message sent:', info?.messageId || '[no id]');
  } catch (error) {
    // Не пробрасываем ошибку, чтобы создание задач/эндпоинты не падали.
    console.error('Error sending email (ignored):', error);
  }
}
