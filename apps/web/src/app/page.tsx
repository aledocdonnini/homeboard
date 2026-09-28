"use client";

import Screen from "@/features/casa/Screen";
import Today from "@/features/home/Today";
import { timezoneOf } from "@/features/household/HouseholdGate";

export default function Page() {
  return <Screen view="today" phone={(house) => <Today householdId={house.id} tz={timezoneOf(house)} />} />;
}
