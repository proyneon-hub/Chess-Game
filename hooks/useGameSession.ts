"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Square, getLegalMoves, isWhite, sameSquare } from "@/lib/chess";
import { type Difficulty, type GameKind } from "@/lib/game";
import type { Intention } from "@/lib/game/types";
import type { PublicGame } from "@/lib/game/publicState";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useOnlineMatch } from "@/hooks/useOnlineMatch";
import { useComputerTurn } from "@/hooks/useComputerTurn";
import { clearLocalGame, readLocalSave } from "@/hooks/localSave";
import { canMove } from "@/components/chess/turn";

const CHOOSE = "Choose how you would like to play.";

/**
 * The game the viewer is playing: which mode, the selection in progress, and
 * the actions the page offers. Composes the local, online and computer hooks.
 */
export function useGameSession() {
  const [kind, setKind] = useState<GameKind | null>(null),
    [difficulty, setDifficulty] = useState<Difficulty>("normal"),
    [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<Intention | null>(null),
    [message, setMessage] = useState(CHOOSE),
    [notice, setNotice] = useState("");
  const local = useLocalGame(),
    online = useOnlineMatch(),
    { open, leave } = online,
    { restoreSaved, save } = local;
  // Null while an online match opens or the local engine loads.
  const visible: PublicGame | null =
      kind === "online" ? (online.remote?.state ?? null) : local.view,
    side =
      kind === "online"
        ? online.remote?.playerSide
        : kind === "local"
          ? visible?.sideToMove
          : "white";
  const { thinking: computerThinking, failure: computerFailure } =
    useComputerTurn(
      local.game,
      local.engine,
      kind === "computer",
      difficulty,
      local.submit,
      setMessage,
    );
  const myTurn = canMove({
    game: visible,
    side,
    kind,
    computerThinking,
    online,
  });
  const moves = useMemo(
    () =>
      selected && side && visible
        ? getLegalMoves(
            visible.board,
            ...selected,
            side === "white",
            visible.rights,
          )
        : [],
    [selected, side, visible],
  );
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("match");
    if (id) {
      // The URL is only readable after hydration, so this cannot be initial state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKind("online");
      void open(id);
      return;
    }
    // Only a stored game pulls in the rules engine before a mode is chosen.
    if (readLocalSave())
      void restoreSaved().then((saved) => {
        if (!saved) return;
        setDifficulty(saved.difficulty);
        setKind(saved.mode);
        setMessage("Your game has been restored.");
      });
  }, [open, restoreSaved]);
  // Keep local and computer games across reloads in this browser.
  useEffect(() => {
    if (kind === "local" || kind === "computer") save(kind, difficulty);
  }, [kind, difficulty, local.game, save]);
  // Only local and computer games are lost on reset; online matches stay on
  // the server.
  const inProgress =
    (kind === "local" || kind === "computer") &&
    !!local.game &&
    local.game.revision > 0 &&
    local.game.status === "active";
  // A new position invalidates any half-made move.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null);
    setPromotion(null);
  }, [online.remote?.version, local.game?.revision]);
  const clearUrl = () => history.replaceState({}, "", location.pathname);
  const start = (mode: "local" | "computer") => {
    leave();
    clearUrl();
    setSelected(null);
    setPromotion(null);
    setNotice("");
    // Switch modes only once the fresh game exists, so the previous game is
    // never shown (or saved) under the new mode.
    void local.reset().then(() => {
      setKind(mode);
      setMessage("White to move.");
    });
  };
  const playOnline = () => {
    setKind("online");
    void open();
  };
  const send = (intent: Intention | { type: "claim-draw" }) => {
    if (!myTurn || !side) return;
    setSelected(null);
    setPromotion(null);
    if (kind === "online") void online.send(intent);
    else setMessage(local.submit({ ...intent, side }).message);
  };
  const square = (sq: Square) => {
    if (!myTurn || !visible) return;
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
  // Board squares are memoized; give them one stable handler that always
  // runs the latest square logic.
  const latestSquare = useRef(square);
  useEffect(() => {
    latestSquare.current = square;
  });
  const onSquare = useCallback((sq: Square) => latestSquare.current(sq), []);
  const chooseOpponent = () => {
    clearLocalGame();
    leave();
    clearUrl();
    setKind(null);
    setSelected(null);
    setPromotion(null);
    setNotice("");
    setMessage(CHOOSE);
  };
  const reset = () =>
    kind === "online" ? chooseOpponent() : start(kind ?? "local");
  const undo = () => {
    setMessage(local.undo());
    setSelected(null);
    setPromotion(null);
  };
  return {
    kind,
    difficulty,
    setDifficulty,
    visible,
    side,
    myTurn,
    selected,
    moves,
    promotion,
    cancelPromotion: () => setPromotion(null),
    message,
    notice,
    setNotice,
    online,
    computerThinking,
    computerFailure,
    canUndo: kind === "local" && local.canUndo,
    inProgress,
    start,
    playOnline,
    send,
    onSquare,
    chooseOpponent,
    reset,
    undo,
  };
}
