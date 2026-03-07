'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', fontFamily: 'sans-serif' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Алдаа гарлаа</h2>
          <p style={{ color: '#6b7280' }}>Системд алдаа гарлаа. Дахин оролдоно уу.</p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Дахин оролдох
          </button>
        </div>
      </body>
    </html>
  );
}
