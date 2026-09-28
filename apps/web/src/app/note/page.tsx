"use client";

import Screen from "@/features/casa/Screen";
import Notes from "@/features/notes/Notes";

export default function Page() {
  return <Screen view="notes" phone={(house) => <Notes householdId={house.id} />} />;
}
