import type { Metadata } from "next";
import RobyDemo from "@/features/roby/RobyDemo";

export const metadata: Metadata = { title: "Roby · Homeboard" };

export default function Page() {
  return <RobyDemo />;
}
