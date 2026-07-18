import { KasseClient } from "@/components/kasse/KasseClient";

// Kasse ist rein clientseitig-interaktiv; Daten kommen live über die API.
export const dynamic = "force-dynamic";

export default function KassePage() {
  return <KasseClient />;
}
