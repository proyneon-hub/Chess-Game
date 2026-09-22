import { expect, it } from "vitest";
import { type Board, type ChessRights, type Side } from "@/lib/chess";
import { perft } from "@/lib/chessRules";

// Standard perft positions (chessprogramming.org). Row 0 is rank 8.
function fen(text: string): { board: Board; side: Side; rights: ChessRights } {
  const [placement, side, castling] = text.split(" ");
  const board = placement.split("/").map((rank) => {
    const row: Board[number] = [];
    for (const ch of rank)
      if (/\d/.test(ch)) row.push(...Array(Number(ch)).fill(null));
      else row.push(ch);
    return row;
  });
  return {
    board,
    side: side === "w" ? "white" : "black",
    rights: {
      castling: {
        white: { king: castling.includes("K"), queen: castling.includes("Q") },
        black: { king: castling.includes("k"), queen: castling.includes("q") },
      },
      enPassant: null,
      halfmove: 0,
      fullmove: 1,
    },
  };
}
const positions: [string, string, number[]][] = [
  [
    "kiwipete",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -",
    [48, 2039, 97862],
  ],
  [
    "position 3",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -",
    [14, 191, 2812, 43238],
  ],
  [
    "position 4",
    "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -",
    [6, 264, 9467],
  ],
  [
    "position 5",
    "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ -",
    [44, 1486, 62379],
  ],
];
for (const [name, text, counts] of positions)
  it(`${name} perft covers castling, en passant, promotion, and pins`, () => {
    const { board, side, rights } = fen(text);
    counts.forEach((n, i) => expect(perft(board, side, rights, i + 1)).toBe(n));
  });
