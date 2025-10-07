import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { FAVICON_DATA_URI } from "@/lib/assets";

const inter = Inter({ subsets: ["cyrillic", "latin"] });

export const metadata: Metadata = {
  title: "УКС Иркутск — Управление капитального строительства",
  description:
    "Официальный сайт Управления капитального строительства г. Иркутска: проекты, закупки, документы и контакты для партнёров и жителей города.",
  metadataBase: new URL("https://uks.irkutsk.ru"),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "УКС Иркутск",
    "закупки Иркутск",
    "управление капитального строительства",
    "коммерческие помещения Иркутск",
    "муниципальные проекты",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://uks.irkutsk.ru",
    title: "УКС Иркутск",
    description:
      "Современная платформа для управления городскими проектами, закупками и коммерческими предложениями.",
  },
  icons: {
    icon: [
      {
        url: FAVICON_DATA_URI,
        rel: "icon",
        type: "image/x-icon",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
