"use client";

import dynamic from "next/dynamic";

// Solo client: il cruscotto legge l'ora del dispositivo.
export default dynamic(() => import("@/features/home/CruscottoDemo"), { ssr: false });
