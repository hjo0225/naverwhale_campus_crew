"use client";

import { create } from "zustand";
import { CONFIG, TOTAL_ROUNDS } from "@/lib/game/data";
import { createDeck, shuffle } from "@/lib/game/deck";
import { decideNpcMove, type NpcDecision } from "@/lib/game/npcAi";
import { canPlay, calculateScore } from "@/lib/game/rules";
import { assignPlaces, summarize } from "@/lib/game/scoring";
import { buildTutorialDeal, TUTORIAL_SCRIPT } from "@/lib/game/tutorial";
import { playSfx } from "@/lib/audio/sounds";
import type {
  Card,
  GameState,
  Player,
  PlayerSummary,
  RoundHistoryEntry,
} from "@/lib/game/types";

/**
 * 튜토리얼 진행 상태 — 스크립트 인덱스만 들고 있고, 실제 스크립트 내용은
 * `TUTORIAL_SCRIPT[stepIndex]` 로 조회. stepIndex 가 스크립트 길이를 넘으면
 * 자동으로 null 로 바뀌고 자유 플레이로 전환된다.
 */
export interface TutorialState {
  stepIndex: number;
}

export interface GameStore {
  state: GameState | null;
  toast: string | null;
  /** 게임 종료 시점에만 채워짐 — 손님의 누적 결과 (상품 결정용) */
  summary: PlayerSummary | null;
  /** 랜딩 슬라이드쇼 자동 전환 여부. 기본=false(수동/휠). 운영진이 "1" 누르면 true. */
  landingAutoMode: boolean;
  /** 튜토리얼 진행 상태. null = 자유 플레이. */
  tutorial: TutorialState | null;

  startGame: () => void;
  /** 결정적 셋업 + 스크립트로 부팅. 스크립트 끝나면 자동으로 자유 플레이로 전환. */
  startTutorialGame: () => void;
  /** 튜토리얼 도중 건너뛰기 — 현재 상태 유지 채로 tutorial 만 null. */
  skipTutorial: () => void;
  playerPlayCard: (handIdx: number) => void;
  playerDraw: () => void;
  playerQuit: () => void;
  goNextRound: () => void;
  reset: () => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  setLandingAutoMode: (v: boolean) => void;
}

function makePlayer(name: string, isPlayer: boolean, char: Player["char"]): Player {
  return { name, hand: [], quitted: false, isPlayer, lastAction: null, char };
}

/**
 * 4인 한 판 — players[0] = 손님, players[1..N] = NPC.
 * NPC 순서는 CONFIG.opponents 그대로 (UI에서 좌·상·우 코너 매핑).
 */
function buildPlayers(): Player[] {
  return [
    makePlayer("손님", true, null),
    ...CONFIG.opponents.map((opp) => makePlayer(opp.name, false, opp.char)),
  ];
}

function dealNewRound(state: GameState): GameState {
  const deck = shuffle(createDeck());
  const players = state.players.map((p) => ({
    ...p,
    hand: [] as Card[],
    quitted: false,
    lastAction: null,
  }));
  for (let i = 0; i < CONFIG.handSize; i++) {
    for (const p of players) {
      const c = deck.pop();
      if (c) p.hand.push(c);
    }
  }
  const top = deck.pop() ?? null;
  return {
    ...state,
    players,
    deck,
    top,
    currentTurn: 0,
    phase: "playing",
  };
}

// 등수/상품 계산은 lib/game/scoring 으로 추출됨 (PvP와 공유).
// solo 동작 유지: assignPlaces가 사람 1명일 때 기존 부스 우호 룰을 그대로 적용.

/** 손님 첫 턴인지 판단 — 양쪽 모두 lastAction이 null이고 phase=playing. */
export function isPlayerFirstTurn(state: GameState | null): boolean {
  if (!state || state.phase !== "playing" || state.currentTurn !== 0) return false;
  return state.players.every((p) => p.lastAction === null);
}

