"use client";

import { useEffect, useState } from "react";

/**
 * 모바일 전체화면 진입 버튼 (좌하단 floating) + sticky 자동 재진입.
 *
 * 동작:
 * 1) 첫 마운트: 버튼 노출.
 * 2) 사용자가 한 번 탭 → fullscreen 진입 + sessionStorage 에 intent 저장 +
 *    버튼 영구 숨김(이번 세션 한정, 새로고침/탭 종료까지).
 * 3) 이후 iOS Safari 가 history 이동 시 fullscreen 을 강제 해제해도
 *    capture 단계 click/touchend 리스너가 같은 user-gesture 안에서
 *    requestFullscreen 을 재요청 → 화면 전환과 동시에 자동 복구.
 * 4) 사용자가 어떤 동작을 하더라도 풀스크린 풀리지 않음(부스 운영 의도).
 *    완전 해제는 탭 새로고침/종료만 가능.
 *
 * 데스크톱(부스 PC) 에서는 CSS @media 로 숨김 — 운영진은 F11 사용.
 * iOS 16.4 미만 Safari 처럼 Fullscreen API 자체가 없으면 '홈 화면에 추가' 안내.
 */

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const INTENT_KEY = "fs-intent";

function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

function isFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

async function requestFs(): Promise<boolean> {
  const el = document.documentElement as FsElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // user gesture 미충족 / 권한 거부 — 조용히 무시.
  }
  return false;
}

function getIntent(): boolean {
  try {
    return sessionStorage.getItem(INTENT_KEY) === "1";
  } catch {
    return false;
  }
}
function setIntent(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(INTENT_KEY, "1");
    else sessionStorage.removeItem(INTENT_KEY);
  } catch {
    // private mode 등 — 무시
  }
}

export function FullscreenButton() {
  const [mounted, setMounted] = useState(false);
  // intent 가 true 면 이번 세션 동안 버튼은 다시 등장하지 않음.
  const [intent, setIntentState] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 새로고침/뒤로가기로 재진입한 경우에도 직전 상태 복원.
    setIntentState(getIntent());
  }, []);

  // 화면 전환 후 자동 재진입.
  // 어떤 click/touch 든 user gesture 이므로 fullscreen 정책 통과.
  // capture phase 로 일찍 잡아 Link/Button 핸들러보다 먼저 fullscreen 큐잉.
  //
  // 현재 fullscreen 상태에서도 무조건 큐잉해야 한다 — bubble phase 의 router.push /
  // <Link> 가 history.pushState 를 일으키면 iOS Safari 가 fullscreen 을 해제하는데,
  // 그 시점엔 이미 user activation 이 만료돼 다음 탭까지 회복 불가. 같은 gesture
  // 안에서 미리 큐잉해두면 해제 직후 자동 재진입.
  // (requestFullscreen 은 이미 fullscreen 이면 spec 상 no-op 으로 즉시 resolve.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onAnyPointer() {
      if (!getIntent()) return;
      if (!isFullscreenSupported()) return;
      void requestFs();
    }
    document.addEventListener("click", onAnyPointer, true);
    document.addEventListener("touchend", onAnyPointer, true);
    return () => {
      document.removeEventListener("click", onAnyPointer, true);
      document.removeEventListener("touchend", onAnyPointer, true);
    };
  }, []);

  // 핵심: <Link>/router.push 같은 SPA 네비게이션은 iOS 가 fullscreen 을 강제 해제하는데,
  // capture 클릭 단계의 재요청은 "아직 fullscreen" 이라 no-op 이라 해제를 못 막는다.
  // 그래서 '해제된 순간'(fullscreenchange)을 직접 잡아 즉시 재진입한다 — 직전 클릭의
  // transient activation(~5s)이 살아 있어 화면 전환 직후 자동 복구된다.
  // (부스 의도: intent 설정 후엔 어떤 동작으로도 풀스크린이 풀리지 않게 유지.)
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onFsChange() {
      if (!getIntent()) return;
      if (isFullscreenActive()) return; // 다시 fullscreen 이면 할 일 없음(루프 방지)
      if (!isFullscreenSupported()) return;
      void requestFs();
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const onClick = async () => {
    // 한 번 의도하면 끝 — 즉시 영구 숨김 처리.
    setIntent(true);
    setIntentState(true);
    const ok = await requestFs();
    if (!ok) {
      // Fullscreen API 자체가 없는 환경 — iOS 16.4 미만 등.
      setIntent(false);
      setIntentState(false);
      alert(
        "이 브라우저는 전체화면을 지원하지 않습니다.\n" +
          "공유 → '홈 화면에 추가' 후 아이콘으로 열면 전체화면으로 실행돼요.",
      );
    }
  };

  // 미마운트 / 이미 intent 설정됨 → 버튼 숨김 (영구).
  if (!mounted || intent) return null;

  return (
    <button
      type="button"
      className="fs-toggle-btn"
      onClick={() => void onClick()}
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
