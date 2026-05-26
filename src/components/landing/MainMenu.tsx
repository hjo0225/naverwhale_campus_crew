"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/lib/store/gameStore";
import { VIDEO_BASE_URL } from "@/lib/config";

// 게임 메인 메뉴 — 홈(`/`). 헤더에 메뉴, 가운데에 attract 영상.
// 라우팅은 그대로: 헤더 버튼이 기존 라우트로 이동한다.
//
// 영상은 native <video> + GCS 공개 버킷 (config.VIDEO_BASE_URL).
// YouTube 임베드는 봇 검증 캡차로 부스 운영에 리스크 → CDN 정적 호스팅으로 대체.
// 바이너리는 깃 repo 와 분리 (gitignore) — 코드 푸시와 영상 교체가 독립.

// ===== 영상 설정 =====
// 각 기능별 영상. 왼쪽 버튼을 누르면 즉시 그 영상으로 슬라이드되고, 영상이 끝나면
// 다음 기능으로 자동 사이클(attract). 마지막 → 처음 무한 반복.
// - 1개:    그 영상이 HTML5 loop 으로 무한 반복.
// - 비어 있음: "영상 준비 중" 자리표시.
interface Feature {
  id: string;
  label: string;
  src: string;
}
const FEATURES: readonly Feature[] = [
  { id: "dual-tab", label: "듀얼탭", src: `${VIDEO_BASE_URL}/dual-tab.mp4` },
  { id: "gesture", label: "마우스 제스처", src: `${VIDEO_BASE_URL}/mouse-gesture.mp4` },
  { id: "sidebar", label: "사이드바", src: `${VIDEO_BASE_URL}/sidebar.mp4` },
  { id: "multiplay", label: "멀티플레이", src: `${VIDEO_BASE_URL}/multiplay.mp4` },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// 영상 한 개를 띄우는 <video> 요소.
// - autoplay + muted: 모든 브라우저 자동재생 정책 통과
// - playsInline: iOS 에서 fullscreen 가로채기 방지
// - onEnded (여러 개 모드): 다음 영상으로 사이클
// - muted prop: 부모 토글 상태. 변경 시 element.muted 즉시 반영(+ volume 100%).
//   초기 attract 모드는 muted=true (autoplay 정책).
function VideoFrame({
  src,
  loop,
  muted,
  onEnded,
}: {
  src: string;
  loop: boolean;
  muted: boolean;
  onEnded?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  // muted prop 변경 → element 에 즉시 반영
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) v.volume = 1;
    // 일부 환경에서 muted 변경 직후 자동재생이 멈출 수 있음 → play() 재호출.
    // 사용자 제스처 안에서 호출되었으면 음소거 해제 후 소리 재생까지 허용됨.
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [muted]);

  return (
    <video
      ref={ref}
      className="menu-video"
      src={src}
      autoPlay
      muted={muted}
      loop={loop}
      playsInline
      preload="auto"
      controls={false}
      onEnded={onEnded}
      // poster 는 생략 — 즉시 첫 프레임 표시되도록 preload=auto 에 맡김.
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
  const currentSrc = current?.src ?? null;

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
        <Link href="/" className="menu-logo" aria-label="홈">
          <img
            src="/logo.png"
            alt="RACHIOS"
            className="menu-logo-img"
            draggable={false}
          />
        </Link>

        <nav className="menu-nav" aria-label="게임 메뉴">
          <Link href="/game/" className="menu-nav-btn primary">
            튜토리얼 ▶
          </Link>
          <Link href="/game/pvp/" className="menu-nav-btn primary">
            PvP 대전 ▶
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
              {currentSrc ? (
                <>
                  {/* initial={false} — 첫 영상은 슬라이드 없이 그냥 등장. 이후 전환만 슬라이드. */}
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={`${tick}-${currentSrc}`}
                      className="menu-video-slide"
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ duration: 0.55, ease: EASE }}
                    >
                      <VideoFrame
                        src={currentSrc}
                        loop={single}
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
                    MainMenu.tsx 의 <code>FEATURES</code> 에 영상 경로 입력
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