export const useGameStore = create<GameStore>((set, get) => {
  let npcTimer: ReturnType<typeof setTimeout> | null = null;

  function clearNpcTimer() {
    if (npcTimer) {
      clearTimeout(npcTimer);
      npcTimer = null;
    }
  }

  function scheduleNpcTurn() {
    const s = get().state;
    if (!s || s.phase !== "playing") return;
    const cur = s.players[s.currentTurn];
    if (!cur || cur.isPlayer || cur.quitted) return;
    clearNpcTimer();
    npcTimer = setTimeout(() => runNpcTurn(), CONFIG.npcThinkDelay);
  }

  function checkRoundEnd(s: GameState): { end: boolean; toast?: string } {
    const someoneEmpty = s.players.some((p) => p.hand.length === 0 && !p.quitted);
    if (someoneEmpty) return { end: true };
    const active = s.players.filter((p) => !p.quitted);
    if (active.length === 0) return { end: true };
    if (active.length === 1) {
      const last = active[0]!;
      const canPlayAny = last.hand.some((c) => canPlay(c, s.top));
      if (!canPlayAny) {
        return { end: true, toast: "낼 수 있는 카드가 없어 라운드가 종료됩니다" };
      }
    }
    return { end: false };
  }

  function endRound() {
    clearNpcTimer();
    const s = get().state;
    if (!s) return;

    const rows = s.players.map((p) => ({
      name: p.name,
      isPlayer: p.isPlayer,
      score: p.hand.length === 0 ? 0 : calculateScore(p.hand),
      hand: [...p.hand],
      quitted: p.quitted,
    }));

    const places = assignPlaces(rows);
    const scores = rows.map((r) => ({
      name: r.name,
      isPlayer: r.isPlayer,
      score: r.score,
      hand: r.hand,
      place: places.get(r.name) ?? rows.length,
      quitted: r.quitted,
    }));
    const playerPlace = scores.find((s) => s.isPlayer)?.place ?? rows.length;

    const totalScores = { ...s.totalScores };
    for (const r of rows) {
      totalScores[r.name] = (totalScores[r.name] ?? 0) + r.score;
    }

    const entry: RoundHistoryEntry = {
      round: s.round,
      scores,
      playerPlace,
    };
    const nextHistory = [...s.roundHistory, entry];

    // 4인 1판 — 라운드 끝 = 게임 끝.
    set({
      state: {
        ...s,
        phase: "finished",
        totalScores,
        roundHistory: nextHistory,
      },
      summary: summarize(nextHistory),
    });
    playSfx("roundEnd");
  }

  function advanceTurn() {
    const s = get().state;
    if (!s) return;
    const check = checkRoundEnd(s);
    if (check.toast) get().showToast(check.toast);
    if (check.end) {
      endRound();
      return;
    }
    let next = (s.currentTurn + 1) % s.players.length;
    let safety = 0;
    while (s.players[next]?.quitted && safety < s.players.length * 2) {
      next = (next + 1) % s.players.length;
      safety++;
    }
    set({ state: { ...s, currentTurn: next } });
    scheduleNpcTurn();
  }

  function runNpcTurn() {
    const s = get().state;
    if (!s || s.phase !== "playing") return;
    const idx = s.currentTurn;
    const npc = s.players[idx];
    if (!npc || npc.isPlayer || npc.quitted) {
      advanceTurn();
      return;
    }

    // 튜토리얼 활성 + 이 NPC 가 스크립트 차례면 결정을 AI 대신 스크립트로 대체.
    // NPC 인덱스 매핑: state.players[1]=NPC0, [2]=NPC1, [3]=NPC2 → npcIdx = idx - 1.
    const tut = get().tutorial;
    let decision: NpcDecision | null = null;
    let usedScript = false;
    if (tut) {
      const step = TUTORIAL_SCRIPT[tut.stepIndex];
      if (step && step.actor === "npc" && step.npcIdx === idx - 1) {
        // step.action 을 지역 변수로 빼야 화살표 콜백 안에서도 TS 좁히기가 유지됨.
        const action = step.action;
        if (action.type === "play") {
          const targetId = action.cardId;
          const handIdx = npc.hand.findIndex((c) => c.id === targetId);
          const card = handIdx >= 0 ? npc.hand[handIdx] : undefined;
          if (card) {
            decision = { type: "play", handIdx, card };
            usedScript = true;
          }
        } else if (action.type === "draw") {
          decision = { type: "draw" };
          usedScript = true;
        } else if (action.type === "quit") {
          decision = { type: "quit" };
          usedScript = true;
        }
      }
    }
    if (!decision) decision = decideNpcMove(npc, s);
    if (!decision) {
      endRound();
      return;
    }

    const newPlayers = s.players.map((p, i) => (i === idx ? { ...p, hand: [...p.hand] } : p));
    const target = newPlayers[idx]!;

    if (decision.type === "play") {
      target.hand.splice(decision.handIdx, 1);
      target.lastAction = { type: "play", card: decision.card };
      const next: GameState = { ...s, players: newPlayers, top: decision.card };
      set({ state: next });
      playSfx(decision.card.id === "L" ? "llama" : "cardPlay");
      if (usedScript) advanceTutorialStep();
      if (target.hand.length === 0) {
        endRound();
        return;
      }
      advanceTurn();
      return;
    }

    if (decision.type === "draw") {
      const newDeck = [...s.deck];
      const drawn = newDeck.pop();
      if (drawn) target.hand.push(drawn);
      target.lastAction = { type: "draw" };
      set({ state: { ...s, players: newPlayers, deck: newDeck } });
      playSfx("cardDraw");
      if (usedScript) advanceTutorialStep();
      advanceTurn();
      return;
    }

    target.quitted = true;
    target.lastAction = { type: "quit" };
    set({ state: { ...s, players: newPlayers } });
    playSfx("quit");
    if (usedScript) advanceTutorialStep();
    advanceTurn();
  }

  /**
   * 튜토리얼 스텝 1단계 진행 — 해당 스텝의 액션이 끝난 직후 호출.
   * 마지막 스텝이면 tutorial=null 로 만들어 자유 플레이로 자연 전환.
   */
  function advanceTutorialStep() {
    const tut = get().tutorial;
    if (!tut) return;
    const nextIdx = tut.stepIndex + 1;
    if (nextIdx >= TUTORIAL_SCRIPT.length) {
      set({ tutorial: null });
    } else {
      set({ tutorial: { stepIndex: nextIdx } });
    }
  }

  return {
    state: null,
    toast: null,
    summary: null,
    landingAutoMode: false,
    tutorial: null,

    startGame: () => {
      clearNpcTimer();
      const players = buildPlayers();
      const totalScores: Record<string, number> = {};
      players.forEach((p) => {
        totalScores[p.name] = 0;
      });
      const base: GameState = {
        players,
        deck: [],
        top: null,
        currentTurn: 0,
        phase: "playing",
        round: 1,
        totalRounds: TOTAL_ROUNDS,
        totalScores,
        roundHistory: [],
      };
      set({ state: dealNewRound(base), summary: null, tutorial: null });
      playSfx("shuffle");
    },

    startTutorialGame: () => {
      clearNpcTimer();
      const basePlayers = buildPlayers();
      const totalScores: Record<string, number> = {};
      basePlayers.forEach((p) => {
        totalScores[p.name] = 0;
      });
      // 결정적 분배 — tutorial.ts 가 손패/덱/top 을 정해진 대로 만들어 줌.
      const deal = buildTutorialDeal();
      const players: Player[] = basePlayers.map((p, i) => ({
        ...p,
        hand: deal.hands[i] ?? [],
        quitted: false,
        lastAction: null,
      }));
      const state: GameState = {
        players,
        deck: deal.deck,
        top: deal.top,
        currentTurn: 0, // 첫 스텝은 손님.
        phase: "playing",
        round: 1,
        totalRounds: TOTAL_ROUNDS,
        totalScores,
        roundHistory: [],
      };
      set({
        state,
        summary: null,
        tutorial: { stepIndex: 0 },
      });
      playSfx("shuffle");
    },

    skipTutorial: () => {
      // 현재 게임 상태는 그대로 두고 가이드만 해제. NPC AI 와 손님 자유 선택이 곧장 재개.
      set({ tutorial: null });
      const s = get().state;
      if (s?.phase === "playing") scheduleNpcTurn();
    },

    playerPlayCard: (handIdx) => {
      const s = get().state;
      if (!s || s.phase !== "playing" || s.currentTurn !== 0) return;
      const player = s.players[0];
      if (!player) return;
      const card = player.hand[handIdx];
      if (!card || !canPlay(card, s.top)) return;

      // 튜토리얼 활성: 스크립트가 손님 차례 + play 일 때만, 그것도 지정한 카드만 허용.
      const tut = get().tutorial;
      if (tut) {
        const step = TUTORIAL_SCRIPT[tut.stepIndex];
        if (!step || step.actor !== "player") return;
        if (step.action.type !== "play") return;
        if (step.action.cardId !== card.id) return;
      }

      const newPlayers = s.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand] } : p));
      const me = newPlayers[0]!;
      me.hand.splice(handIdx, 1);
      me.lastAction = { type: "play", card };
      set({ state: { ...s, players: newPlayers, top: card } });
      playSfx(card.id === "L" ? "llama" : "cardPlay");
      if (tut) advanceTutorialStep();
      if (me.hand.length === 0) {
        endRound();
        return;
      }
      advanceTurn();
    },

    playerDraw: () => {
      const s = get().state;
      if (!s || s.phase !== "playing" || s.currentTurn !== 0) return;

      // 튜토리얼 활성: 현 스텝이 손님 + draw 일 때만 허용.
      const tut = get().tutorial;
      if (tut) {
        const step = TUTORIAL_SCRIPT[tut.stepIndex];
        if (!step || step.actor !== "player") return;
        if (step.action.type !== "draw") return;
      }

      const activeCount = s.players.filter((p) => !p.quitted).length;
      if (activeCount === 1) return;
      if (s.deck.length === 0) {
        // 덱이 비면 뽑기 자체 무시 — 의도하지 않은 자동 quit 방지.
        // UI 측 drawDisabled가 "덱 비었음" 라벨로 안내.
        get().showToast("덱이 비어 카드를 뽑을 수 없어요");
        return;
      }
      const newPlayers = s.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand] } : p));
      const me = newPlayers[0]!;
      const newDeck = [...s.deck];
      const drawn = newDeck.pop();
      if (drawn) me.hand.push(drawn);
      me.lastAction = { type: "draw" };
      set({ state: { ...s, players: newPlayers, deck: newDeck } });
      playSfx("cardDraw");
      if (tut) advanceTutorialStep();
      advanceTurn();
    },

    playerQuit: () => {
      const s = get().state;
      if (!s || s.phase !== "playing" || s.currentTurn !== 0) return;
      // 첫 턴 강제 — 손님이 첫 턴에 그만하기 못 함 (부스 우호 룰).
      if (isPlayerFirstTurn(s)) return;

      // 튜토리얼 활성: 현 스텝이 손님 + quit 일 때만 허용.
      const tut = get().tutorial;
      if (tut) {
        const step = TUTORIAL_SCRIPT[tut.stepIndex];
        if (!step || step.actor !== "player") return;
        if (step.action.type !== "quit") return;
      }

      const newPlayers = s.players.map((p, i) =>
        i === 0 ? { ...p, quitted: true, lastAction: { type: "quit" as const } } : p
      );
      set({ state: { ...s, players: newPlayers } });
      playSfx("quit");
      if (tut) advanceTutorialStep();
      advanceTurn();
    },

    /** 4인 1판 구조에서는 호출 X. 다중 라운드 구조 복귀 시 재구현. */
    goNextRound: () => {},

    reset: () => {
      clearNpcTimer();
      set({ state: null, summary: null, tutorial: null });
    },

    showToast: (msg) => {
      set({ toast: msg });
    },
    clearToast: () => {
      set({ toast: null });
    },
    setLandingAutoMode: (v) => {
      set({ landingAutoMode: v });
    },
  };
});
