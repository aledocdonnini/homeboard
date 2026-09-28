"use client";

import Screen from "@/features/casa/Screen";
import Deadlines from "@/features/deadlines/Deadlines";
import { timezoneOf } from "@/features/household/HouseholdGate";

export default function Page() {
  return <Screen view="deadlines" phone={(house) => <Deadlines householdId={house.id} tz={timezoneOf(house)} />} />;
}
