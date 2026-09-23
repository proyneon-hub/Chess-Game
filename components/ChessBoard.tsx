"use client";
import { useState } from "react";
import type { PromotionKind } from "@/lib/chess";
import type { PublicGame } from "@/lib/game/publicState";
import { useGameSession } from "@/hooks/useGameSession";
import { EncounterArea } from "@/components/chess/EncounterArea";
import { Board } from "@/components/chess/Board";
import { Promotion } from "@/components/chess/Promotion";
import { GameHistory } from "@/components/chess/GameHistory";
import { ModeMenu } from "@/components/chess/ModeMenu";
import { ConfirmDialog } from "@/components/chess/ConfirmDialog";
import { OnlineControls } from "@/components/chess/OnlineControls";
import { TurnActions } from "@/components/chess/TurnActions";
import { ControlsHelp } from "@/components/chess/ControlsHelp";
import { statusText } from "@/components/chess/statusText";
import { button } from "@/components/chess/styles";
const NO_ENCOUNTERS: NonNullable<PublicGame["encounters"]> = [];
export default function ChessBoard() {
  const session = useGameSession(),
    { kind, visible, online, myTurn, send } = session;
  const [confirming, setConfirming] = useState<(() => void) | null>(null);
  const confirmDiscard = (action: () => void) => () =>
    session.inProgress ? setConfirming(() => action) : action();
  if (!kind)
    return (
      <ModeMenu
        difficulty={session.difficulty}
        message={session.message}
        onDifficulty={session.setDifficulty}
        onStart={session.start}
        onOnline={session.playOnline}
      />
    );
  if (!visible)
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
        <h1 className="text-3xl font-light uppercase tracking-widest text-amber-600">
          Chess
        </h1>
        <p role="status" className="mt-5 text-sm text-stone-300">
          {kind === "online"
            ? online.error || "Opening the match…"
            : "Loading the board…"}
        </p>
        <button className={button + " mt-6"} onClick={session.chooseOpponent}>
          Choose opponent
        </button>
      </div>
    );
  const status = statusText({
    game: visible,
    kind,
    online,
    computerThinking: session.computerThinking,
    message: session.message,
  });
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-3 py-6 sm:px-6">
      <h1 className="text-3xl font-light uppercase tracking-widest text-amber-600">
        Chess
      </h1>
      <div className="mt-6 grid w-full max-w-[1080px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,580px)_minmax(280px,360px)] lg:gap-8">
        <Board
          game={visible}
          selected={session.selected}
          moves={session.moves}
          flipped={kind === "online" && session.side === "black"}
          onSquare={session.onSquare}
          requested={(visible.encounters ?? NO_ENCOUNTERS)
            .filter((e) => !e.outcome && e.side === session.side)
            .flatMap((e) => e.participants.map((p) => p.square))}
        />
        <aside className="flex min-w-0 flex-col gap-4">
          <div className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-stone-200">
            {visible.status === "finished"
              ? "Game Over"
              : `${visible.sideToMove === "white" ? "White" : "Black"} to Move`}
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="rounded border border-amber-500/45 bg-slate-950/80 px-4 py-3 text-sm text-stone-200"
          >
            {status}
            {/* One live region: secondary notices announce with the status. */}
            {session.notice && (
              <span className="mt-2 block text-stone-300">
                {session.notice}
              </span>
            )}
            {kind === "computer" && session.computerFailure && (
              <span className="mt-2 block text-stone-400">
                {session.computerFailure}
              </span>
            )}
          </div>
          <EncounterArea
            encounters={visible.encounters ?? NO_ENCOUNTERS}
            quietSide={kind === "computer" ? "black" : undefined}
          />
          {kind === "online" && online.error && visible.warning && (
            <p role="alert" className="text-sm text-amber-200">
              {online.error}
            </p>
          )}
          {kind === "online" && (
            <OnlineControls online={online} onNotice={session.setNotice} />
          )}
          <TurnActions game={visible} myTurn={myTurn} send={send} />
          <GameHistory game={visible} />
          <div className="flex gap-2">
            <button
              className={button + " flex-1"}
              onClick={confirmDiscard(session.reset)}
            >
              {kind === "online" ? "Leave" : "New Game"}
            </button>
            <button
              className={button + " flex-1"}
              disabled={!session.canUndo}
              onClick={session.undo}
            >
              Undo
            </button>
          </div>
          <button
            className={button}
            onClick={confirmDiscard(session.chooseOpponent)}
          >
            Choose opponent
          </button>
          {confirming && (
            <ConfirmDialog
              onConfirm={() => {
                setConfirming(null);
                confirming();
              }}
              onCancel={() => setConfirming(null)}
            />
          )}
          <ControlsHelp game={visible} />
        </aside>
      </div>
      {session.promotion && (
        <Promotion
          onChoose={(p: PromotionKind) =>
            send({ ...session.promotion!, promotion: p })
          }
          onCancel={session.cancelPromotion}
        />
      )}
    </div>
  );
}
