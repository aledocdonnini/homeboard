"use client";

import HouseholdGate from "@/features/household/HouseholdGate";
import HouseholdPanel from "@/features/household/HouseholdPanel";

export default function Page() {
  return <HouseholdGate>{(house, session) => <HouseholdPanel house={house} session={session} />}</HouseholdGate>;
}
