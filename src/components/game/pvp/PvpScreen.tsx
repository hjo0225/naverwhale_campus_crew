"use client";

import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "@/lib/pvp/rtdb";
import { usePvpStore } from "@/lib/store/pvpStore";
import { deriveEndReason } from "@/lib/game/rules";
import type { Player } from "@/lib/game/types";
import type { AbortReason } from "@/lib/pvp/schema";
import { playBgm, playSfx, stopBgm } from "@/lib/audio/sounds";
import { EndSplash } from "@/components/game/EndSplash";
import { PvpBoard } from "./PvpBoard";
import { PvpLobby } from "./PvpLobby";
import { PvpResultScreen } from "./PvpResultScreen";
import { PvpWaitingRoom } from "./PvpWaitingRoom";

const SPLASH_MS = 3000;
/** abort 모달 자동 닫고 lobby 로 복귀하기까지의 시간 (ms). */
const ABORT_AUTO_LEAVE_MS = 3000;

export default function PvpScreen() {
  const phase = usePvpStore((s) => s.phase);
  const room = usePvpStore((s) => s.room);
  const init = usePvpStore((s) => s.init);
  const wake = usePvpStore((s) => s.wake);
  const [splashShown, setSplashShown] = useState(false);

  useEffect(() => {
    if (isFirebaseConfigured()) void init();
  }, [init]);

  // 종료 phase 진입 시 SPLASH_MS 동안 EndSplash 노출 후 결과 화면 전이.
  useEffect(() => {
    if (phase === "finished") {
      setSplashShown(true);
      const t = setTimeout(() => setSplashShown(false), SPLASH_MS);
      return () => clearTimeout(t);
    }
    setSplashShown(false);
  }, [phase]);

  // PvP BGM — playing 동안 게임 BGM. finished 진입 시 정지(PvpResultScreen이 자체 BGM 트리거).
  useEffect(() => {
    if (phase === "playing") {
      playBgm("game");
    } else if (phase === "finished" || phase === "aborted") {
      stopBgm();
    }
    return () => {
      stopBgm();
    };
  }, [phase]);

  // PvP SFX — 다른 플레이어가 카드 내기/뽑기/그만하기를 했을 때 트리거.
  // RTDB로 동기화된 players[*].lastAction 의 변화를 감지. 각 (uid, actionType)별 1회.
  const lastActionSigsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const players = (room?.state?.players ?? []) as unknown as Player[];
    if (players.length === 0 || phase !== "playing") return;
    const seen = lastActionSigsRef.current;
    for (const p of players) {
      const action = p.lastAction;
      if (!action) continue;
      // 시그니처: type + (play 시 카드 uid 또는 round-idx)로 동일 액션 중복 트리거 방지.
      const sig =
        action.type === "play"
          ? `play:${action.card.uid}`
          : `${action.type}:${(p.hand?.length ?? 0)}`;
      const prev = seen.get(p.name);
      if (prev === sig) continue;
      seen.set(p.name, sig);
      // 첫 스냅샷(이전 값 없음)에서는 사운드 트리거 X — 방 입장 직후 폭주 방지.
      if (prev === undefined) continue;
      if (action.type === "play") {
        playSfx(action.card.id === "L" ? "llama" : "cardPlay");
      } else if (action.type === "draw") {
        playSfx("cardDraw");
      } else if (action.type === "quit") {
        playSfx("quit");
      }
    }
  }, [room?.state?.players, phase]);

  // phase 전이 기반 SFX — playing 진입 시 셔플, finished 진입 시 라운드 종료.
  const prevPhaseRef = useRef<typeof phase | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== "playing" && phase === "playing") {
      playSfx("shuffle");
    } else if (prev === "playing" && phase === "finished") {
      playSfx("roundEnd");
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // 방을 떠나면 시그니처 초기화 — 다음 방에서 잔존 이벤트 트리거되지 않도록.
  useEffect(() => {
    if (phase === "lobby" || phase === "waiting") {
      lastActionSigsRef.current.clear();
    }
  }, [phase]);

  // 백그라운드 throttle 회복 — 탭이 다시 활성화될 때 NPC/abort 스케줄 재진입.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [wake]);

  if (!isFirebaseConfigured()) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-6"
        style={{ background: "var(--brand-grad)" }}
      >
        <div className="surface-card max-w-md text-center" style={{ padding: "2rem" }}>
          <h2 className="mb-2 text-lg font-bold" style={{ color: "#b91c1c" }}>
            Firebase 설정 필요
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <code>.env.local</code>에 <code>NEXT_PUBLIC_FIREBASE_*</code> 5개 키를 채워주세요.
            <br />
            (<code>.env.local.example</code> 참고)
          </p>
        </div>
      </div>
    );
  }

  if (phase === "lobby") return <PvpLobby />;
  if (phase === "waiting") return <PvpWaitingRoom />;
  if (phase === "playing") return <PvpBoard />;
  if (phase === "finished") {
    if (splashShown) {
      // RoomPlayer는 Player 필드를 모두 포함 (name/hand/quitted/isPlayer/lastAction/char)
      const players = (room?.state?.players ?? []) as unknown as Player[];
      const reason = deriveEndReason(players);
      return (
        <>
          <PvpBoard />
          {reason && <EndSplash reason={reason} />}
        </>
      );
    }
    return <PvpResultScreen />;
  }
  if (phase === "aborted") return <PvpAborted />;
  return null;
}

const ABORT_MESSAGES: Record<AbortReason, { title: string; body: string }> = {
  "host-left": {
    title: "방장이 게임을 떠났어요",
    body: "방이 닫혔습니다. 잠시 후 로비로 돌아갑니다.",
  },
  "host-disconnect": {
    title: "방장 연결이 끊겼어요",
    body: "방이 닫혔습니다. 잠시 후 로비로 돌아갑니다.",
  },
  "player-left": {
    title: "참가자가 게임을 떠났어요",
    body: "게임을 중단하고 잠시 후 로비로 돌아갑니다.",
  },
  "host-end": {
    title: "게임이 종료됐어요",
    body: "잠시 후 로비로 돌아갑니다.",
  },
};

const ABORT_FALLBACK = {
  title: "게임이 중단됐어요",
  body: "잠시 후 로비로 돌아갑니다.",
};

function PvpAborted() {
  const leave = usePvpStore((s) => s.leave);
  const reason = usePvpStore((s) => s.abortReason);
  const msg = (reason && ABORT_MESSAGES[reason]) ?? ABORT_FALLBACK;

  // 자동 3초 후 lobby 복귀
  useEffect(() => {
    const t = setTimeout(() => {
      void leave();
    }, ABORT_AUTO_LEAVE_MS);
    return () => clearTimeout(t);
  }, [leave]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--brand-grad)" }}
    >
      <div className="surface-card w-full max-w-md text-center" style={{ padding: "2rem" }}>
        <div className="text-5xl mb-3" aria-hidden>
          ✋
        </div>
        <h2
          className="mb-2 text-xl font-extrabold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          {msg.title}
        </h2>
        <p className="mb-6 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {msg.body}
        </p>
        <button
          type="button"
          onClick={() => void leave()}
          className="cta-btn cta-btn-primary"
        >
          지금 로비로
        </button>
      </div>
    </div>
  );
}
