"use client";

import Today from "@/features/home/Today";
import HouseholdGate from "@/features/household/HouseholdGate";

export default function Page() {
  return <HouseholdGate>{(house) => <Today householdId={house.id} />}</HouseholdGate>;
}
