"use client";

import Screen from "@/features/casa/Screen";
import { timezoneOf } from "@/features/household/HouseholdGate";
import Reminders from "@/features/reminders/Reminders";

export default function Page() {
  return <Screen view="reminders" phone={(house) => <Reminders householdId={house.id} tz={timezoneOf(house)} />} />;
}
