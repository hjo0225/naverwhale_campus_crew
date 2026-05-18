"use client";

import Link from "next/link";
import { useMemo } from "react";
import { REFERRAL_CODE } from "@/lib/config";
import { useGameStore } from "@/lib/store/gameStore";
import { FullPageSlider } from "@/components/ui/FullPageSlider";

/**
 * PC 안내 화면 — 데스크톱 네이버 웨일 설치 + 추천인 코드 등록 6단계.
 * 모바일 `ConditionsScreen`과 동일한 풀페이지 슬라이더 + 휠 동선을 따른다.
 */

function IntroPage() {
  return (
    <div className="grid md:grid-cols-[1.1fr_1fr] gap-12 items-center">
      <div className="text-center md:text-left">
        <span className="eyebrow mb-5">참가 방법 · PC</span>
        <h1 className="display-h1 mt-4 mb-6">
          6단계로 끝나는
          <br />
          PC 부스 참여
        </h1>
        <p className="text-lg text-(--color-text-secondary) max-w-[480px] mx-auto md:mx-0 mb-2">
          마우스 휠을 굴려서 단계별로 확인하세요.
        </p>
        <p className="text-base text-(--color-text-muted) max-w-[480px] mx-auto md:mx-0">
          네이버 웨일을 PC에 설치한 뒤, 추천인 코드를 등록하고
          <br />
          등록 화면을 부스 운영진에게 보여주시면 됩니다.
        </p>
      </div>
      <div className="aspect-[16/10] flex items-center justify-center p-4">
        <img
          src="/wf_02.png"
          alt="웨일프렌즈 캐릭터들"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

interface PcStep {
  num: string;
  title: string;
  desc: string;
  img: string;
}

const PC_STEPS: readonly PcStep[] = [
  {
    num: "STEP 01",
    title: "네이버 검색",
    desc: "네이버 검색창에 '네이버웨일'을 입력하세요.",
    img: "/conditions/pc/step-1-search.png",
  },
  {
    num: "STEP 02",
    title: "웨일 홈페이지 이동",
    desc: "검색 결과 상단의 네이버 웨일 영역을 클릭해 공식 페이지로 이동합니다.",
    img: "/conditions/pc/step-2-home.png",
  },
  {
    num: "STEP 03",
    title: "웨일 다운로드",
    desc: "메인의 [웨일 다운로드] 버튼을 눌러 설치 파일을 받은 뒤 실행하세요.",
    img: "/conditions/pc/step-3-download.png",
  },
  {
    num: "STEP 04",
    title: "맞춤설정 메뉴",
    desc: "설치 후 웨일을 실행하고, 우측 상단의 ⋮ (네이버 웨일 맞춤설정 및 제어) 버튼을 누르세요.",
    img: "/conditions/pc/step-4-menu.png",
  },
  {
    num: "STEP 05",
    title: "설정 열기",
    desc: "열린 메뉴 하단의 [설정] 항목을 클릭합니다.",
    img: "/conditions/pc/step-5-settings.png",
  },
];

function PcStepPage({ s }: { s: PcStep }) {
  return (
    <div className="text-center max-w-[880px] mx-auto flex flex-col items-center px-4">
      <span className="eyebrow mb-2">{s.num}</span>
      <h2 className="display-h2 mt-2 mb-3">{s.title}</h2>
      <p className="text-base sm:text-lg text-text-secondary mb-5 max-w-[640px]">
        {s.desc}
      </p>
      <div className="flex items-center justify-center w-full">
        <img
          src={s.img}
          alt={s.title}
          className="max-h-[58dvh] max-w-full w-auto h-auto rounded-lg border border-(--color-divider) shadow-(--shadow-soft) bg-white"
        />
      </div>
    </div>
  );
}

function Step6Page({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="text-center max-w-[1000px] mx-auto px-4">
      <span className="eyebrow mb-2">STEP 06</span>
      <h2 className="display-h2 mt-2 mb-3">추천인 코드 등록</h2>
      <p className="text-base sm:text-lg text-text-secondary mb-6 max-w-[640px] mx-auto">
        설정 화면의 [추천인 코드] 항목에 아래 코드를 입력하고 [등록] 버튼을 눌러주세요.
      </p>

      <div className="flex flex-col items-center gap-4 w-full max-w-[520px] mx-auto">
        <img
          src="/conditions/pc/step-6-code.png"
          alt="추천인 코드 등록 화면"
          className="w-full h-auto rounded-lg border border-(--color-divider) shadow-(--shadow-soft) bg-white"
        />
        <div className="surface-card brand flex items-center justify-between gap-4 w-full">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.15em]">
            {REFERRAL_CODE}
          </span>
          <button className="cta-btn cta-btn-primary" onClick={onCopy}>
            복사
          </button>
        </div>
        <p className="text-sm text-text-muted">
          복사 후 PC 웨일 설정 화면에 붙여넣기
        </p>
      </div>
    </div>
  );
}

function FinalPage() {
  return (
    <div className="text-center max-w-[760px] mx-auto">
      <span className="eyebrow mb-2 sm:mb-5">STEP 07</span>
      <h2 className="display-h2 mt-2 mb-3 sm:mt-4 sm:mb-6">
        현장 인증 후 게임 참여
      </h2>
      <p className="text-sm sm:text-lg text-text-secondary max-w-[540px] mx-auto mb-4 sm:mb-10">
        등록 완료 화면을 부스 운영진에게 보여주면 게임을 즐길 수 있어요.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 max-w-[400px] sm:max-w-[600px] mx-auto mb-4 sm:mb-10">
        <div className="text-center">
          <div className="surface-card muted aspect-square flex items-center justify-center text-text-muted mb-2 sm:mb-3 text-xs sm:text-base p-2">
            키캡 이미지
            <br />
            (추후 삽입)
          </div>
          <div className="text-sm sm:text-base font-bold">키캡</div>
        </div>
        <div className="text-center">
          <div className="surface-card muted aspect-square flex items-center justify-center text-text-muted mb-2 sm:mb-3 text-xs sm:text-base p-2">
            인형 이미지
            <br />
            (추후 삽입)
          </div>
          <div className="text-sm sm:text-base font-bold">인형</div>
        </div>
      </div>

      <div className="surface-card accent max-w-[400px] sm:max-w-[600px] mx-auto mb-4 sm:mb-8 text-left px-4 sm:px-8 py-3 sm:py-7">
        <div className="text-[10px] sm:text-xs font-bold tracking-[0.12em] text-accent-deep mb-1.5 sm:mb-3">
          참여 안내
        </div>
        <p className="text-xs sm:text-base leading-relaxed text-text-secondary">
          <strong className="text-(--color-text)">
            참가 시 키캡 또는 인형 택1, 1등 시 둘 다 증정!
          </strong>
        </p>
      </div>

      <Link
        href="/conditions/rules/"
        className="cta-btn cta-btn-primary cta-btn-pill text-sm sm:text-xl px-6 py-3 sm:px-10 sm:py-5"
      >
        게임 미리 체험하기 →
      </Link>
    </div>
  );
}

export function ConditionsPcScreen() {
  const showToast = useGameStore((s) => s.showToast);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
      showToast("코드가 복사되었어요!");
    } catch {
      showToast("복사 실패. 직접 입력해주세요.");
    }
  }

  const pages = useMemo(
    () => [
      <IntroPage key="intro" />,
      ...PC_STEPS.map((s, i) => <PcStepPage key={`pc-${i + 1}`} s={s} />),
      <Step6Page key="step6" onCopy={copyCode} />,
      <FinalPage key="final" />,
    ],
    // copyCode는 store selector + 클로저라 매 렌더 새 ref. showToast는 안정적이므로 deps 비움.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return <FullPageSlider pages={pages} mode="wheel" variant="light" />;
}
