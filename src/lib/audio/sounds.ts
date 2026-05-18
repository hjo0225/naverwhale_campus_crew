"use client";

/**
 * 부스 게임 사운드 — SFX(단발) + BGM(루프).
 *
 * - HTML5 Audio 직접 사용 (라이브러리 X).
 * - SFX는 인스턴스 풀링으로 연속 재생 허용 (NPC 빠른 턴 대비).
 * - BGM은 키 하나만 동시 재생 (전환 시 이전 BGM 정지).
 * - 재생 시작/정지는 호출자(게임 화면 mount/unmount)가 책임진다.
 *   별도의 음소거 상태는 없으며, 호출되지 않으면 자연히 무음.
 * - 첫 사용자 상호작용 전엔 브라우저가 재생 차단할 수 있음 (autoplay policy).
 *   부스에선 운영진이 어차피 클릭으로 시작하므로 실질 문제 없음.
 */

export type SfxKey =
  | "shuffle"
  | "cardPlay"
  | "cardDraw"
  | "llama"
  | "quit"
  | "roundEnd";

export type BgmKey = "game" | "resultWin" | "resultOther";

const SFX_SRC: Record<SfxKey, string> = {
  shuffle: "/audio/sfx/card-shuffle.mp3",
  cardPlay: "/audio/sfx/card-play.mp3",
  cardDraw: "/audio/sfx/card-draw.mp3",
  llama: "/audio/sfx/llama.mp3",
  quit: "/audio/sfx/quit.mp3",
  roundEnd: "/audio/sfx/round-end.mp3",
};

const BGM_SRC: Record<BgmKey, string> = {
  game: "/audio/bgm/bgm-game.mp3",
  resultWin: "/audio/bgm/result-win.mp3",
  resultOther: "/audio/bgm/result-other.mp3",
};

const SFX_VOLUME = 0.7;
const BGM_VOLUME = 0.35;
// 같은 SFX가 빠르게 연속 트리거될 때 인스턴스 풀 크기.
const SFX_POOL_SIZE = 3;

const sfxPool = new Map<SfxKey, HTMLAudioElement[]>();
let currentBgm: { key: BgmKey; el: HTMLAudioElement } | null = null;

function isClient() {
  return typeof window !== "undefined";
}

function getSfxInstance(key: SfxKey): HTMLAudioElement | null {
  if (!isClient()) return null;
  let pool = sfxPool.get(key);
  if (!pool) {
    pool = Array.from({ length: SFX_POOL_SIZE }, () => {
      const a = new Audio(SFX_SRC[key]);
      a.preload = "auto";
      a.volume = SFX_VOLUME;
      return a;
    });
    sfxPool.set(key, pool);
  }
  // 비어있는 슬롯 우선, 없으면 0번 강제 재사용(빠른 연속).
  const free = pool.find((a) => a.paused || a.ended);
  return free ?? pool[0]!;
}

export function playSfx(key: SfxKey): void {
  const a = getSfxInstance(key);
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play();
  } catch {
    // autoplay block — 부스 환경에선 첫 클릭 이후 풀림.
  }
}

export function playBgm(key: BgmKey): void {
  if (!isClient()) return;
  if (currentBgm?.key === key) {
    void currentBgm.el.play().catch(() => {});
    return;
  }
  stopBgm();
  const el = new Audio(BGM_SRC[key]);
  el.loop = true;
  el.volume = BGM_VOLUME;
  el.preload = "auto";
  currentBgm = { key, el };
  try {
    void el.play();
  } catch {
    // ignore — 사용자 상호작용 후 다시 시도됨
  }
}

export function stopBgm(): void {
  if (!currentBgm) return;
  try {
    currentBgm.el.pause();
    currentBgm.el.currentTime = 0;
  } catch {
    // ignore
  }
  currentBgm = null;
}
