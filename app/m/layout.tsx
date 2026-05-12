import { huidigeSessie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import MedewerkerNav from "@/components/medewerker/MedewerkerNav";

export const dynamic = "force-dynamic";

export default async function MedewerkerLayout({ children }: { children: React.ReactNode }) {
  // /m/login is public; alle andere /m/* routes vereisen een sessie
  const hdrs = headers();
  const pad = hdrs.get("x-invoke-path") ?? hdrs.get("next-url") ?? "";
  const isLogin = pad.includes("/m/login");

  const sessie = await huidigeSessie();

  if (!sessie && !isLogin) redirect("/m/login");
  // Owners en managers gebruiken hun eigen dashboard, niet /m
  if (sessie && sessie.rol !== "medewerker" && !isLogin) redirect("/");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {sessie && <MedewerkerNav naam={sessie.naam} vestiging={sessie.vestiging ?? "bb"} />}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-24">
        {children}
      </main>
    </div>
  );
}
