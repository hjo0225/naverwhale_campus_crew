"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { selectMySeat, usePvpStore } from "@/lib/store/pvpStore";
import { playBgm, stopBgm } from "@/lib/audio/sounds";

export function PvpResultScreen() {
  const router = useRouter();
  const room = usePvpStore((s) => s.room);
  const mySeat = usePvpStore(selectMySeat);
  const nextGame = usePvpStore((s) => s.nextGame);
  const state = room?.state;
  const history = state?.roundHistory ?? [];
  const last = history[history.length - 1];

  const myPlaceForBgm =
    last && mySeat !== null
      ? last.scores.find((s) => s.name === state?.players[mySeat]?.name)?.place ??
        last.scores.length
      : null;

  // 결과 BGM — 1등이면 승리, 그 외엔 위로 음악. 딱 한 번만 재생(루프 X).
  useEffect(() => {
    if (myPlaceForBgm == null) return;
    playBgm(myPlaceForBgm === 1 ? "resultWin" : "resultOther", { loop: false });
    return () => {
      stopBgm();
    };
  }, [myPlaceForBgm]);

  if (!state || mySeat === null) return null;
  if (!last) return null;

  const myRow = last.scores.find((s) => s.name === state.players[mySeat]?.name);
  const myPlace = myRow?.place ?? last.scores.length;

  const sorted = [...last.scores].sort((a, b) => a.place - b.place);

  const prizeLine =
    myPlace === 1
      ? "🏆 1등! 키캡 + 인형 둘 다!"
      : myPlace === last.scores.length
        ? "💪 응원품 받아 가세요"
        : `🎁 ${myPlace}등 — 키캡 또는 인형 택 1`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-lg rounded-3xl bg-white/95 p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">결과</h1>
        <p className="mb-6 text-center text-lg font-semibold text-emerald-700">
          {prizeLine}
        </p>

        <div className="mb-6 space-y-2">
          {sorted.map((s) => {
            const isMe = s.name === state.players[mySeat]?.name;
            return (
              <div
                key={s.name}
                className={
                  "flex items-center justify-between rounded-xl px-4 py-2 " +
                  (isMe ? "bg-emerald-50 font-bold" : "bg-slate-50")
                }
              >
                <span>
                  {s.place}등 · {s.name}
                  {isMe && " (나)"}
                </span>
                <span className="text-slate-600">
                  {s.score === 0 ? "0" : `-${s.score}`}점
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            // 백그라운드로 PvP 방·구독 정리 시작 (await 안 함 — leave 가 unsub/timer 자체 정리).
            void nextGame();
            router.push("/");
          }}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-emerald-600"
        >
          처음으로
        </button>
      </div>
    </div>
  );
}
