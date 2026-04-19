"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const USER_STANDAARD: Record<string, string> = {
  Ricardo: "/bb",
  Matthieu: "/kl",
};

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    const user = sessionStorage.getItem("sg_user") ?? "";
    router.replace(USER_STANDAARD[user] ?? "/bb");
  }, [router]);
  return null;
}
