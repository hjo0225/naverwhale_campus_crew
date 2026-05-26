import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Toast } from "@/components/ui/Toast";
import { OperatorShortcuts } from "@/components/ui/OperatorShortcuts";
import { FullscreenButton } from "@/components/ui/FullscreenButton";

export const metadata: Metadata = {
  title: "Naver Campus Crew",
  description: "네이버 웨일 캠퍼스크루 부스 게임",
  // iOS Safari — '홈 화면에 추가' 시 PWA 모드(주소창/하단바 숨김)로 실행.
  appleWebApp: {
    capable: true,
    title: "Naver Campus Crew",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // 노치/홈 인디케이터 영역까지 활용 — 진짜 전체화면 느낌.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        {children}
        <Toast />
        <OperatorShortcuts />
        <FullscreenButton />
      </body>
    </html>
  );
}
