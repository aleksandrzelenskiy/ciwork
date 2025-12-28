// app/api/sendMail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/server/email/mailer';

export async function GET() {
  // Пример: проверка, что роут жив
  return NextResponse.json(
    { message: 'GET sendMail is working' },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  console.log('POST /api/sendMail called!');

  try {
    // 1. Получаем тело запроса (JSON)
    const body = await request.json();
    console.log('Request body:', body);

    // 2. Извлекаем обязательные поля
    const { to, subject, text, html } = body;

    // 3. Проверяем, что поля не пустые
    if (!to || !subject || (!text && !html)) {
      console.warn('Missing required fields:', body);
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    // 4. Отправляем письмо
    await sendEmail({ to, subject, text, html });
    console.log('Email successfully sent to:', to);

    // 5. Возвращаем успешный ответ
    return NextResponse.json({ message: 'Email sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { message: 'Error sending email' },
      { status: 500 }
    );
  }
}
