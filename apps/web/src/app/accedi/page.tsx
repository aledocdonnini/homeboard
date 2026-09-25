import type { Metadata } from "next";
import LoginForm from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Accedi · Homeboard" };

export default function Page() {
  return <LoginForm />;
}
