"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";

/**
 * 부스 운영진 키보드 단축키 (UI에는 표시하지 않음).
 *  1     : 홈 + 자동 슬라이드 모드 토글 (켜기/끄기)
 *  H     : 홈 (수동 모드 — 휠/화살표로 직접 이동)
 *  2     : 참가 방법
 *  3     : 홈 (수동 모드)
 *  4     : 게임 룰
 *  Esc   : 홈 (수동 모드, 게임 진행 중에는 무시)
 *
 * 텍스트 입력 중이거나 게임 phase=playing일 때는 화면 전환 단축키를 차단.
 */
export function OperatorShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const phase = useGameStore((s) => s.state?.phase);
  const setLandingAutoMode = useGameStore((s) => s.setLandingAutoMode);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      const inGame = pathname?.startsWith("/game") && phase === "playing";

      if (key === "1") {
        if (inGame) return; // 게임 중엔 실수 방지
        e.preventDefault();
        const next = !useGameStore.getState().landingAutoMode;
        setLandingAutoMode(next);
        router.push("/");
        return;
      }
      if (key === "h") {
        if (inGame) return;
        e.preventDefault();
        setLandingAutoMode(false);
        router.push("/");
        return;
      }
      if (key === "2") {
        if (inGame) return;
        e.preventDefault();
        router.push("/conditions/");
        return;
      }
      if (key === "3") {
        if (inGame) return;
        e.preventDefault();
        setLandingAutoMode(false);
        router.push("/");
        return;
      }
      if (key === "4") {
        if (inGame) return;
        e.preventDefault();
        router.push("/rules/");
        return;
      }
      if (key === "escape") {
        if (inGame) return;
        e.preventDefault();
        setLandingAutoMode(false);
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, pathname, phase, setLandingAutoMode]);

  return null;
}
