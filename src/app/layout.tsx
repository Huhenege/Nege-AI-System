import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { CompanyThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase';
import { InactivityLogout } from '@/components/inactivity-logout';
import { TenantProvider } from '@/contexts/tenant-context';
import { PWARegister } from '@/components/pwa-register';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Nege Systems',
  description: 'Жижиг компаниудад зориулсан хүний нөөцийн иж бүрэн систем.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nege Systems',
  },
};

export const viewport: Viewport = {
  themeColor: '#ff0000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body suppressHydrationWarning className={`${inter.variable} font-body antialiased`}>
        <FirebaseClientProvider>
          <TenantProvider>
            <CompanyThemeProvider>
              {children}
              <Toaster />
              <InactivityLogout />
              <PWARegister />
            </CompanyThemeProvider>
          </TenantProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
