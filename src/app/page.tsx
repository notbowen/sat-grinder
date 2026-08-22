import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const current = await getCurrentSession();
  redirect(current ? "/dashboard" : "/login");
}
