"use client";

import dynamic from "next/dynamic";

// La TV dipende dall'ora e dalla sessione del dispositivo: niente render sul server.
export default dynamic(() => import("@/features/tv/TvApp"), { ssr: false });
