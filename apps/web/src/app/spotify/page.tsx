"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RobyTile from "@/components/ui/RobyTile";
import { finishLogin } from "@/lib/spotify";

// Ritorno dal login di Spotify: si salvano i token su questo dispositivo e si torna alle Impostazioni.
export default function Page() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    finishLogin(new URLSearchParams(location.search))
      .then(() => router.replace("/impostazioni?spotify=1"))
      .catch((e: Error) => setError(e.message));
  }, [router]);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <RobyTile expression={error ? "confused" : "listening"} />
      <h1 className="text-3xl font-bold tracking-tight">{error ? "Spotify non collegato" : "Collego Spotify…"}</h1>
      {error && <p className="text-muted">{error} <a href="/impostazioni" className="font-semibold underline underline-offset-4">Torna alle Impostazioni</a></p>}
    </main>
  );
}
