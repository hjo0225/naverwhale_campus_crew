import { describe, expect, it } from "vitest";

import { canPlay, calculateScore } from "../rules";
import { assignPlaces } from "../scoring";
import {
  buildTutorialDeal,
  TUTORIAL_SCRIPT,
  type TutorialAction,
  type TutorialCardId,
} from "../tutorial";
import type { Card } from "../types";

// gameStore 의 턴 흐름(runNpcTurn/playerXxx/advanceTurn/checkRoundEnd)을 축약해
// 튜토리얼 스크립트를 끝까지 결정적으로 돌려본다. NPC AI 는 호출되지 않는다
// (라운드가 스크립트 도중/직후 끝나므로).

interface SimPlayer {
  name: string;
  isPlayer: boolean;
  hand: Card[];
  quitted: boolean;
}

const NAMES = ["손님", "달토", "페포", "웨일"];

function checkRoundEnd(players: SimPlayer[], top: Card | null): boolean {
  if (players.some((p) => p.hand.length === 0 && !p.quitted)) return true;
  const active = players.filter((p) => !p.quitted);
  if (active.length === 0) return true;
  if (active.length === 1) return !active[0]!.hand.some((c) => canPlay(c, top));
  return false;
}

function nextActive(players: SimPlayer[], from: number): number {
  let n = (from + 1) % players.length;
  let safety = 0;
  while (players[n]!.quitted && safety < players.length * 2) {
    n = (n + 1) % players.length;
    safety++;
  }
  return n;
}

/**
 * ⑤(free) 스텝에서 손님이 고를 행동을 주입해 한 판을 끝까지 시뮬레이션.
 * 스크립트가 끝나면(tutorial=null) 자유 플레이로 전환 — 손님은 낼 수 있는 카드를
 * 매 턴 1장 내고(엔드게임은 강제 순서라 '첫 번째 낼 수 있는 카드'면 충분), NPC 는
 * 모두 그만둔 상태라 등장하지 않는다.
 */
function runTutorial(freeChoice: "draw" | "quit") {
  const deal = buildTutorialDeal();
  const players: SimPlayer[] = NAMES.map((name, i) => ({
    name,
    isPlayer: i === 0,
    hand: [...deal.hands[i]!],
    quitted: false,
  }));
  const deck = [...deal.deck];
  let top: Card | null = deal.top;
  let turn = 0;
  let stepIndex = 0;
  let tutorialActive = true;
  let playerFreePlays = 0; // ⑤ 이후 손님이 자유 플레이로 카드를 낸 횟수.

  for (let guard = 0; guard < 100; guard++) {
    if (checkRoundEnd(players, top)) break;
    const cur = players[turn]!;

    let action: TutorialAction;
    if (tutorialActive) {
      const step = TUTORIAL_SCRIPT[stepIndex]!;
      // 스크립트는 턴 순서와 정렬돼 있어야 한다.
      expect(step.actor === "player").toBe(cur.isPlayer);
      action = step.action.type === "free" ? { type: freeChoice } : step.action;
    } else {
      // 자유 플레이: 낼 수 있는 첫 카드를 낸다(없으면 종료 조건이 위에서 잡힘).
      const idx = cur.hand.findIndex((c) => canPlay(c, top));
      expect(idx).toBeGreaterThanOrEqual(0);
      action = { type: "play", cardId: cur.hand[idx]!.id as TutorialCardId };
      if (cur.isPlayer) playerFreePlays++;
    }

    if (action.type === "play") {
      const idx = cur.hand.findIndex((c) => c.id === action.cardId);
      expect(idx).toBeGreaterThanOrEqual(0);
      const card = cur.hand[idx]!;
      expect(canPlay(card, top)).toBe(true); // 모든 play 는 매칭 규칙 통과.
      cur.hand.splice(idx, 1);
      top = card;
    } else if (action.type === "draw") {
      const drawn = deck.pop();
      expect(drawn).toBeTruthy();
      cur.hand.push(drawn!);
    } else if (action.type === "quit") {
      cur.quitted = true;
    }

    if (tutorialActive) {
      if (stepIndex + 1 >= TUTORIAL_SCRIPT.length) tutorialActive = false;
      else stepIndex++;
    }
    if (checkRoundEnd(players, top)) break;
    turn = nextActive(players, turn);
  }

  const rows = players.map((p) => ({
    name: p.name,
    isPlayer: p.isPlayer,
    score: p.hand.length === 0 ? 0 : calculateScore(p.hand),
  }));
  const places = assignPlaces(rows);
  return { players, rows, place: places.get("손님")!, playerFreePlays };
}

describe("튜토리얼 시나리오", () => {
  it("초기 분배가 룰대로다 (손패 4장 + top + 덱 19장, 라마 6장)", () => {
    const { hands, deck, top } = buildTutorialDeal();
    expect(hands).toHaveLength(4);
    hands.forEach((h) => expect(h).toHaveLength(4));
    expect(deck).toHaveLength(19);
    expect(top.value).toBe(2);
    const all = [...hands.flat(), ...deck, top];
    expect(all).toHaveLength(36);
    expect(all.filter((c) => c.id === "L")).toHaveLength(6);
  });

  it("덱 뽑기 순서가 [3,4,4]로 고정돼 있다", () => {
    const { deck } = buildTutorialDeal();
    expect(deck[deck.length - 1]!.value).toBe(3); // ④ 손님
    expect(deck[deck.length - 2]!.value).toBe(4); // T13 NPC0
    expect(deck[deck.length - 3]!.value).toBe(4); // ⑤ 손님(뽑기)
  });

  it("⑤에서 '그만하기'를 눌러도 손님이 1등으로 끝난다", () => {
    const { place, rows } = runTutorial("quit");
    expect(place).toBe(1);
    // 손님 점수가 모든 NPC보다 엄격히 낮다(=가볍다).
    const me = rows.find((r) => r.isPlayer)!;
    rows
      .filter((r) => !r.isPlayer)
      .forEach((npc) => expect(me.score).toBeLessThan(npc.score));
  });

  it("⑤에서 '카드 뽑기'를 누르면 손님이 카드를 다 내고(0점) 3번째 턴 안에 1등으로 끝난다", () => {
    const { place, rows, players, playerFreePlays } = runTutorial("draw");
    expect(place).toBe(1);
    // 손님이 손패를 전부 냄 → 0점.
    const me = players.find((p) => p.isPlayer)!;
    expect(me.hand).toHaveLength(0);
    expect(rows.find((r) => r.isPlayer)!.score).toBe(0);
    // 뽑기 이후 손님의 3번째 턴 안에 종료.
    expect(playerFreePlays).toBeLessThanOrEqual(3);
  });
});
