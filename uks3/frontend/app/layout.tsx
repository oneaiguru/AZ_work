import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import Footer from '@/components/Footer';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

const siteName = 'УКС Иркутск 2';
const baseUrl = 'https://uks.delightsoft.ru';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteName,
    template: `%s · ${siteName}`
  },
  description:
    'Альтернативный портал Управления капитального строительства Иркутска: проекты, закупки, документы и новости городской инфраструктуры.',
  icons: {
    icon: '/favicon.svg'
  },
  openGraph: {
    title: siteName,
    description:
      'Актуальные данные по городским стройкам, закупкам и инициативам. Удобный доступ к документации и контактам УКС Иркутска.',
    type: 'website',
    url: baseUrl,
    siteName,
    images: [
      {
        url: '/og-cover.svg',
        width: 1200,
        height: 630,
        alt: siteName
      }
    ]
  },
  alternates: {
    canonical: baseUrl
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-surface-muted text-slate-900`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
