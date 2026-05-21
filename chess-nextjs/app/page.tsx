import ChessBoard from "@/components/ChessBoard";

// This nested Next.js app mirrors the root app page: it delegates chess logic
// and board rendering to the shared ChessBoard component.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <ChessBoard />
    </main>
  );
}
