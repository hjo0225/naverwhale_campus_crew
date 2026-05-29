// 싱글 플레이 도입부 — 스크립트 기반 강제 가이드 튜토리얼.
// - 핵심 메커닉(매칭 규칙 + 5 위 라마 + 라마 위 라마·1 + 막혔을 때 뽑기/그만하기)을 가르친다.
// - 모든 카드 분배·top·플레이 순서가 결정적이므로 매번 똑같은 흐름이 나온다.
// - 튜토리얼이 끝나면(`tutorial = null`) 같은 라운드 안에서 NPC AI 가 재개되고
//   손님은 자유 선택으로 그대로 이어 플레이 한다 (별도 라우트 전환 없음).

import { CARD_TYPES, CONFIG, LLAMA_CARD } from "./data";
import type { Card, CardType, Player } from "./types";

export type TutorialCardId = 1 | 2 | 3 | 4 | 5 | "L";

export type TutorialAction =
  | { type: "play"; cardId: TutorialCardId }
  | { type: "draw" }
  | { type: "quit" }
  // 설명만 하고 행동을 강제하지 않는 스텝 — 손님이 뽑기/그만하기/낼 수 있으면 내기 중
  // 무엇이든 1회 하면 통과한다. highlight 로 안내 버튼만 강조(누름 강제 아님).
  | { type: "free"; highlight?: "draw" | "quit" };

export interface TutorialTip {
  title: string;
  body: string;
}

export type TutorialStep =
  | { actor: "player"; action: TutorialAction; tip: TutorialTip }
  | { actor: "npc"; npcIdx: 0 | 1 | 2; action: TutorialAction };

