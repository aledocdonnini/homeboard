import type { Metadata } from "next";
import AcceptInvite from "@/features/household/AcceptInvite";

export const metadata: Metadata = { title: "Invito · Homeboard" };

export default function Page() {
  return <AcceptInvite />;
}
