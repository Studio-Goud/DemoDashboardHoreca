"use client";

import { useEffect, useState } from "react";

export type Rol = "owner" | "manager";
export type Slug = "bb" | "sl" | "kl";

export interface RolInfo {
  rol: Rol | null;
  naam: string | null;
  vestiging: Slug | null;
}

/**
 * Leest de huidige rol + vestiging uit sessionStorage (gezet door PinGate).
 * Re-render bij wijzigingen via storage-events of session-storage check.
 */
export function useRol(): RolInfo {
  const [info, setInfo] = useState<RolInfo>({ rol: null, naam: null, vestiging: null });

  useEffect(() => {
    function lees(): RolInfo {
      const rol = sessionStorage.getItem("sg_rol") as Rol | null;
      const naam = sessionStorage.getItem("sg_user");
      const vest = sessionStorage.getItem("sg_vestiging") as Slug | null;
      return { rol, naam, vestiging: vest };
    }
    setInfo(lees());

    function onStorage() {
      setInfo(lees());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("sg:welkom", onStorage as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sg:welkom", onStorage as EventListener);
    };
  }, []);

  return info;
}
