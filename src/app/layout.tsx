import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "./_components/Nav";
import { BUILD_ID } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "네이버 시세 인텔리전스",
  description: "진주 전기자재·조명 도소매 — 내 판매가 vs 네이버 시세 격차·권장가·마진 리포트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-800">
        <Nav />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          주 1회 자동 스캔 · 다나와식 카탈로그 분류 · BUILD {BUILD_ID}
        </footer>
      </body>
    </html>
  );
}
