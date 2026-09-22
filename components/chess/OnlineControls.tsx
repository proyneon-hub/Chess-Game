import type { useOnlineMatch } from "@/hooks/useOnlineMatch";
import { button } from "@/components/chess/styles";

/** Invite, join and retry buttons for an online match. */
export function OnlineControls({
  online,
  onNotice,
}: {
  online: ReturnType<typeof useOnlineMatch>;
  onNotice: (notice: string) => void;
}) {
  const waiting = online.remote?.waitingForOpponent;
  return (
    <>
      {online.remote?.playerSide === "white" && waiting && (
        <button
          className={button}
          onClick={() =>
            void navigator.clipboard.writeText(location.href).then(
              () =>
                onNotice("Invite link copied. Your opponent will play Black."),
              () => onNotice("Copy the invite address from your browser."),
            )
          }
        >
          Copy invite link
        </button>
      )}
      {online.remote?.playerSide === null && waiting && (
        <button
          disabled={online.busy}
          className={button}
          onClick={() => void online.join()}
        >
          Join as Black
        </button>
      )}
      {online.retryable && (
        <button
          className={button}
          disabled={online.busy}
          onClick={() => void online.send()}
        >
          Retry connection
        </button>
      )}
    </>
  );
}
