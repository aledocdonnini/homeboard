"use client";

import HouseholdGate, { timezoneOf } from "@/features/household/HouseholdGate";
import Reminders from "@/features/reminders/Reminders";

export default function Page() {
  return <HouseholdGate>{(house) => <Reminders householdId={house.id} tz={timezoneOf(house)} />}</HouseholdGate>;
}
