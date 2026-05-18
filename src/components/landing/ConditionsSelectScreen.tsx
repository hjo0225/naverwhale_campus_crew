"use client";

import Link from "next/link";

/**
 * 참가 안내 진입 화면 — 손님이 모바일 안내를 볼지 PC 안내를 볼지 고르는 분기 페이지.
 * 기존 `/conditions/`로 들어오던 동선이 이 화면을 거치도록 라우팅 재구성됨.
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
          이용 중인 기기에 맞는 안내를 골라주세요.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <Link
            href="/conditions/mobile/"
            className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-10 transition-transform hover:-translate-y-1"
          >
            <span className="text-5xl" aria-hidden>
              📱
            </span>
            <span className="text-xl sm:text-2xl font-extrabold">
              모바일 안내
            </span>
            <span className="text-sm text-(--color-text-secondary)">
              스마트폰 웨일 앱으로 참여
            </span>
          </Link>

          <Link
            href="/conditions/pc/"
            className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-10 transition-transform hover:-translate-y-1"
          >
            <span className="text-5xl" aria-hidden>
              💻
            </span>
            <span className="text-xl sm:text-2xl font-extrabold">
              PC 안내
            </span>
            <span className="text-sm text-(--color-text-secondary)">
              데스크톱 웨일 브라우저로 참여
            </span>
          </Link>
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm text-(--color-text-muted) hover:text-(--color-text)"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
