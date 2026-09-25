"use client";

import dynamic from "next/dynamic";

// Il cruscotto dipende dall'ora del dispositivo: niente render sul server, niente differenze all'idratazione.
export default dynamic(() => import("@/features/tv/CruscottoDemo"), { ssr: false });
