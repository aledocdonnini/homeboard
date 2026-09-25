"use client";

import Deadlines from "@/features/deadlines/Deadlines";
import HouseholdGate, { timezoneOf } from "@/features/household/HouseholdGate";

export default function Page() {
  return <HouseholdGate>{(house) => <Deadlines householdId={house.id} tz={timezoneOf(house)} />}</HouseholdGate>;
}
