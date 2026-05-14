"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { t as translate, type Taal } from "./dictionaries";

const COOKIE = "sg_taal";

interface TaalContext {
  taal: Taal;
  setTaal: (nieuwe: Taal) => void;
  t: (key: string) => string;
}

const Context = createContext<TaalContext>({
  taal: "nl",
  setTaal: () => {},
  t: (k) => translate("nl", k),
});

export function TaalProvider({
  initieelTaal,
  children,
}: {
  initieelTaal: Taal;
  children: React.ReactNode;
}) {
  const [taal, setTaalState] = useState<Taal>(initieelTaal);
  const router = useRouter();

  const setTaal = useCallback(
    (nieuwe: Taal) => {
      document.cookie = `${COOKIE}=${nieuwe}; max-age=${365 * 24 * 3600}; path=/; samesite=lax`;
      setTaalState(nieuwe);
      // Server-rendered content opnieuw renderen met nieuwe cookie
      router.refresh();
    },
    [router],
  );

  const t = useCallback((key: string) => translate(taal, key), [taal]);

  return <Context.Provider value={{ taal, setTaal, t }}>{children}</Context.Provider>;
}

export function useTaal(): TaalContext {
  return useContext(Context);
}
