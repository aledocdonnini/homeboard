import type { Metadata } from "next";
import Cruscotto from "./ClientOnly";

export const metadata: Metadata = { title: "Cruscotto · Homeboard", robots: { index: false } };

export default function Page() {
  return <Cruscotto />;
}
