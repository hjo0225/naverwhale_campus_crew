// 싱글 플레이 도입부 — 스크립트 기반 강제 가이드 튜토리얼.
// - 핵심 메커닉(매칭 규칙 + 라마 위엔 라마/1 + 카드 뽑기 + 그만하기 선택지)을 가르친다.
// - 모든 카드 분배·top·플레이 순서가 결정적이므로 매번 똑같은 흐름이 나온다.
// - 튜토리얼이 끝나면(`tutorial = null`) 같은 라운드 안에서 NPC AI 가 재개되고
//   손님은 자유 선택으로 그대로 이어 플레이 한다 (별도 라우트 전환 없음).

import { CARD_TYPES, CONFIG, LLAMA_CARD } from "./data";
import type { Card, CardType, Player } from "./types";

export type TutorialCardId = 1 | 2 | 3 | 4 | 5 | "L";

export type TutorialAction =
  | { type: "play"; cardId: TutorialCardId }
  | { type: "draw" }
  | { type: "quit" };

export interface TutorialTip {
  title: string;
  body: string;
}

export type TutorialStep =
  | { actor: "player"; action: TutorialAction; tip: TutorialTip }
  | { actor: "npc"; npcIdx: 0 | 1 | 2; action: TutorialAction };

/**
 * 스크립트 — 4개 레슨(손님 4회) + 사이사이 NPC 9회 = 총 13스텝.
 * 셋업: top=2, 손님=[3,L,1,5], NPC0=[4,2,3,1], NPC1=[5,4,2,3], NPC2=[L,3,4,2]
 *
 * 레슨:
 *   ① 매칭 규칙       — T1  손님이 3 내기   (2→3)
 *   ② 라마 위엔 라마/1 — T5  손님이 1 내기   (L→1)
 *   ③ 카드 뽑기       — T9  손님이 draw    (top=3, 손패=[L,5] 못 냄)
 *   ④ 그만하기 안내   — T13 손님이 5 내기   (top=4→5; '그만하기'는 선택지로만 안내)
 *
 * 종료 후: 자유 플레이 — 손님 손패 [L,L] 로 계속 참여, NPC AI 와 라운드 마무리.
 */
export const TUTORIAL_SCRIPT: ReadonlyArray<TutorialStep> = [
  // === ① 매칭 규칙 ===
  {
    actor: "player",
    action: { type: "play", cardId: 3 },
    tip: {
      title: "내 차례예요!",
      body:
        "같은 숫자 또는 +1만 낼 수 있어요.\n" +
        "바닥(2) 위에 → 3을 내봅시다.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: 4 } },
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: 5 } },
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: "L" } },

  // === ② 라마(-8점) 위엔 1만 ===
  {
    actor: "player",
    action: { type: "play", cardId: 1 },
    tip: {
      title: "라마(-8점) 위엔 라마 또는 1만!",
      body:
        "라마는 가장 큰 폭탄 빨리 털수록 유리해요.\n" +
        "라마 위엔 라마 또는 1만 가능해요.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: 2 } },
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: 3 } },
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: 3 } },

  // === ③ 낼 카드 없을 땐 뽑기 ===
  {
    actor: "player",
    action: { type: "draw" },
    tip: {
      title: "낼 카드 없을 땐 뽑기",
      body:
        "지금 손패로는 바닥(3)에 못 내요.\n" +
        "우하단 🃏 카드 뽑기 를 눌러주세요.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: 3 } },
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: 4 } },
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: 4 } },

  // === ④ 그만하기 — '선택지가 있다' 안내만, 실제로는 5를 내고 계속 진행 ===
  {
    actor: "player",
    action: { type: "play", cardId: 5 },
    tip: {
      title: "그만하기 선택지도 있어요",
      body:
        "패가 무거우면 지금 점수로 그만둘 수 있어요\n" +
        "튜토리얼에선 5를 내고 계속 진행해 봅시다",
    },
  },
] as const;

// ===== 초기 카드 분배 (결정적) =====
const PLAYER_HAND_IDS: TutorialCardId[] = [3, "L", 1, 5];
const NPC_HAND_IDS: TutorialCardId[][] = [
  [4, 2, 3, 1], // NPC0 (달토)
  [5, 4, 2, 3], // NPC1 (페포)
  ["L", 3, 4, 2], // NPC2 (네이버웨일)
];
const TOP_ID: TutorialCardId = 2;

function typeOf(id: TutorialCardId): CardType {
  if (id === "L") return LLAMA_CARD;
  return CARD_TYPES.find((c) => c.id === id)!;
}

/**
 * 튜토리얼 초기 상태(손패 4×4 + top 1 + 덱 19) 빌더.
 * 모든 손패·top 은 결정적. 덱은 남은 카드(value 별 6장 - 사용량)를 그대로 채워둠 —
 * 튜토리얼 5턴은 모두 play 액션이라 뽑기 없음, 그 뒤 자유 플레이에서 사용.
 */
export function buildTutorialDeal(): {
  hands: Card[][]; // [손님, NPC0, NPC1, NPC2]
  deck: Card[];
  top: Card;
} {
  let uid = 0;
  const next = (id: TutorialCardId): Card => ({ ...typeOf(id), uid: uid++ });

  const hands: Card[][] = [
    PLAYER_HAND_IDS.map(next),
    NPC_HAND_IDS[0]!.map(next),
    NPC_HAND_IDS[1]!.map(next),
    NPC_HAND_IDS[2]!.map(next),
  ];
  const top = next(TOP_ID);

  // 사용된 카드 카운트
  const used = new Map<TutorialCardId, number>();
  const bump = (id: TutorialCardId) => used.set(id, (used.get(id) ?? 0) + 1);
  PLAYER_HAND_IDS.forEach(bump);
  NPC_HAND_IDS.flat().forEach(bump);
  bump(TOP_ID);

  // 덱: 각 숫자 카드 6장 - 사용량, 라마도 동일.
  const deck: Card[] = [];
  for (const t of CARD_TYPES) {
    const id = t.id as TutorialCardId;
    const remaining = CONFIG.copiesPerNumber - (used.get(id) ?? 0);
    for (let i = 0; i < remaining; i++) deck.push(next(id));
  }
  const llamaRemaining = CONFIG.copiesLlama - (used.get("L") ?? 0);
  for (let i = 0; i < llamaRemaining; i++) deck.push(next("L"));

  return { hands, deck, top };
}

/** 카드의 튜토리얼 id 와 일치 여부 확인 (라마는 id === "L"). */
export function cardMatchesScript(card: Card, scriptId: TutorialCardId): boolean {
  return card.id === scriptId;
}

/** Player 빌더 — gameStore 의 buildPlayers 와 동일 형태로 채워준다. */
export function applyTutorialHand(player: Player, hand: Card[]): Player {
  return { ...player, hand, quitted: false, lastAction: null };
}
