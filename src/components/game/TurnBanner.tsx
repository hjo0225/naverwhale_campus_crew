"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// 차례가 누구에게 넘어오는 순간 잠깐 떠올랐다 사라지는 안내 모달.
// 가로 알약형 — 좌측 웨일 캐릭터(2.png) + 우측 안내 문구.
// 본인 차례면 "내 차례예요!", 다른 플레이어 차례면 "잠시만 기다려주세요.. {이름}님 차례예요".
// 싱글(부스 손님)·PvP(각 기기 플레이어) 양쪽에서 재사용.
// pointer-events: none — 안내가 떠 있어도 곧바로 카드를 클릭할 수 있다.
const DEFAULT_SHOW_MS = 2000;

interface TurnBannerProps {
  /** 안내 활성화 여부 (예: phase=playing 일 때만). false 면 즉시 닫힘. */
  active: boolean;
  /** 표시할 문구. 같은 값이면 재팝 X, 새 값이면 재팝(다른 플레이어로 차례 넘어감 등). */
  title?: string;
  /** 표시 유지 시간(ms). 자기턴은 길게(읽고 결정 시간), 남 턴은 짧게. 기본 2000. */
  durationMs?: number;
  /** 자기 차례 모달이면 true → 연두 윤곽선 강조. */
  isMine?: boolean;
}

export function TurnBanner({
  active,
  title = "내 차례예요!",
  durationMs = DEFAULT_SHOW_MS,
  isMine = false,
}: TurnBannerProps) {
  const [visible, setVisible] = useState(false);
  const prevTitle = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      prevTitle.current = null;
      return;
    }
    // active=true: 타이틀이 바뀐 순간(혹은 첫 표시)에만 재팝.
    if (prevTitle.current !== title) {
      setVisible(true);
      prevTitle.current = title;
      const t = setTimeout(() => setVisible(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [active, title, durationMs]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="turn-banner-layer">
          {isMine ? (
            // 자기 차례 — 텍스트만 (배경·캐릭터 X, 강한 text-shadow 로 가독)
            <motion.div
              key={title}
              className="turn-banner is-mine"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="turn-banner-text">{title}</span>
            </motion.div>
          ) : (
            // 다른 플레이어 차례 — 튜토리얼 NPC 힌트와 동일한 작은 검정 알약
            <motion.div
              key={title}
              className="tutorial-npc-hint"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {title}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
