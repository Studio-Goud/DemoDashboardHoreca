import { huidigeSessie } from "@/lib/auth";
import MedewerkerNav from "@/components/medewerker/MedewerkerNav";

export const dynamic = "force-dynamic";

/**
 * Layout voor de medewerker-app. Doet GEEN redirects (dat veroorzaakte
 * voorheen een loop op /m/login omdat headers().get('x-invoke-path') niet
 * altijd betrouwbaar is). In plaats daarvan:
 * - render de nav alleen als er een sessie is
 * - elke pagina checkt zelf of een sessie nodig is en redirect zelf
 */
export default async function MedewerkerLayout({ children }: { children: React.ReactNode }) {
  const sessie = await huidigeSessie();
  const heeftSessie = !!sessie && sessie.rol === "medewerker";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {heeftSessie && (
        <MedewerkerNav naam={sessie.naam} vestiging={sessie.vestiging ?? "bb"} />
      )}
      <main className={`flex-1 max-w-md w-full mx-auto p-4 ${heeftSessie ? "pb-24" : ""}`}>
        {children}
      </main>
    </div>
  );
}
