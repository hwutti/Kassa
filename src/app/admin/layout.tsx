import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { AdminChrome } from "@/components/admin/AdminChrome";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // Ohne Session ist (dank Middleware) nur die Login-Seite erreichbar – dann ohne Navigation.
  if (!session) {
    return <div className="flex-1 min-h-0 flex flex-col">{children}</div>;
  }

  return <AdminChrome benutzer={session.name}>{children}</AdminChrome>;
}
