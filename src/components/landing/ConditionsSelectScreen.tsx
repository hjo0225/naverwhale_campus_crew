"use client";

import Link from "next/link";

/**
 * 참가 안내 진입 화면 — 손님이 모바일 안내를 볼지 PC 안내를 볼지 고르는 분기 페이지.
 * 기존 `/conditions/`로 들어오던 동선이 이 화면을 거치도록 라우팅 재구성됨.
 * 운영진은 홈으로 돌아갈 때 `1`/`H`/`Esc` 단축키를 사용한다.
 */
export function ConditionsSelectScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[860px] text-center">
        <span className="eyebrow mb-5">참가 안내</span>
        <h1 className="display-h1 mt-4 mb-4">
          어떤 환경으로
          <br />
          참여하시나요?
        </h1>
        <p className="text-base sm:text-lg text-(--color-text-secondary) max-w-[520px] mx-auto mb-10">
          이용 중인 환경에 맞는 안내를 골라주세요.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <Link
            href="/conditions/pc/"
            className="surface-card flex flex-col items-center justify-center gap-4 px-6 py-10 transition-transform hover:-translate-y-1"
          >
            {/* 조건 강조 — 카드 맨 위. 브랜드 컬러 좌측 바 (▎) + 연한 브랜드 배경 = PC 가 우선 선택지 */}
            <span className="self-stretch text-sm sm:text-base font-bold text-(--color-brand-deep) bg-(--color-brand-soft) border-l-4 border-(--color-brand) py-2.5 px-3.5 rounded-r-md text-left">
              노트북(PC)가 있는 경우
            </span>
            <span className="text-5xl" aria-hidden>
              💻
            </span>
            <span className="text-xl sm:text-2xl font-extrabold">
              노트북(PC) 안내
            </span>
          </Link>

          <Link
            href="/conditions/mobile/"
            className="surface-card flex flex-col items-center justify-center gap-4 px-6 py-10 transition-transform hover:-translate-y-1"
          >
            {/* 조건 강조 — 카드 맨 위. 중성 회색 좌측 바 = 모바일은 PC 없을 때만 보는 fallback */}
            <span className="self-stretch text-sm sm:text-base font-bold text-(--color-text-secondary) bg-(--color-board-soft) border-l-4 border-(--color-text-muted) py-2.5 px-3.5 rounded-r-md text-left">
              노트북(PC)가 없는 경우
            </span>
            <span className="text-5xl" aria-hidden>
              📱
            </span>
            <span className="text-xl sm:text-2xl font-extrabold">
              모바일 안내
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
