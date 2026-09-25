"use client";

import HouseholdGate from "@/features/household/HouseholdGate";
import ShoppingList from "@/features/shopping/ShoppingList";

export default function Page() {
  return <HouseholdGate>{(house) => <ShoppingList householdId={house.id} />}</HouseholdGate>;
}
