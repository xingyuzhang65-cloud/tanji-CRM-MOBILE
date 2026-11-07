import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#096fff" };

export const metadata: Metadata = {
  title: "天途 CRM · 移动工作台",
  applicationName: "天途 CRM",
  description: "移动客户管理、跟进待办、询报价与运单工作台。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "天途 CRM", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
