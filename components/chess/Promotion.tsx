"use client";
import { useEffect, useRef, useState } from "react";
import type { PromotionKind } from "@/lib/chess";
export function Promotion({
  onChoose,
  onCancel,
}: {
  onChoose: (p: PromotionKind) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [piece, setPiece] = useState<PromotionKind>("q");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-label="Choose promotion"
      className="rounded border border-stone-600 bg-stone-950 p-5 text-stone-100 backdrop:bg-black/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChoose(piece);
        }}
      >
        <label className="block" htmlFor="promotion">
          Promote pawn to
        </label>
        <select
          autoFocus
          id="promotion"
          value={piece}
          onChange={(e) => setPiece(e.target.value as PromotionKind)}
          className="my-4 w-full rounded bg-stone-800 p-3"
        >
          {[
            ["q", "Queen"],
            ["r", "Rook"],
            ["b", "Bishop"],
            ["n", "Knight"],
          ].map(([v, t]) => (
            <option value={v} key={v}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <button type="submit" className="rounded border px-4 py-2">
            Promote
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
