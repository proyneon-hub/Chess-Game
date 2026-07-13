"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Board, type Square, PIECE_SYMBOLS, getLegalMoves, isInCheck, isWhite } from "@/lib/chess";
import { type Difficulty, type GameKind, type GameState, type MoveAttempt, type Side, DEPTH_FOR, createGameState, submitMove } from "@/lib/game";
import { getBestMoves } from "@/lib/ai";
import { describeKing } from "@/lib/rpgChess";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
type StatusType = "info" | "success" | "warning" | "error" | "special";
type VisibleGame = Omit<GameState, "pieceIds" | "rpgState">;
type PublicMatch = {
  id: string;
  playerSide: Side | null;
  waitingForOpponent: boolean;
  version: number;
  state: VisibleGame;
};

const statusStyles: Record<StatusType, string> = {
  info: "border-blue-500/45 bg-slate-950/80 text-stone-200",
  success: "border-emerald-500/55 bg-slate-950/80 text-emerald-100",
  warning: "border-amber-500/65 bg-slate-950/80 text-amber-100",
  error: "border-red-500/65 bg-slate-950/80 text-red-100",
  special: "border-amber-300/75 bg-slate-950/80 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
};

const findKingSquare = (board: Board, side: Side): Square | null => {
  const king = side === "white" ? "K" : "k";
  for (let row = 0; row < 8; row += 1)
    for (let col = 0; col < 8; col += 1)
      if (board[row][col] === king) return [row, col];
  return null;
};

const sameSquare = (first: Square, second: Square) => first[0] === second[0] && first[1] === second[1];

