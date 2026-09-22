import { button } from "@/components/chess/styles";

/** Inline confirmation before a game in progress is thrown away. */
export function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Discard this game?"
      className="rounded border border-amber-500/45 px-4 py-3 text-sm text-stone-200"
    >
      <p>Discard this game? It cannot be recovered.</p>
      <div className="mt-2 flex gap-2">
        <button className={button + " flex-1"} onClick={onConfirm}>
          Discard game
        </button>
        <button autoFocus className={button + " flex-1"} onClick={onCancel}>
          Keep playing
        </button>
      </div>
    </div>
  );
}
