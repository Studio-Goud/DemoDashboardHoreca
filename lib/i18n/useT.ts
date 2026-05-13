"use client";

import { useEffect, useState, useCallback } from "react";
import { t as translate, type Taal } from "./dictionaries";

const COOKIE = "sg_taal";

function leesTaal(): Taal {
  if (typeof document === "undefined") return "nl";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  const code = match?.[1] as Taal | undefined;
  return code === "nl" || code === "en" || code === "pt" ? code : "nl";
}

function schrijfTaal(taal: Taal) {
  // 1 jaar geldig
  document.cookie = `${COOKIE}=${taal}; max-age=${365 * 24 * 3600}; path=/; samesite=lax`;
}

export function useT() {
  const [taal, setTaalState] = useState<Taal>("nl");

  useEffect(() => {
    setTaalState(leesTaal());
    function onChange() { setTaalState(leesTaal()); }
    window.addEventListener("sg:taal", onChange);
    return () => window.removeEventListener("sg:taal", onChange);
  }, []);

  const setTaal = useCallback((nieuwe: Taal) => {
    schrijfTaal(nieuwe);
    setTaalState(nieuwe);
    window.dispatchEvent(new CustomEvent("sg:taal"));
  }, []);

  const t = useCallback((key: string) => translate(taal, key), [taal]);

  return { taal, setTaal, t };
}
