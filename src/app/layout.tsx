import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { CompanyThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase';
import { InactivityLogout } from '@/components/inactivity-logout';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Nege Systems',
  description: 'Жижиг компаниудад зориулсан хүний нөөцийн иж бүрэн систем.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      </head>
      <body suppressHydrationWarning className={`${inter.variable} font-body antialiased`}>
        <FirebaseClientProvider>
          <CompanyThemeProvider>
            {children}
            <Toaster />
            <InactivityLogout />
          </CompanyThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
