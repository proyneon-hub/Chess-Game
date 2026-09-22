"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type Square,
  type PromotionKind,
  getLegalMoves,
  isWhite,
  sameSquare,
  squareName,
  isInCheck,
} from "@/lib/chess";
import { type Difficulty, type GameKind } from "@/lib/game";
import type { Intention } from "@/lib/game/types";
import { publicState } from "@/lib/game/publicState";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useOnlineMatch } from "@/hooks/useOnlineMatch";
import { useComputerTurn } from "@/hooks/useComputerTurn";
import { EncounterArea } from "@/components/chess/EncounterArea";
import { Board } from "@/components/chess/Board";
import { Promotion } from "@/components/chess/Promotion";
import { GameHistory } from "@/components/chess/GameHistory";
const button =
  "rounded border border-stone-600 px-4 py-2 text-sm text-stone-200 hover:bg-stone-900 disabled:opacity-40";
export default function ChessBoard({
  onlineSupported = true,
}: {
  onlineSupported?: boolean;
}) {
  const [kind, setKind] = useState<GameKind | null>(null),
    [difficulty, setDifficulty] = useState<Difficulty>("normal"),
    [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<Intention | null>(null),
    [message, setMessage] = useState("Choose how you would like to play."),
    [notice, setNotice] = useState("");
  const local = useLocalGame(),
    online = useOnlineMatch(),
    { open, leave } = online;
  const visible = online.remote?.state ?? publicState(local.game),
    side =
      kind === "online"
        ? online.remote?.playerSide
        : kind === "local"
          ? visible.sideToMove
          : "white";
  const { thinking: computerThinking, failure: computerFailure } =
    useComputerTurn(
      local.game,
      kind === "computer",
      difficulty,
      local.submit,
      setMessage,
    );
  const myTurn =
    !!side &&
    side === visible.sideToMove &&
    visible.status === "active" &&
    !computerThinking &&
    !(
      kind === "online" &&
      (!online.remote ||
        online.remote.waitingForOpponent ||
        online.busy ||
        online.retryable)
    );
  const moves = useMemo(
    () =>
      selected && side
        ? getLegalMoves(
            visible.board,
            ...selected,
            side === "white",
            visible.rights,
          )
        : [],
    [selected, side, visible.board, visible.rights],
  );
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("match");
    if (id && onlineSupported) {
      setKind("online");
      void open(id);
    }
  }, [open, onlineSupported]);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [online.remote?.version, local.game.revision]);
  const clearUrl = () => history.replaceState({}, "", location.pathname);
  const start = (mode: "local" | "computer") => {
    leave();
    clearUrl();
    local.reset();
    setKind(mode);
    setSelected(null);
    setPromotion(null);
    setNotice("");
    setMessage("White to move.");
  };
  const send = (intent: Intention | { type: "claim-draw" }) => {
    if (!myTurn || !side) return;
    setSelected(null);
    setPromotion(null);
    if (kind === "online") void online.send(intent);
    else setMessage(local.submit({ ...intent, side }).message);
  };
  const square = (sq: Square) => {
    if (!myTurn) return;
    if (selected && moves.some((m) => sameSquare(m, sq))) {
      const intent = { from: selected, to: sq };
      if (
        visible.board[selected[0]][selected[1]]?.toLowerCase() === "p" &&
        (sq[0] === 0 || sq[0] === 7)
      )
        setPromotion(intent);
      else send(intent);
      return;
    }
    const p = visible.board[sq[0]][sq[1]];
    setSelected(p && (isWhite(p) ? "white" : "black") === side ? sq : null);
  };
  const reset = () => {
    setSelected(null);
    setPromotion(null);
    if (kind === "online") {
      leave();
      clearUrl();
      setKind(null);
      setMessage("Choose how you would like to play.");
    } else start(kind ?? "local");
  };
  if (!kind)
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
        <h1 className="text-4xl font-light uppercase tracking-[.35em] text-amber-600">
          Chess
        </h1>
        <p className="mt-5 text-sm text-stone-400">
          Choose your opponent and start a game.
        </p>
        <div className="mt-8 grid w-full gap-3">
          <button
            className={button + " py-4 text-left"}
            onClick={() => start("local")}
          >
            Play here
            <span className="block text-xs text-stone-400">
              Two players on one board
            </span>
          </button>
          <div className="rounded border border-stone-600">
            <button
              className="w-full px-4 py-4 text-left text-stone-200"
              onClick={() => start("computer")}
            >
              Play computer
              <span className="block text-xs text-stone-400">
                You play White
              </span>
            </button>
            <label className="flex items-center gap-3 border-t border-stone-700 px-4 py-2 text-xs text-stone-300">
              Difficulty
              <select
                aria-label="Difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="rounded bg-stone-900 p-2"
              >
                <option value="normal">Normal</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          {onlineSupported && (
            <button
              className={button + " py-4 text-left"}
              onClick={() => {
                setKind("online");
                void open();
              }}
            >
              Play online
              <span className="block text-xs text-stone-400">
                Create a private invite game
              </span>
            </button>
          )}
        </div>
        <p role="status" className="mt-5 text-sm text-stone-300">
          {message}
        </p>
      </div>
    );
  const status =
    visible.result ??
    (isInCheck(visible.board, visible.sideToMove === "white")
      ? "Check!"
      : null) ??
    visible.warning?.message ??
    (kind === "online"
      ? online.error ||
        (!online.remote
          ? "Opening the match…"
          : online.remote.waitingForOpponent
            ? "Waiting for an opponent to join."
            : online.busy
              ? "Submitting move…"
              : visible.lastAction?.message ||
                (isInCheck(visible.board, visible.sideToMove === "white")
                  ? "Check!"
                  : "Select a piece and destination."))
      : computerThinking
        ? "Your opponent is considering the board."
        : message);
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-3 py-6 sm:px-6">
      <h1 className="text-3xl font-light uppercase tracking-widest text-amber-600">
        Chess
      </h1>
      <div className="mt-6 grid w-full max-w-[1080px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,580px)_minmax(280px,360px)] lg:gap-8">
        <Board
          game={visible}
          selected={selected}
          moves={moves}
          flipped={kind === "online" && side === "black"}
          onSquare={square}
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
          </div>
          <EncounterArea encounters={visible.encounters ?? []} />
          {notice && (
            <p role="status" className="text-sm text-stone-300">
              {notice}
            </p>
          )}
          {kind === "computer" && computerFailure && (
            <p role="status" className="text-sm text-stone-400">
              {computerFailure}
            </p>
          )}
          {kind === "online" && online.error && visible.warning && (
            <p role="alert" className="text-sm text-amber-200">
              {online.error}
            </p>
          )}
          {kind === "online" &&
            online.remote?.playerSide === "white" &&
            online.remote.waitingForOpponent && (
              <button
                className={button}
                onClick={() =>
                  void navigator.clipboard.writeText(location.href).then(
                    () =>
                      setNotice(
                        "Invite link copied. Your opponent will play Black.",
                      ),
                    () =>
                      setNotice("Copy the invite address from your browser."),
                  )
                }
              >
                Copy invite link
              </button>
            )}
          {kind === "online" &&
            online.remote?.playerSide === null &&
            online.remote.waitingForOpponent && (
              <button
                disabled={online.busy}
                className={button}
                onClick={() => void online.join()}
              >
                Join as Black
              </button>
            )}
          {kind === "online" && online.retryable && (
            <button
              className={button}
              disabled={online.busy}
              onClick={() => void online.send()}
            >
              Retry connection
            </button>
          )}
          {visible.pendingRefusal && (
            <div className="text-sm text-stone-300">
              <p>
                Order: {squareName(visible.pendingRefusal.from)} to{" "}
                {squareName(visible.pendingRefusal.to)}.
              </p>
              <button
                disabled={!myTurn}
                className={button + " mt-2"}
                onClick={() => send(visible.pendingRefusal!)}
              >
                Repeat order
              </button>
            </div>
          )}
          {(visible.drawClaims.threefold || visible.drawClaims.fiftyMove) &&
            visible.status === "active" && (
              <button
                disabled={!myTurn}
                className={button}
                onClick={() => send({ type: "claim-draw" })}
              >
                Claim draw
              </button>
            )}
          <GameHistory game={visible} />
          <div className="flex gap-2">
            <button className={button + " flex-1"} onClick={reset}>
              {kind === "online" ? "Leave" : "New Game"}
            </button>
            <button
              className={button + " flex-1"}
              disabled={kind !== "local" || !local.canUndo}
              onClick={() => {
                setMessage(local.undo());
                setSelected(null);
                setPromotion(null);
              }}
            >
              Undo
            </button>
          </div>
          <button
            className={button}
            onClick={() => {
              leave();
              clearUrl();
              setKind(null);
              setPromotion(null);
              setSelected(null);
              setNotice("");
              setMessage("Choose how you would like to play.");
              local.reset();
            }}
          >
            Choose opponent
          </button>
          <details className="text-sm text-stone-300">
            <summary>Controls</summary>
            <p className="mt-2">
              Select a piece, then a highlighted destination. Use Tab or arrow
              keys to focus squares and Enter to select. Choose a piece when
              promoting a pawn.
            </p>
            {visible.events.some((e) => e.message.includes("hesitates")) && (
              <p className="mt-2">
                After hesitation, repeat the order or select a different legal
                move. Inspect the event log for earlier observations.
              </p>
            )}
          </details>
        </aside>
      </div>
      {promotion && (
        <Promotion
          onChoose={(p: PromotionKind) => send({ ...promotion, promotion: p })}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );
}
