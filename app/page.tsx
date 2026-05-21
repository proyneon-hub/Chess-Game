import ChessBoard from "@/components/ChessBoard";

// The home route is intentionally thin: it centers the interactive chess board
// and leaves all game state and rendering details inside the ChessBoard client
// component.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <ChessBoard />
    </main>
  );
}