/**
 * 스크립트 — 5개 레슨(손님 5회) + NPC 13회 = 총 18스텝.
 * 셋업: top=2, 손님=[3,L,1,4], NPC0=[4,L,1,5], NPC1=[5,L,2,L], NPC2=[5,L,2,L]
 *
 * 레슨 (5→라마→1 체인을 손님이 직접 익히고, 마지막엔 직접 다 내고 이기도록):
 *   ① 매칭 규칙       — T1  손님 (3) 내기 (2→3, 같은 숫자/+1)
 *   ② 5 위에 라마     — T5  손님 (L) 내기 (NPC가 5까지 올려둠)
 *   ③ 라마 위엔 라마/1 — T9  손님 (1) 내기 (NPC가 라마를 쌓아 '라마 위 라마'도 노출)
 *   ④ 막혔을 땐 뽑기   — T13 손님 draw  (top=2, 손패=[4] 못 냄 → (3) 뽑음)
 *   ⑤ 그만하기 안내   — T17 손님 자유(뽑기/그만하기) — 설명만, 강제 X
 *
 * 엔드게임(결정적):
 *   T13 NPC0 draw(→[5,4] 스턱) · T14 NPC1 quit([L]) · T15 NPC2 quit([L]).
 *   ⑤에서:
 *     - 그만하기 → 손님 [4,3]=7점 확정, NPC0 혼자 스턱 → 즉시 종료.
 *     - 뽑기(→[4,3,4]) → T17 NPC0 quit → 손님 혼자. 바닥(2)에서 3→4→4 강제 순서로
 *       다 내고(손님 3번째 턴) 0점으로 종료.
 *   어느 쪽이든 손님 1등 (NPC0 -9, NPC1 -8, NPC2 -8).
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
        "바닥(2) 위에 (3)을 내봅시다.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: 4 } }, // 3→4
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: 5 } }, // 4→5
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: 5 } }, // 같은 5

  // === ② 5 위에 라마 ===
  {
    actor: "player",
    action: { type: "play", cardId: "L" },
    tip: {
      title: "바닥이 (5)라면?",
      body:
        "(5) 위엔 (5) 또는 라마를 올릴 수 있어요\n" +
        "라마카드를 내봅시다.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: "L" } }, // 라마 위 라마
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: "L" } }, // 라마 위 라마
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: "L" } }, // 라마 위 라마

  // === ③ 라마 위엔 라마 또는 1만 ===
  {
    actor: "player",
    action: { type: "play", cardId: 1 },
    tip: {
      title: "바닥이 라마라면?",
      body:
        "라마 위엔 라마 또는 (1)을 올릴 수 있어요\n" +
        "(1)카드를 내봅시다.",
    },
  },
  { actor: "npc", npcIdx: 0, action: { type: "play", cardId: 1 } }, // 같은 1
  { actor: "npc", npcIdx: 1, action: { type: "play", cardId: 2 } }, // 1→2
  { actor: "npc", npcIdx: 2, action: { type: "play", cardId: 2 } }, // 같은 2

  // === ④ 막혔을 땐 뽑기. 손패엔 (4) 뿐이라 바닥(2)에 못 냄 ===
  {
    actor: "player",
    action: { type: "draw" },
    tip: {
      title: "낼 카드가 없다면?",
      body:
        "🃏 카드 뽑기로 새 카드를 받을 수 있어요\n" +
        "뽑기를 눌러봅시다.",
    },
  },
  // 엔드게임 셋업: NPC0은 뽑어서 스턱([5,4]), NPC1·NPC2는 라마를 쥔 채 그만하기.
  { actor: "npc", npcIdx: 0, action: { type: "draw" } },
  { actor: "npc", npcIdx: 1, action: { type: "quit" } },
  { actor: "npc", npcIdx: 2, action: { type: "quit" } },

  // === ⑤ 그만하기 — 설명만, 완전 자유(강조/잠금 없음). 무엇을 눌러도 1등으로 끝남 ===
  {
    actor: "player",
    action: { type: "free" },
    tip: {
      title: "그만하기란?",
      body:
        "끝까지 못 털면 남은 카드 숫자만큼 점수가 깎여요\n" +
        "✋ 그만하기로 지금 점수를 굳힐 수 있어요\n" +
        "🃏 더 뽑아 카드를 다 낼 수도 있어요 — 원하는 대로!",
    },
  },
  // ⑤에서 '뽑기'를 고른 경우에만 도달 — NPC0이 그만두며 손님만 남아 라운드 종료.
  // ('그만하기'를 고른 경우엔 그 즉시 NPC0 혼자 스턱으로 끝나 이 스텝은 실행되지 않음.)
  { actor: "npc", npcIdx: 0, action: { type: "quit" } },
] as const;

// ===== 초기 카드 분배 (결정적) =====
const PLAYER_HAND_IDS: TutorialCardId[] = [3, "L", 1, 4];
const NPC_HAND_IDS: TutorialCardId[][] = [
  [4, "L", 1, 5], // NPC0 (달토) — 4·라마·1 내고 [5] 남음 → T13 뽑기(4) → [5,4]로 스턱
  [5, "L", 2, "L"], // NPC1 (페포) — 5·라마·2 내고 [라마] 남음 → T14 그만하기(스턱)
  [5, "L", 2, "L"], // NPC2 (웨일) — 5·라마·2 내고 [라마] 남음 → T15 그만하기(스턱)
];
const TOP_ID: TutorialCardId = 2;
// 튜토리얼 엔드게임 고정용 뽑기 순서(먼저 뽑히는 것부터): ④손님=3, T13 NPC0=4, ⑤손님(뽑기)=4.
// → ⑤에서 뽑으면 손님 손패 [4,3,4], 바닥(2)에서 3→4→4 강제 순서로 다 내고 0점 승.
const TUTORIAL_DRAW_ORDER: TutorialCardId[] = [3, 4, 4];

function typeOf(id: TutorialCardId): CardType {
  if (id === "L") return LLAMA_CARD;
  return CARD_TYPES.find((c) => c.id === id)!;
}

/**
 * 튜토리얼 초기 상태(손패 4×4 + top 1 + 덱 19) 빌더.
 * 모든 손패·top·뽑기 순서가 결정적. 덱 끝(pop 순서)은 TUTORIAL_DRAW_ORDER 로 고정 —
 * ④ 손님 뽑기 + T13 NPC0 뽑기 (+⑤ '뽑기' 분기 시 손님 1장) 까지 결과가 항상 같다.
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

  // 남은 카드 수(숫자 6장·라마 6장 - 사용량).
  const remaining = new Map<TutorialCardId, number>();
  for (const t of CARD_TYPES) {
    const id = t.id as TutorialCardId;
    remaining.set(id, CONFIG.copiesPerNumber - (used.get(id) ?? 0));
  }
  remaining.set("L", CONFIG.copiesLlama - (used.get("L") ?? 0));

  // 결정적 뽑기 순서(덱 끝에서 pop)를 만들기 위해 해당 카드를 먼저 빼둔다.
  for (const id of TUTORIAL_DRAW_ORDER) {
    remaining.set(id, (remaining.get(id) ?? 0) - 1);
  }

  // 덱: 뽑힐 일 없는 나머지 카드를 앞쪽에, 뽑기 순서 카드를 뒤쪽(역순)에.
  const deck: Card[] = [];
  for (const [id, cnt] of remaining) {
    for (let i = 0; i < cnt; i++) deck.push(next(id));
  }
  // 먼저 뽑힐 카드가 가장 마지막(pop 대상)에 오도록 역순으로 push.
  for (let i = TUTORIAL_DRAW_ORDER.length - 1; i >= 0; i--) {
    deck.push(next(TUTORIAL_DRAW_ORDER[i]!));
  }

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
