'use client';

import { useState } from 'react';
import { withBasePath } from '@/utils/basePath';

export default function TestSendMailPage() {
  const [status, setStatus] = useState('');

  const handleSendMail = async () => {
    const requestBody = {
      to: 'bigmount@yandex.ru',
      subject: 'Test from Next.js client',
      text: 'Hello from our Next.js app!',
    };

    try {
      const response = await fetch(withBasePath('/api/sendMail'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setStatus(`Error ${response.status}: ${errorData.message}`);
        return;
      }

      const data = await response.json();
      setStatus(`Success: ${data.message}`);
    } catch (err: unknown) {
      // Проверяем, действительно ли err - это объект класса Error
      if (err instanceof Error) {
        setStatus(`Fetch error: ${err.message}`);
      } else {
        setStatus('Fetch error: An unknown error occurred');
      }
    }
  };

  return (
    <div>
      <h1>Test Send Mail</h1>
      <button onClick={handleSendMail}>Send Mail</button>
      <p>{status}</p>
    </div>
  );
}
