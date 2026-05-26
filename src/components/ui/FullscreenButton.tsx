"use client";

import { useEffect, useState } from "react";

/**
 * 모바일 전체화면 토글 버튼 (우상단 floating).
 *
 * - 데스크톱(부스 PC) 에서는 CSS 미디어 쿼리로 자동 숨김.
 *   부스 PC 는 운영진이 이미 F11 로 풀스크린 진입하므로 노이즈 X.
 * - Android Chrome / Edge / Samsung Internet / Firefox / iOS 16.4+ Safari:
 *   표준 Fullscreen API (또는 webkit 접두사) 로 진짜 전체화면.
 * - iOS 16.4 미만 Safari: 표준 API 가 document 에 없음 → "홈 화면에 추가" 안내.
 *   (manifest + apple-mobile-web-app-capable 메타 로 PWA 모드는 진짜 풀스크린)
 *
 * 사용자 제스처 안에서만 동작하므로 onClick 핸들러 안에서 즉시 호출한다.
 */

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFsElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FsDoc;
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function FullscreenButton() {
  // SSR 시 window 접근 불가 — 마운트 후에만 렌더해 hydration 불일치 회피.
  const [mounted, setMounted] = useState(false);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setIsFs(!!getFsElement());
    sync();
    // 표준 + webkit 양쪽 이벤트 — 사파리는 webkit 만 발화하는 경우가 있음.
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = async () => {
    const d = document as FsDoc;
    const el = document.documentElement as FsElement;

    try {
      if (getFsElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
        return;
      }

      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else {
        // iOS 16.4 미만 Safari 등 — API 자체 없음.
        alert(
          "이 브라우저는 전체화면을 지원하지 않습니다.\n" +
            "공유 → '홈 화면에 추가' 후 아이콘으로 열면 전체화면으로 실행돼요.",
        );
      }
    } catch {
      // 사용자 제스처 미충족 / 권한 거부 — 조용히 무시 (UX 노이즈 방지).
    }
  };

  // 전체화면 진입 시에는 버튼 자체를 숨김 (해제는 OS/브라우저 제스처로).
  if (!mounted || isFs) return null;

  return (
    <button
      type="button"
      className="fs-toggle-btn"
      onClick={() => void toggle()}
      aria-label="전체화면 보기"
      title="전체화면"
    >
      <span className="fs-toggle-btn-icon" aria-hidden>
        ⛶
      </span>
      <span className="fs-toggle-btn-text">전체화면</span>
    </button>
  );
}
