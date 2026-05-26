"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/lib/store/gameStore";

// 게임 메인 메뉴 — 홈(`/`). 헤더에 메뉴, 가운데에 YouTube attract 영상.
// 라우팅은 그대로: 헤더 버튼이 기존 라우트로 이동한다.

// ===== 영상 설정 =====
// YouTube video ID 를 순서대로 넣으세요.
// - 1개:    그 영상이 YouTube 자체 루프로 무한 반복.
// - 여러 개: 영상이 끝나면 오른쪽에서 다음 영상이 슬라이드되어 들어오고
//           마지막 영상이 끝나면 처음으로 돌아와 끝없이 사이클.
// - 비어 있음: "영상 준비 중" 자리표시.
// 예: ["abc123XYZ_4", "def456ABC_8"]
const YOUTUBE_VIDEO_IDS: readonly string[] = [
  "MdBZmVCh80o", // 듀얼탭
  "als8Xcz3Hro", // 퀵서치
  "BO7jBVuWbrQ", // 마우스 제스처
  "7miScf_vR8E", // 사이드바
  "QyHzHpSUQ1M", // (신규) 멀티플레이
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

// 영상 한 개를 띄우는 iframe + ENDED 후크.
// onEnded 가 있으면(여러 개 모드) IFrame API 에 붙어 종료 감지.
function VideoFrame({
  id,
  useNativeLoop,
  onEnded,
}: {
  id: string;
  useNativeLoop: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onEnded) return; // 싱글 모드: 네이티브 루프라 API 불필요
    const iframe = ref.current;
    if (!iframe) return;

    let player: YtPlayer | null = null;
    let cancelled = false;

    void loadYtApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const ENDED = window.YT.PlayerState.ENDED;
      player = new window.YT.Player(iframe, {
        events: {
          onStateChange: (e) => {
            if (e.data === ENDED) onEnded();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        // 이미 파괴됐거나 API 미초기화 — 무시
      }
    };
  }, [id, onEnded]);

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

  // tick — 영상이 끝날 때마다 +1. mod 가 아니라 단조 증가라 같은 ID 가 다시 와도
  // key 가 항상 달라 슬라이드 애니메이션이 발동한다.
  const [tick, setTick] = useState(0);
  const total = YOUTUBE_VIDEO_IDS.length;
  const single = total === 1;
  const currentId = total > 0 ? YOUTUBE_VIDEO_IDS[tick % total]! : null;

  const goNext = useCallback(() => {
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
            싱글 플레이 ▶
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

      {/* ===== 가운데 — YouTube attract 영상 (여러 개면 끝없이 사이클) ===== */}
      <div className="menu-stage">
        <motion.div
          className="menu-video-frame"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
        >
          {currentId ? (
            // initial={false} — 첫 영상은 슬라이드 없이 그냥 등장. 이후 전환만 슬라이드.
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
                  onEnded={single ? undefined : goNext}
                />
              </motion.div>
            </AnimatePresence>
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
  );
}
