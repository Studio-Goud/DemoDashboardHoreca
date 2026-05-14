import { cookies } from "next/headers";
import { t as translate, type Taal } from "./dictionaries";

const COOKIE = "sg_taal";

export function getTaal(): Taal {
  const code = cookies().get(COOKIE)?.value;
  return code === "en" || code === "pt" ? code : "nl";
}

export function tServer(key: string): string {
  return translate(getTaal(), key);
}

export function htmlLang(taal: Taal): string {
  if (taal === "pt") return "pt-PT";
  if (taal === "en") return "en";
  return "nl";
}
