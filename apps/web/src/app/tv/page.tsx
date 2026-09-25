import type { Metadata } from "next";
import TvApp from "./ClientOnly";

export const metadata: Metadata = { title: "TV · Homeboard", robots: { index: false } };

export default function Page() {
  return <TvApp />;
}
