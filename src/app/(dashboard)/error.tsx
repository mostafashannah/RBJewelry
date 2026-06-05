"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <p className="text-sm font-medium text-red-500 mb-2">Something went wrong</p>
      <p className="text-xs text-zinc-500 mb-1 max-w-md font-mono break-all">{error.message}</p>
      {error.digest && <p className="text-[10px] text-zinc-400 mb-6">Digest: {error.digest}</p>}
      <button
        onClick={reset}
        className="text-sm px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
