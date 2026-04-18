import { redirect } from "next/navigation";

export default function Home() {
  // Direct door naar Brunch dashboard; tabjes bovenin wisselen naar Saté.
  redirect("/bb");
}
