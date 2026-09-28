"use client";

import HouseholdGate from "@/features/household/HouseholdGate";
import Notes from "@/features/notes/Notes";

export default function Page() {
  return <HouseholdGate>{(house) => <Notes householdId={house.id} />}</HouseholdGate>;
}
