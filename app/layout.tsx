import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#147aff" };

export const metadata: Metadata = {
  title: "天途 CRM · 移动工作台",
  description: "移动销售工作台：管理客户、记录跟进、安排待办，让每一次连接更有价值。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
