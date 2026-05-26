"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/lib/store/gameStore";
import { TUTORIAL_SCRIPT } from "@/lib/game/tutorial";

// 튜토리얼 진행 중 보드 위에 떠 있는 안내 오버레이.
// - 손님 스텝일 때: 상단 가운데에 큰 안내 카드(제목 + 본문)
// - NPC 스텝일 때: 가벼운 진행 표시("NPC 차례 진행 중...")
// - 항상: 우상단 "건너뛰기" 버튼
// pointer-events 는 안내 카드 외엔 통과시켜 보드 클릭을 막지 않는다.

export function TutorialOverlay() {
  const tutorial = useGameStore((s) => s.tutorial);
  const skipTutorial = useGameStore((s) => s.skipTutorial);

  if (!tutorial) return null;
  const step = TUTORIAL_SCRIPT[tutorial.stepIndex];
  if (!step) return null;

  const isPlayerStep = step.actor === "player";
  // 카운터는 NPC 스텝을 빼고 "손님 스텝" 기준으로 표시 — 사용자가 직관적으로 이해.
  const total = TUTORIAL_SCRIPT.filter((s) => s.actor === "player").length;
  const human = TUTORIAL_SCRIPT
    .slice(0, tutorial.stepIndex + 1)
    .filter((s) => s.actor === "player").length;

  return (
    <div className="tutorial-layer">
      {/* 진행 카운터 + 건너뛰기 — 우상단 */}
      <div className="tutorial-controls">
        <span className="tutorial-step-count">
          튜토리얼 {human} / {total}
        </span>
        <button
          type="button"
          className="tutorial-skip-btn"
          onClick={() => skipTutorial()}
        >
          건너뛰기 ✕
        </button>
      </div>

      {/* 앵커가 보드의 (위에서 1/3, 좌우 중앙) 좌표를 잡고,
          AnimatePresence 의 motion.div 가 그 안에서 enter/exit 애니메이션만 담당.
          앵커 분리는 motion 의 inline transform 과 CSS centering transform 충돌 회피용. */}
      <div className="tutorial-anchor">
        <AnimatePresence mode="wait">
          {isPlayerStep ? (
            <motion.div
              key={`tip-${tutorial.stepIndex}`}
              className="tutorial-tip"
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
            >
              <div className="tutorial-tip-badge" aria-hidden>
                🎓 TUTORIAL
              </div>
              <strong className="tutorial-tip-title">{step.tip.title}</strong>
              <p className="tutorial-tip-body">{step.tip.body}</p>
              <span className="tutorial-tip-hint">
                ✨ 강조된 곳을 눌러 진행하세요
              </span>
            </motion.div>
          ) : (
            <motion.div
              key={`npc-${tutorial.stepIndex}`}
              className="tutorial-npc-hint"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              잠시만요.. NPC 차례 진행 중...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
