"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/lib/store/gameStore";

// 게임 메인 메뉴 — 홈(`/`). 헤더에 메뉴, 가운데에 YouTube attract 영상.
// 라우팅은 그대로: 헤더 버튼이 기존 라우트로 이동한다.

// ===== 영상 설정 =====
// 각 기능별 영상. 왼쪽 버튼을 누르면 즉시 그 영상으로 슬라이드되고, 영상이 끝나면
// 다음 기능으로 자동 사이클(attract). 마지막 → 처음 무한 반복.
// - 1개:    그 영상이 YouTube 자체 루프로 무한 반복.
// - 비어 있음: "영상 준비 중" 자리표시.
interface Feature {
  id: string;
  label: string;
  ytId: string;
}
const FEATURES: readonly Feature[] = [
  { id: "dual-tab", label: "듀얼탭", ytId: "pd1WmEx6ttg" },
  { id: "gesture", label: "마우스 제스처", ytId: "BO7jBVuWbrQ" },
  { id: "sidebar", label: "사이드바", ytId: "7miScf_vR8E" },
];

function buildEmbedUrl(id: string, useNativeLoop: boolean): string {
  // 부스 attract 모드: 자동재생(브라우저 정책상 음소거 필수) + 컨트롤/주변 영상/주석 숨김.
  // enablejsapi=1: ENDED 이벤트 수신용(여러 개 사이클 모드에서 필요).
  const params: Record<string, string> = {
    autoplay: "1",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
    disablekb: "1",
    enablejsapi: "1",
  };
  if (useNativeLoop) {
    // 1개뿐일 때는 YouTube 자체 루프 사용 (loop=1 + playlist={ID} 트릭)
    params.loop = "1";
    params.playlist = id;
  }
  // 주의: `origin` 파라미터는 SSR↔클라이언트 src 가 달라져 hydration 불일치를 일으키므로 넣지 않는다.
  // (정적 익스포트라 빌드 시점에 도메인이 결정되지도 않음. 콘솔 권장 경고만 뜸 — 무해.)
  return `https://www.youtube-nocookie.com/embed/${id}?${new URLSearchParams(params).toString()}`;
}

// ===== YouTube IFrame API 최소 타입 =====
interface YtPlayer {
  destroy(): void;
  mute?: () => void;
  unMute?: () => void;
  /** 0~100 */
  setVolume?: (v: number) => void;
}
interface YtNamespace {
  Player: new (
    el: HTMLIFrameElement | string,
    opts: { events?: { onStateChange?: (e: { data: number }) => void } },
  ) => YtPlayer;
  PlayerState: { ENDED: number };
}
declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ===== YouTube IFrame API 싱글톤 로더 =====
let ytApiPromise: Promise<void> | null = null;
function loadYtApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return ytApiPromise;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// 영상 한 개를 띄우는 iframe + IFrame API 부착.
// - onEnded (여러 개 모드): ENDED 이벤트 시 호출 → 다음 영상으로 사이클
// - muted: 부모 토글 상태. 변경 시 player.mute()/unMute()+setVolume(100).
//   초기 attract 모드는 mute=1 (브라우저 autoplay 정책상 필수).
function VideoFrame({
  id,
  useNativeLoop,
  muted,
  onEnded,
}: {
  id: string;
  useNativeLoop: boolean;
  muted: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  // 콜백/상태 최신값을 effect 재실행 없이 참조하려는 ref 들.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // iframe (= id) 마운트마다 새 YT.Player 생성. 정리는 cleanup 에서.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    let cancelled = false;

    void loadYtApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const ENDED = window.YT.PlayerState.ENDED;
      const p = new window.YT.Player(iframe, {
        events: {
          onStateChange: (e) => {
            if (e.data === ENDED) onEndedRef.current?.();
          },
        },
      });
      playerRef.current = p;
      // 현재 muted 상태 즉시 적용 (다음 영상으로 슬라이드되어도 unmute 유지)
      try {
        if (mutedRef.current) p.mute?.();
        else {
          p.unMute?.();
          p.setVolume?.(100);
        }
      } catch {
        // 플레이어 준비 전이면 onReady 후 호출됨 — 무시
      }
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // 이미 파괴됐거나 API 미초기화 — 무시
      }
      playerRef.current = null;
    };
  }, [id]);

  // muted prop 변경 → 기존 플레이어에 즉시 반영
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (muted) p.mute?.();
      else {
        p.unMute?.();
        p.setVolume?.(100);
      }
    } catch {
      // 무시
    }
  }, [muted]);

  return (
    <iframe
      ref={ref}
      className="menu-video"
      src={buildEmbedUrl(id, useNativeLoop)}
      title="WHALE BOOTH 소개 영상"
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}

