"use client";

import dynamic from "next/dynamic";

// La postazione di casa: tutto arriva da brain sul Pi (WebSocket locale), niente render sul server.
export default dynamic(() => import("@/features/casa/HomeView"), { ssr: false });
