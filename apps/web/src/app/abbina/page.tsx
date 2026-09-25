"use client";

import HouseholdGate from "@/features/household/HouseholdGate";
import PairTv from "@/features/household/PairTv";

export default function Page() {
  return <HouseholdGate>{(house) => <PairTv house={house} />}</HouseholdGate>;
}