export function MainMenu() {
  const reset = useGameStore((s) => s.reset);
  // 홈 도착 시 게임 store 정리 — 결과 화면에서 "처음으로" 누른 뒤 stale 결과가 남지 않도록.
  useEffect(() => {
    reset();
  }, [reset]);

  // 현재 표시 중인 기능 인덱스. 사이클이 wrap 해도 key 가 달라야 슬라이드 트리거되므로
  // tick 을 별도로 증가시킨다(단조 증가, 같은 인덱스 다시 와도 새 key).
  const [currentIdx, setCurrentIdx] = useState(0);
  const [tick, setTick] = useState(0);
  // 음소거 토글 — 초기 true (autoplay 정책상 필수). 운영진이 우하단 버튼으로 unmute.
  const [muted, setMuted] = useState(true);
  const total = FEATURES.length;
  const single = total === 1;
  const current = total > 0 ? FEATURES[currentIdx % total]! : null;
  const currentId = current?.ytId ?? null;

  const goNext = useCallback(() => {
    setCurrentIdx((i) => (i + 1) % total);
    setTick((t) => t + 1);
  }, [total]);

  const selectFeature = useCallback((idx: number) => {
    setCurrentIdx((prev) => {
      if (prev === idx) return prev; // 이미 활성이면 재트리거 없이 통과
      return idx;
    });
    setTick((t) => t + 1);
  }, []);

  return (
    <div className="fullpage fullpage--brand">
      {/* ===== 헤더 — 좌측 로고 + 우측 메뉴 ===== */}
      <motion.header
        className="menu-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <Link href="/" className="menu-logo" aria-label="WHALE BOOTH 홈">
          <span className="menu-logo-mark" aria-hidden>
            🐳
          </span>
          <span className="menu-logo-text">
            <strong>WHALE BOOTH</strong>
            <span>웨일프렌즈 카드대결</span>
          </span>
        </Link>

        <nav className="menu-nav" aria-label="게임 메뉴">
          <Link href="/game/" className="menu-nav-btn primary">
            튜토리얼 ▶
          </Link>
          <Link href="/game/pvp/" className="menu-nav-btn primary">
            PvP 대전 ▶
          </Link>
          <Link href="/rules/" className="menu-nav-btn ghost">
            게임 방법
          </Link>
          <Link href="/conditions/" className="menu-nav-btn ghost">
            참가 방법
          </Link>
        </nav>
      </motion.header>

      {/* ===== 헤더 밑 본문 — 영상 + 버튼 묶음 그룹을 body 정중앙 배치 ===== */}
      <div className="menu-body">
        <div className="menu-stage">
          {/* 영상 + 버튼 한 그룹 (=같은 폭). body 정중앙. 버튼은 그룹 내부 좌상단. */}
          <div className="menu-video-group">
            {/* 기능 선택 버튼 — 영상 바로 위 좌측 정렬.
                클릭 시 즉시 해당 영상으로 슬라이드. 자동 사이클 그대로. */}
            {FEATURES.length > 1 && (
              <nav className="menu-feature-list" aria-label="기능 영상 선택">
                {FEATURES.map((f, i) => {
                  const active = i === currentIdx;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`menu-feature-btn${active ? " is-active" : ""}`}
                      onClick={() => selectFeature(i)}
                      aria-pressed={active}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </nav>
            )}

            <motion.div
              className="menu-video-frame"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
            >
          {currentId ? (
            <>
              {/* initial={false} — 첫 영상은 슬라이드 없이 그냥 등장. 이후 전환만 슬라이드. */}
              <AnimatePresence initial={false}>
                <motion.div
                  key={`${tick}-${currentId}`}
                  className="menu-video-slide"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <VideoFrame
                    id={currentId}
                    useNativeLoop={single}
                    muted={muted}
                    onEnded={single ? undefined : goNext}
                  />
                </motion.div>
              </AnimatePresence>
              {/* 음소거 토글 — 우하단. 운영진이 한 번 클릭하면 unmute + 볼륨 100%.
                  다음 영상으로 슬라이드되어도 unmute 상태 유지. */}
              <button
                type="button"
                className="menu-video-mute-toggle"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "음소거 해제" : "음소거"}
                aria-pressed={!muted}
                title={muted ? "음소거 해제" : "음소거"}
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </>
          ) : (
            <div className="menu-video-placeholder">
              <span className="menu-video-placeholder-emoji" aria-hidden>
                🎬
              </span>
              <strong>영상 준비 중</strong>
              <span className="text-sm opacity-75">
                MainMenu.tsx 의 <code>YOUTUBE_VIDEO_IDS</code> 에 ID 입력
              </span>
              </div>
            )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
