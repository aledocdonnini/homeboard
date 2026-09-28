"use client";

import Screen from "@/features/casa/Screen";
import ShoppingList from "@/features/shopping/ShoppingList";

export default function Page() {
  return <Screen view="shopping" phone={(house) => <ShoppingList householdId={house.id} />} />;
}