export default function ChessBoard() {
  const [kind, setKind] = useState<GameKind | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [game, setGame] = useState<GameState>(createGameState);
  const [remote, setRemote] = useState<PublicMatch | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [message, setMessage] = useState("Choose how you would like to play.");
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [creatingOnline, setCreatingOnline] = useState(false);
  const [computerThinking, setComputerThinking] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugAvailable, setDebugAvailable] = useState(false);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const onlineMatchId = useRef<string | null>(null);

  const visible: VisibleGame = remote?.state ?? game;
  const playerSide = kind === "online"
    ? remote?.playerSide ?? null
    : kind === "local"
      ? visible.sideToMove
      : "white";
  const isMyTurn = !!playerSide && visible.sideToMove === playerSide && visible.status === "active";
  const checkedKing = isInCheck(visible.board, visible.sideToMove === "white")
    ? findKingSquare(visible.board, visible.sideToMove)
    : null;

  const clearSelection = useCallback(() => {
    setSelected(null);
    setValidMoves([]);
  }, []);

  const receiveRemote = useCallback((match: PublicMatch & { error?: string | null }) => {
    setRemote(match);
    if (match.error) {
      setMessage(match.error);
      setStatusType("warning");
    }
  }, []);

  const loadRemote = useCallback(async (id: string) => {
    const response = await fetch(`/api/matches/${id}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to open the match.");
    onlineMatchId.current = id;
    receiveRemote(payload);
    setKind("online");
    setMessage(
      payload.playerSide === "white" && payload.waitingForOpponent
        ? "Invite a friend to join this game."
        : payload.playerSide === null && payload.waitingForOpponent
          ? "This game is waiting for an opponent."
          : payload.playerSide === null
            ? "This game already has two players."
            : "Online game ready."
    );
    setStatusType("info");
  }, [receiveRemote]);

  useEffect(() => {
    setDebugAvailable(new URLSearchParams(window.location.search).has("debug"));
    const matchId = new URLSearchParams(window.location.search).get("match");
    if (!matchId) return;
    loadRemote(matchId).catch((error: Error) => {
      setMessage(error.message);
      setStatusType("error");
    });
  }, [loadRemote]);

  useEffect(() => {
    if (kind !== "online" || !onlineMatchId.current) return;
    const id = onlineMatchId.current;
    const poll = () => loadRemote(id).catch(() => undefined);
    const timer = window.setInterval(poll, 1500);
    return () => window.clearInterval(timer);
  }, [kind, loadRemote]);

  const playComputerTurn = useCallback((next: GameState, rankedMoves?: MoveAttempt[], attempt = 0) => {
    if (next.status !== "active" || next.sideToMove !== "black") return;
    setComputerThinking(true);
    window.setTimeout(() => {
      const moves = rankedMoves ?? getBestMoves(next.board, "black", DEPTH_FOR[difficulty]);
      const intended = moves[attempt];
      if (!intended) { setComputerThinking(false); return; }
      const result = submitMove(next, intended);
      setGame(result.state);
      setMessage(result.message);
      setStatusType(result.special ? "special" : result.accepted ? "success" : "warning");
      if (!result.accepted && attempt < 2) {
        playComputerTurn(result.state, moves, attempt + 1);
        return;
      }
      setComputerThinking(false);
    }, 550);
  }, [difficulty]);

  const submitLocalMove = useCallback((from: Square, to: Square, side: Side) => {
    const result = submitMove(game, { from, to, side });
    if (result.accepted) setUndoStack((stack) => [...stack, game].slice(-20));
    setGame(result.state);
    setMessage(result.message);
    setStatusType(result.special ? "special" : result.accepted ? "success" : "warning");
    if (kind === "computer" && result.accepted) playComputerTurn(result.state);
  }, [game, kind, playComputerTurn]);

  const submitOnlineMove = useCallback(async (from: Square, to: Square) => {
    if (!onlineMatchId.current) return;
    const response = await fetch(`/api/matches/${onlineMatchId.current}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Move could not be submitted.");
    receiveRemote(payload);
    setMessage(payload.error ?? payload.state.moves.at(-1)?.message ?? "Move completed.");
    setStatusType(payload.error ? "warning" : payload.state.specialSquare ? "special" : "success");
  }, [receiveRemote]);

  const handleClick = useCallback(async (row: number, col: number) => {
    if (!isMyTurn || computerThinking) return;
    const square: Square = [row, col];
    const piece = visible.board[row][col];
    if (selected && validMoves.some((move) => sameSquare(move, square))) {
      clearSelection();
      try {
        if (kind === "online") await submitOnlineMove(selected, square);
        else submitLocalMove(selected, square, playerSide);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Move could not be submitted.");
        setStatusType("error");
      }
      return;
    }
    if (piece && (isWhite(piece) ? "white" : "black") === playerSide) {
      setSelected(square);
      setValidMoves(getLegalMoves(visible.board, row, col, playerSide === "white"));
      setMessage("Choose a destination.");
      setStatusType("info");
      return;
    }
    clearSelection();
  }, [clearSelection, computerThinking, isMyTurn, kind, playerSide, selected, submitLocalMove, submitOnlineMove, validMoves, visible.board]);

  const startLocal = (nextKind: "local" | "computer") => {
    setKind(nextKind);
    setRemote(null);
    setGame(createGameState());
    setUndoStack([]);
    clearSelection();
    setMessage(nextKind === "computer" ? "You are White. Your opponent is preparing." : "White to move.");
    setStatusType("info");
  };

  const createOnline = async () => {
    if (creatingOnline) return;
    setCreatingOnline(true);
    setMessage("Creating a private online game...");
    setStatusType("info");
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create a match.");
      const url = new URL(window.location.href);
      url.searchParams.set("match", payload.id);
      window.history.replaceState({}, "", url);
      await loadRemote(payload.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create a match.");
      setStatusType("error");
    } finally {
      setCreatingOnline(false);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setMessage("Invite link copied. Your opponent will play Black.");
    setStatusType("success");
  };

  const joinOnline = async () => {
    if (!onlineMatchId.current) return;
    try {
      const response = await fetch(`/api/matches/${onlineMatchId.current}/join`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to join this game.");
      receiveRemote(payload);
      setMessage("You are Black. White moves first.");
      setStatusType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to join this game.");
      setStatusType("error");
    }
  };

  const reset = () => {
    if (kind === "online") {
      window.history.replaceState({}, "", window.location.pathname);
      onlineMatchId.current = null;
      setRemote(null);
      setKind(null);
    } else {
      startLocal(kind ?? "local");
    }
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || kind !== "local") return;
    setGame(previous);
    setUndoStack((stack) => stack.slice(0, -1));
    clearSelection();
    setMessage("Last move undone.");
    setStatusType("info");
  };

  const events = useMemo(() => visible.moves.slice(-12).reverse(), [visible.moves]);

  if (!kind) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
        <h1 className="text-4xl font-light tracking-[0.35em] uppercase text-amber-600">Chess</h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-stone-400">Choose your opponent. The board keeps its own counsel.</p>
        <div className="mt-8 grid w-full gap-3">
          <button type="button" onClick={() => startLocal("local")} className="rounded border border-amber-500/45 bg-amber-950/20 px-5 py-4 text-left text-stone-100 hover:bg-amber-900/25">Play here <span className="block pt-1 text-xs text-stone-500">Two players on one board</span></button>
          <div className="rounded border border-stone-700 text-left text-stone-100">
            <button type="button" onClick={() => startLocal("computer")} className="w-full px-5 py-4 text-left hover:bg-stone-900">Play computer <span className="block pt-1 text-xs text-stone-500">You play White</span></button>
            <div className="flex items-center gap-3 border-t border-stone-700 px-5 py-2 text-xs text-stone-400">
              <span>Difficulty:</span>
              <button type="button" onClick={() => setDifficulty("normal")} className={`rounded px-2 py-0.5 transition-colors ${difficulty === "normal" ? "bg-amber-800/50 text-amber-300 font-semibold" : "hover:text-stone-200"}`}>Normal<span className="ml-1 hidden text-stone-500 sm:inline">· 2 moves ahead</span></button>
              <button type="button" onClick={() => setDifficulty("advanced")} className={`rounded px-2 py-0.5 transition-colors ${difficulty === "advanced" ? "bg-amber-800/50 text-amber-300 font-semibold" : "hover:text-stone-200"}`}>Advanced<span className="ml-1 hidden text-stone-500 sm:inline">· 4 moves ahead</span></button>
            </div>
          </div>
          <button type="button" onClick={() => void createOnline()} disabled={creatingOnline} className="rounded border border-stone-700 px-5 py-4 text-left text-stone-100 hover:bg-stone-900 disabled:cursor-wait disabled:opacity-60">{creatingOnline ? "Creating online game..." : "Play online"}<span className="block pt-1 text-xs text-stone-500">Create a private invite game</span></button>
        </div>
        <div role="status" className={`mt-5 w-full rounded border px-4 py-3 text-sm leading-relaxed ${statusStyles[statusType]}`}>{message}</div>
      </main>
    );
  }

  const statusMessage = kind === "online" && remote?.playerSide === null && remote.waitingForOpponent
    ? "The Black seat is available. Join when you are ready."
    : kind === "online" && remote?.playerSide === "white" && remote.waitingForOpponent
      ? "Waiting for an opponent to join your invite."
      : kind === "online" && remote?.playerSide === null
        ? "This game already has two players."
    : computerThinking
      ? "Your opponent is considering the board."
      : message;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-3 py-6 sm:px-6 lg:py-8">
      <div className="text-center"><h1 className="text-3xl font-light tracking-widest uppercase text-amber-600">Chess</h1><div className="mx-auto mt-2 h-px w-16 bg-amber-600/40" /></div>
      <div className="mt-6 grid w-full max-w-[1080px] grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,580px)_minmax(280px,360px)] lg:items-start lg:gap-8">
        <section className="mx-auto w-full max-w-[600px]"><div className="rounded-lg border border-amber-500/30 bg-black/45 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:p-3"><div className="chess-board flex items-start justify-center"><div className="flex flex-col">{RANKS.map((rank) => <div key={rank} className="flex h-[var(--square-size)] w-4 items-center justify-center font-mono text-[10px] text-stone-500 sm:w-5 sm:text-xs">{rank}</div>)}</div><div><div className="grid overflow-hidden border-2 border-stone-700 shadow-2xl" style={{ gridTemplateColumns: "repeat(8, var(--square-size))" }}>{visible.board.map((boardRow, row) => boardRow.map((piece, col) => {
          const square: Square = [row, col]; const light = (row + col) % 2 === 0; const isSelected = !!selected && sameSquare(selected, square); const isMove = validMoves.some((move) => sameSquare(move, square)); const isLast = !!visible.lastMove && visible.lastMove.some((move) => sameSquare(move, square)); const special = !!visible.specialSquare && sameSquare(visible.specialSquare, square); const checked = !!checkedKing && sameSquare(checkedKing, square);
          let background = light ? "#f0d9b5" : "#b58863"; if (isSelected) background = "#7dd3fc"; else if (isMove && !piece) background = light ? "#cdd16e" : "#aaa23a";
          return <button type="button" key={`${row}-${col}`} onClick={() => void handleClick(row, col)} aria-label={`${FILES[col]}${8 - row}${piece ? ` ${piece}` : ""}`} className="relative flex h-[var(--square-size)] w-[var(--square-size)] cursor-pointer select-none items-center justify-center touch-manipulation" style={{ background }}>
            {isLast && <span className="absolute inset-0 z-10 bg-yellow-300/25" />}{special && <span className="absolute inset-0 z-20 animate-pulse border-4 border-amber-300" />}{checked && <span className="absolute inset-0 z-20 animate-[dangerPulse_1s_infinite_alternate] border-4 border-red-600/80" />}{isSelected && <span className="absolute inset-0 z-20 border-4 border-amber-400" />}{isMove && !!piece && <span className="absolute inset-0 z-20 border-4 border-red-600/80" />}{isMove && !piece && <span className="z-20 h-4 w-4 rounded-full bg-emerald-700/75" />}{piece && <span className="z-30 text-3xl leading-none sm:text-5xl" style={{ color: isWhite(piece) ? "#fff" : "#1a1008", textShadow: isWhite(piece) ? "0 1px 4px #000" : "0 1px 2px rgba(255,255,255,.2)" }}>{PIECE_SYMBOLS[piece]}</span>}
          </button>;
        }))}</div><div className="flex">{FILES.map((file) => <div key={file} className="flex h-[18px] w-[var(--square-size)] items-center justify-center font-mono text-[10px] text-stone-500 sm:text-xs">{file}</div>)}</div></div></div></div></section>
        <aside className="mx-auto flex w-full max-w-xl flex-col gap-4 lg:max-w-none"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-stone-200"><span className={`h-3 w-3 rounded-full border border-stone-500 ${visible.sideToMove === "white" ? "bg-white" : "bg-stone-950"}`} />{visible.status === "finished" ? "Game Over" : `${visible.sideToMove === "white" ? "White" : "Black"} to Move`}</div><div className={`rounded border px-4 py-3 text-sm leading-relaxed ${statusStyles[statusType]}`}>{statusMessage}</div>
          {kind === "online" && remote?.playerSide === "white" && remote.waitingForOpponent && <button onClick={() => void copyInvite()} className="rounded border border-amber-500/45 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/40">Copy invite link</button>}
          {kind === "online" && remote?.playerSide === null && remote.waitingForOpponent && <button onClick={() => void joinOnline()} className="rounded border border-amber-500/45 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/40">Join as Black</button>}
          <div className="border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400"><div className="mb-2 text-xs uppercase tracking-wider text-stone-500">Move History</div><div className="max-h-40 space-y-2 overflow-auto">{visible.moves.length ? visible.moves.map((move) => <div key={move.number}>{move.text}</div>) : <div>No moves yet.</div>}</div></div>
          <div className="border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400"><div className="mb-2 text-xs uppercase tracking-wider text-stone-500">Event Log</div><div className="max-h-44 space-y-2 overflow-auto">{events.length ? events.map((event) => <div key={event.number} className={event.special ? "text-amber-300" : undefined}>{event.message}</div>) : <div>Game started. White to move.</div>}</div></div>
          <div className="flex gap-2"><button onClick={reset} className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 hover:bg-stone-900">{kind === "online" ? "Leave" : "New Game"}</button><button onClick={undo} disabled={kind !== "local" || !undoStack.length} className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40">Undo</button></div>
          {debugAvailable && kind !== "online" && <button onClick={() => setDebugVisible((open) => !open)} className="rounded border border-stone-700 px-4 py-1.5 text-xs uppercase tracking-wider text-stone-500 hover:bg-stone-900">{debugVisible ? "Hide Diagnostics" : "Show Diagnostics"}</button>}
          {debugAvailable && debugVisible && kind !== "online" && <div className="border border-stone-800 bg-stone-950 px-4 py-3 text-xs text-stone-400"><div className="font-mono">White king: {describeKing(game.rpgState.kings.white)} · Black king: {describeKing(game.rpgState.kings.black)}</div><div className="mt-3 max-h-44 space-y-2 overflow-auto font-mono">{game.rpgState.log.map((entry) => <div key={`${entry.turn}-${entry.pieceId}-${entry.visibleMove}`}>T{entry.turn} {entry.visibleMove}: d20 {entry.die}, {entry.outcome}{entry.ruleBreak ? " extended-move" : ""}.</div>)}</div></div>}
        </aside>
      </div>
    </div>
  );
}
