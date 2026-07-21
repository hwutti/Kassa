import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { startseiteFuer } from "@/lib/rollen";

// Startseite leitet je nach Anmeldung auf den passenden Bereich (sonst Login).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  redirect(session ? startseiteFuer(session.rolle) : "/admin/login");
}
