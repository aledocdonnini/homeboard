"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  addEventListener("online", cb);
  addEventListener("offline", cb);
  return () => {
    removeEventListener("online", cb);
    removeEventListener("offline", cb);
  };
};

/** Il dispositivo ha rete? (Sul server si assume di sì.) */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
