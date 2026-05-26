"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { deriveEndReason } from "@/lib/game/rules";
import { playBgm, stopBgm } from "@/lib/audio/sounds";
import { GameBoard } from "./GameBoard";
import { FinalResultScreen } from "./FinalResultScreen";
import { EndSplash } from "./EndSplash";

const SPLASH_MS = 3000;

export function GameScreen() {
  const state = useGameStore((s) => s.state);
  const startTutorialGame = useGameStore((s) => s.startTutorialGame);
  const [splashShown, setSplashShown] = useState(false);
  // 첫 마운트 1회만 자동 시작 — 튜토리얼로 부팅, 5턴 후 자유 플레이로 자연 전환.
  // "처음으로" 클릭 시 navigation 중 reset 으로 state=null 이 되더라도 여기서
  // 다시 게임을 만들면 안 된다.
  const initedRef = useRef(false);

  useEffect(() => {
    if (!state && !initedRef.current) {
      initedRef.current = true;
      startTutorialGame();
    }
  }, [state, startTutorialGame]);

  // BGM: playing → 게임 BGM 루프. finished → 정지(결과 화면이 자체 BGM 트리거).
  // 화면 떠날 때 stop.
  useEffect(() => {
    if (state?.phase === "playing") {
      playBgm("game");
    } else if (state?.phase === "finished") {
      stopBgm();
    }
    return () => {
      stopBgm();
    };
  }, [state?.phase]);

  // 종료 phase 진입 시 1.8s splash 후 결과 화면 전이
  useEffect(() => {
    if (state?.phase === "finished") {
      setSplashShown(true);
      const t = setTimeout(() => setSplashShown(false), SPLASH_MS);
      return () => clearTimeout(t);
    }
    setSplashShown(false);
  }, [state?.phase]);

  if (!state) return null;

  if (state.phase === "finished") {
    if (splashShown) {
      const reason = deriveEndReason(state.players);
      return (
        <>
          <GameBoard />
          {reason && <EndSplash reason={reason} />}
        </>
      );
    }
    return <FinalResultScreen />;
  }

  return <GameBoard />;
}
