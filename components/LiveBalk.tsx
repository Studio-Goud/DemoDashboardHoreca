"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#00B8FF" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#00D27A" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#FF8A00" },
] as const;

type Slug = "bb" | "sl" | "kl";

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
}
interface VerwachtData {
  verwachtVandaag: number;
  weekdagCurve: number[];
}

function verwachtTotNu(curve: number[]): number {
  if (!curve || curve.length !== 24) return 0;
  const nl = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const uur = nl.getHours();
  const min = nl.getMinutes() / 60;
  let som = 0;
  for (let i = 0; i < uur; i++) som += curve[i] ?? 0;
  som += (curve[uur] ?? 0) * min;
  return Math.round(som * 100) / 100;
}

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Grap-generator ──────────────────────────────────────────────────────────

interface GrapSet { bb: string; sl: string; kl: string }

const GRAPPEN: Record<string, GrapSet[]> = {
  ochtend: [
    { bb: "Goedemorgen Rotterdam 👋", sl: "Ik ben er nog niet klaar voor", kl: "Koffie first" },
    { bb: "Wie is er al wakker?", sl: "Zzz... de Maas ook nog niet", kl: "Geef me 5 minuten" },
    { bb: "Teller staat op nul", sl: "Wij ook. Nul", kl: "Samen sterk 💪" },
    { bb: "Nieuwe dag, nieuwe kansen", sl: "Eerst zien dan geloven", kl: "Wacht maar af" },
    { bb: "De espresso staat klaar", sl: "Wij ook bijna", kl: "Iemand de deur open?" },
    { bb: "Rotterdam wacht op ons", sl: "Rotterdam wacht op niemand", kl: "Dat klopt eigenlijk" },
    { bb: "Ochtendploeg aanwezig", sl: "Aanwezig maar suf", kl: "Zelfde" },
    { bb: "Dag begint zo", sl: "Dag begint zo ja", kl: "Doe maar gewoon" },
    { bb: "Hoelaat is het eigenlijk", sl: "Te vroeg", kl: "Veel te vroeg" },
    { bb: "Niet lullen maar zetten", sl: "Die koffie of die saté?", kl: "Beiden" },
    { bb: "Markthal ook nog dicht", sl: "Wij zijn avontuurlijker", kl: "Of dommer" },
    { bb: "Erasmusbrug staat er al", sl: "Die werkt tenminste al", kl: "Hij klopt ook" },
    { bb: "Eerste koffie is heilig", sl: "Eerste saté ook", kl: "Eerste kroket is het beste moment" },
    { bb: "Rotterdam begint langzaam", sl: "Net als wij", kl: "Net als ik" },
    { bb: "Heeft iemand de lichten aan?", sl: "Bij mij wel", kl: "Bij mij ook. Mensen zijn er niet." },
    { bb: "Morgen is ook een dag", sl: "Maar vandaag moet het ook", kl: "Dit is vandaag. Echt." },
    { bb: "Kassa checken", sl: "Kassa staat goed", kl: "Kassa? Welke kassa" },
    { bb: "Rustig opstarten", sl: "Dat doen we hier altijd", kl: "Ik start altijd rustig op. Vraag het maar." },
    { bb: "Even de stoelen van tafel", sl: "Gedaan", kl: "Bijna gedaan" },
    { bb: "Welk weer is het vandaag", sl: "Rotterdam-weer", kl: "Dat zegt niks" },
    { bb: "Zondag vibe", sl: "Elke dag is zondag bij SL toch?", kl: "Dat is niet complimenteus bedoeld" },
    { bb: "Maandagochtend is ook een vibe", sl: "Een slechte vibe", kl: "Ik noem het karakter" },
    { bb: "Goedemorgen allemaal", sl: "Goedemorgen", kl: "Morgen ja" },
    { bb: "Dag begint met stilte", sl: "Stilte voor de storm", kl: "Storm duurt bij mij wat langer" },
    { bb: "Even bijkomen", sl: "Bijkomen van wat?", kl: "Van het weekend" },
    { bb: "Eerste uur is altijd het zwaarst", sl: "Dat gevoel ken ik", kl: "Ik heb er meerdere zware uren" },
    { bb: "Is de Wi-Fi het al?", sl: "Altijd", kl: "Nee. Nooit." },
    { bb: "Klaar voor een nieuwe dag", sl: "Bijna klaar", kl: "In principe klaar" },
    { bb: "Rotterdam rekt zich uit", sl: "En dan meteen aan het werk", kl: "En dan kijken wat er komt" },
    { bb: "De haven gaat ook pas later open", sl: "Die haven gaat nooit dicht", kl: "Ok je hebt gelijk" },
    { bb: "Geen haast. Kwaliteit kost tijd.", sl: "Zeg ik ook altijd", kl: "Zeg ik ook altijd. Niemand gelooft me." },
    { bb: "Is dit al ochtend of nog nacht?", sl: "Dit is het grijze tussengebied", kl: "Het grijze gebied is mijn thuis" },
    { bb: "Koffie zet ik voor de hele stad", sl: "Hele stad wil sate", kl: "Hele stad wil kroket. Ze weten het alleen nog niet." },
    { bb: "Fris begin vandaag", sl: "Vers van de pers", kl: "Vers uit de frituur" },
    { bb: "Vandaag gaat het anders", sl: "Dat zeg je elke dag", kl: "En elke dag gaat het hetzelfde" },
    { bb: "Positieve energie vanmorgen", sl: "Positief en hongerig", kl: "Positief en leeg" },
    { bb: "Euromast kijkt al neer op ons", sl: "Vanuit 180 meter zien we er klein uit", kl: "Vanuit 180 meter zie je mij helemaal niet" },
    { bb: "SS Rotterdam ook al wakker?", sl: "Die ligt er gewoon", kl: "Die heeft geen openingstijden" },
    { bb: "Kralingse Bos nog in de mist", sl: "Poëtisch", kl: "En nat" },
    { bb: "Even de dag plannen", sl: "Plan: saté verkopen", kl: "Plan: kroket verkopen" },
    { bb: "Ochtend is voor optimisten", sl: "En voor vroege klanten", kl: "Ik ben een optimist met een frituurpan" },
    { bb: "De RET rijdt al", sl: "Dan komen ze eraan", kl: "Als ze uitstappen" },
    { bb: "Nog even en het loopt", sl: "Het loopt altijd", kl: "Soms loopt het" },
    { bb: "Vandaag is een nieuwe kans", sl: "Gisteren was ook al een kans", kl: "Ik grijp ze allemaal. Met beide handen." },
    { bb: "Dag vol potentie", sl: "Vol potentie ja", kl: "Ik zie er ook potentie in" },
    { bb: "Goedemorgen van BB ☕", sl: "Goedemorgen van SL 🍢", kl: "Goedemorgen van KL 🥟" },
    { bb: "Lekker vroeg hier", sl: "Lekker vroeg overal", kl: "Vroeg is relatief" },
    { bb: "Vandaag wordt groot", sl: "Hoe groot?", kl: "Groot genoeg voor kroket" },
    { bb: "Beginnen maar", sl: "Beginnen maar", kl: "Ja beginnen maar" },
    { bb: "Nog niks maar dat komt", sl: "Geduld", kl: "Ik heb daar enorm veel van" },
    { bb: "Rotterdam staat op", sl: "Rotterdam staat altijd op", kl: "Alleen Rotterdam niet ik" },
    { bb: "Eerste klant is de mooiste klant", sl: "Die van mij wordt ook mooi", kl: "Die van mij betaalt" },
    { bb: "Vandaag knallen", sl: "Morgen ook", kl: "Knallen is groot woord maar ok" },
    { bb: "Goede dag voel ik", sl: "Gevoel klopt meestal", kl: "Mijn gevoel zit er regelmatig naast" },
    { bb: "Haven gonst", sl: "Keuken ook bijna", kl: "Frituur bijna op temp" },
    { bb: "Drie vestigingen wakker", sl: "Wakker ja. Scherp nog niet.", kl: "Ik ben wakker in de brede zin van het woord" },
    { bb: "Dag is jong", sl: "En wij ook", kl: "Wij zijn allemaal jong van geest" },
    { bb: "Klanten staan al te wachten?", sl: "Nog niet maar bijna", kl: "Nee maar dat is ok" },
    { bb: "Espresso shot pak ik", sl: "Saté schep ik", kl: "Kroket frituur ik" },
    { bb: "Dag plannen is dag winnen", sl: "Of dag verliezen maar dan weet je het eerder", kl: "Ik plan niet. Ik reageer." },
    { bb: "Goedemorgen wereld", sl: "Wereld is groot", kl: "Rotterdam is groot genoeg" },
    { bb: "Laten we er wat van maken", sl: "Altijd al wat van gemaakt", kl: "Ik doe ook mee" },
    { bb: "Koffie, saté, kroket — Rotterdam heeft alles", sl: "Dat klopt gewoon", kl: "We complimenteren onszelf maar ok" },
    { bb: "Vandaag is de dag", sl: "Elke dag is de dag", kl: "Sommige dagen meer dan andere" },
    { bb: "Slow start. Fast finish.", sl: "Dat hoop ik voor ons allemaal", kl: "Ik werk liever andersom" },
  ],
  // ───────────────────────────────────────────────────────────────────────────
  // Ranked scenario's: volgorde = {leider}_{tweede}_{laatste}.
  // Elke papegaai spreekt vanuit zijn ECHTE positie op dit moment:
  //  • leider = trots/zelfverzekerd, mag plagen
  //  • middle = neutraal, observeert, houdt moed
  //  • laatste = bescheiden, zelfspottend, NIET opscheppen
  // ───────────────────────────────────────────────────────────────────────────
  bb_sl_kl: [
    { bb: "Lekker tempo vandaag 💙", sl: "Ik volg op gepaste afstand", kl: "Ik volg op onhoorbare afstand" },
    { bb: "Koffie regeert de ochtend", sl: "Saté houdt stand voor de lunch", kl: "Kroket warmt nog op. Echt." },
    { bb: "BB voor, SL erachter, KL...", sl: "KL ergens achter mij", kl: "Ergens ja. Niet te vinden." },
    { bb: "Markthal kiest koffie vandaag", sl: "Een paar kiezen saté", kl: "Één iemand heeft een kroket. Ik denk uit medelijden." },
    { bb: "Mooi cijfer op de teller ☕", sl: "Acceptabel cijfer bij mij", kl: "Mijn cijfer is een lijn. Een rechte lijn." },
    { bb: "Rotterdam op dreef vandaag", sl: "Rotterdam kent mij ook", kl: "Rotterdam is mij even vergeten" },
    { bb: "Wij tikken lekker door", sl: "Ik tik mee", kl: "Ik tik op mijn frituurpan om wakker te blijven" },
    { bb: "Topdag voor ons 🚀", sl: "Oké dag voor ons", kl: "Overleefbare dag voor mij" },
    { bb: "Koffie > saté > kroket vandaag", sl: "Onder protest", kl: "Zonder protest. Klopt helaas." },
    { bb: "BB tikt de dag aan elkaar", sl: "Wij vullen de uren ertussen", kl: "Ik vul de stilte" },
    { bb: "Niet arrogant maar trots", sl: "Trots is je gegund", kl: "Ik ben niet trots vandaag. Morgen misschien." },
  ],
  bb_kl_sl: [
    { bb: "Vandaag vreemd: BB, daarna KL, en SL onder", sl: "Geen commentaar", kl: "Ik heb wel commentaar. Lekker." },
    { bb: "Koffie leidt, kroket verrast", sl: "En de saté?", kl: "De saté wacht vandaag" },
    { bb: "BB topper, KL verrassing", sl: "Saté is vandaag minder populair", kl: "Zeldzame dag dit" },
    { bb: "Kroket haalt in op saté vandaag", sl: "Ik ga even gelden", kl: "Gelden is ok. Kroket is beter." },
    { bb: "De volgorde klopt vandaag niet helemaal", sl: "Ik zit onder KL. Dat klopt niet.", kl: "Toch is het zo" },
    { bb: "Ongewone dag. BB boven. KL tweede.", sl: "Ongewoon is te zacht uitgedrukt", kl: "Voor mij is het gewoon gezellig" },
    { bb: "Kroket-lunch is in trek", sl: "Ten koste van de saté", kl: "Soms gaat het zo" },
    { bb: "SL rustig vandaag, KL actief", sl: "Hou het klein", kl: "Ik hou het lekker" },
    { bb: "BB goes brrr, KL goes blub", sl: "Ik goes stil", kl: "Blub is productief" },
    { bb: "Studio Goud volgorde: blauw, oranje, groen", sl: "Noteer niet, alsjeblieft", kl: "Screenshot dit." },
    { bb: "SL-dag is het vandaag niet", sl: "Helaas niet", kl: "Voor mij wel een goede dag" },
  ],
  sl_bb_kl: [
    { bb: "Saté-dag vandaag 🍢", sl: "Zoals het hoort", kl: "Ik kijk vanaf een afstandje" },
    { bb: "SL voor, wij tweede, KL derde", sl: "Correcte samenvatting", kl: "Pijnlijk correcte samenvatting" },
    { bb: "Grillgeur overwint de koffiegeur", sl: "Vandaag wel", kl: "Mijn frituurlucht bereikt niemand" },
    { bb: "Saté in topvorm", sl: "Topvorm is mijn standaard", kl: "Mijn standaard is... bestaan" },
    { bb: "SL trekt klanten, BB pakt de rest", sl: "Fair deal", kl: "Ik pak de lucht" },
    { bb: "Katendrecht-energie bij SL vandaag", sl: "Altijd Katendrecht", kl: "Ik zit op een parkeerplaats-energie" },
    { bb: "Wij volgen de saté-trein", sl: "Instappen BB", kl: "Mijn trein staat in de remise" },
    { bb: "Rotterdam kiest vlees aan stok", sl: "Rotterdam kiest wijs", kl: "Rotterdam laat het broodje kroket liggen" },
    { bb: "SL op de eerste plek, BB dichtbij", sl: "Dichtbij is niet gelijk", kl: "Ik ben verder dan dichtbij" },
    { bb: "Koffie werkt maar sate werkt beter", sl: "Vandaag", kl: "Kroket werkt ook. Niet vandaag." },
    { bb: "Chapeau SL", sl: "Dank je BB", kl: "Ik doe mijn pet ook af. Voor jullie beiden." },
  ],
  sl_kl_bb: [
    { bb: "Wacht, BB onderaan?", sl: "Saté regeert vandaag", kl: "Kroket verdringt koffie" },
    { bb: "Dit is geen BB-dag", sl: "Vandaag echt niet", kl: "Vandaag ook geen perfecte KL-dag maar beter dan BB" },
    { bb: "Zeldzaam: BB derde", sl: "Genoteerd voor de geschiedenis", kl: "Ik sta tweede. Dat is ook geschiedenis." },
    { bb: "Mijn koffiemachine protesteert", sl: "Protesteer maar", kl: "Protest is geen omzet" },
    { bb: "SL leidt, KL inhalend, BB aan staart", sl: "Symmetrisch", kl: "Onsymmetrisch dat BB onderaan staat" },
    { bb: "Heb ik iets verkeerd gezet?", sl: "Nee gewoon saté-dag", kl: "En deels kroket-dag" },
    { bb: "Rotterdam kiest vandaag SL", sl: "En een beetje kroket", kl: "Een beetje is beter dan niks" },
    { bb: "Ik herpak me morgen", sl: "Komt goed BB", kl: "Morgen ben ik misschien eerste. Grap. Niet echt." },
    { bb: "Niet mijn dag", sl: "Wel mijn dag", kl: "Okeis dag voor mij" },
    { bb: "BB accepteert deze positie", sl: "Dat is groot van je", kl: "Respect BB" },
    { bb: "Mijn espresso is vandaag te sterk blijkbaar", sl: "Of te zwak", kl: "Of niemand wil espresso" },
  ],
  kl_bb_sl: [
    { bb: "WACHT wat. Kroket voor?", sl: "Ik snap er niks van", kl: "🥟 Ik zei het toch" },
    { bb: "KL leidt, BB volgt, SL achter", sl: "Dit klopt helemaal niet", kl: "Het klopt. Check de teller." },
    { bb: "Eindelijk een kroket-dag", sl: "Slechte saté-dag", kl: "Perfecte kroket-dag" },
    { bb: "Rotterdam op kroket", sl: "Rotterdam doet raar", kl: "Rotterdam is wakker" },
    { bb: "Kroket tilt Studio Goud omhoog", sl: "Ten koste van mij", kl: "Sorry SL. Echt wel sorry." },
    { bb: "Respect voor KL", sl: "Ik zeg niks", kl: "Geniet maar even BB" },
    { bb: "Wij volgen de kroket-trend", sl: "Ik kijk toe", kl: "Toekijken mag ook" },
    { bb: "KL topper, BB tweede", sl: "Saté derde. Geen woorden.", kl: "Topper neemt de titel" },
    { bb: "KL, vertel me je geheim", sl: "Ik wil het ook weten", kl: "Verse olie en geduld" },
    { bb: "SL heeft geen kroket-dag-bescherming", sl: "Kennelijk niet", kl: "Ik bied geen abonnement aan" },
    { bb: "Kroket boven koffie — zeldzaam moment", sl: "En boven saté. Dubbel zeldzaam.", kl: "Dubbel mooi" },
  ],
  kl_sl_bb: [
    { bb: "BB onder. KL boven. Wat gebeurt er.", sl: "Saté tussendoor", kl: "Kroket op zijn plek: bovenaan" },
    { bb: "Vandaag geen koffie-dag in Rotterdam", sl: "Rustige saté-dag", kl: "Piekdag kroket" },
    { bb: "KL eerste, SL tweede, BB onderaan", sl: "Volgorde klopt", kl: "Mooie volgorde vind ik" },
    { bb: "Ik pak mijn jas en ga nadenken", sl: "Neem tijd BB", kl: "Gun jezelf een kroket onderweg" },
    { bb: "Wat is er met onze espresso-business", sl: "De stad wil iets anders vandaag", kl: "De stad wil frituur" },
    { bb: "Voorlopig laat ik dit gebeuren", sl: "Verstandig", kl: "Wijs BB" },
    { bb: "KL en SL op één en twee", sl: "BB lijkt even weg", kl: "Even van het podium" },
    { bb: "Koffieverkoop heeft vandaag vakantie", sl: "Sategrill werkt door", kl: "Frituur werkt overuren" },
    { bb: "Niet mijn beste dag", sl: "Wel oké dag", kl: "Topdag voor mij" },
    { bb: "Ik herpak me", sl: "Komt goed", kl: "Jullie komen terug. Ik blijf hier." },
    { bb: "Deze uitslag blijf ik niet leuk vinden", sl: "Ik ook niet eigenlijk", kl: "Ik blijf het WEL leuk vinden" },
  ],
  gelijkspel: [
    { bb: "Eerlijk spel vandaag", sl: "Zo hoort het", kl: "Voor nu..." },
    { bb: "Jullie doen best jullie best", sl: "Dat zeg ik terug", kl: "Mooie dag dit" },
    { bb: "Niemand wint, niemand verliest", sl: "Dat is ook een uitkomst", kl: "Ik noem het: evenwicht" },
    { bb: "Rotterdam als geheel wint", sl: "Mooi gezegd BB", kl: "Voor één keer eens" },
    { bb: "Studio Goud draait vandaag 🏅", sl: "Samen sterk", kl: "Zoals het hoort" },
    { bb: "Gelijk op is ook fijn", sl: "Zolang het duurt", kl: "Ik ga straks gas geven" },
    { bb: "Dit is zeldzaam", sl: "Geniet er maar van", kl: "Screenshot dit" },
    { bb: "Drie vestigingen, één team", sl: "Tot ik ga winnen", kl: "Idem" },
    { bb: "Witte de With-energie vandaag", sl: "Iedereen is blij", kl: "Tot de rekening komt" },
    { bb: "Knap van jullie eerlijk gezegd", sl: "Jij ook", kl: "Dankjewel beiden" },
    { bb: "Is het toeval of werken we goed?", sl: "Beetje van beiden", kl: "Ik zeg: talent" },
    { bb: "Als dit een race was staan we allen op het podium", sl: "Feyenoord-gevoel", kl: "Beetje wel ja" },
    { bb: "Drie bedrijven in balans", sl: "Balans is een kunst", kl: "Zolang ik niet onderaan sta" },
    { bb: "Studio Goud vandaag als één", sl: "Prachtig eigenlijk", kl: "Ik ben ook onder de indruk van mezelf" },
    { bb: "Gelijkspel is ook een punt", sl: "In de voetballerij wel", kl: "In de kroket-wereld is het ook prima" },
    { bb: "Vandaag geen winnaar maar wel drie goede cijfers", sl: "Drie goede cijfers is ook wat", kl: "Ik neem het" },
    { bb: "We staan gelijk. Dat is eerlijk.", sl: "Eerlijker kan niet", kl: "Ik zou liever voor staan maar ok" },
    { bb: "Vandaag verdient iedereen een schouderklopje", sl: "Ik geef ze graag", kl: "Ik geef ook graag. En een kroket." },
    { bb: "Rotterdam heeft drie goede horeca-opties vandaag", sl: "Rotterdam heeft altijd goede opties", kl: "En de beste is de kroket. Maar ik zeg niks." },
    { bb: "Gelijke omzet, gelijke kansen", sl: "Tot de dag voorbij is", kl: "Dan tellen we de eindstand" },
    { bb: "Dit is wat je noemt een gebalanceerde dag", sl: "Gebalanceerd als een saté op een stokje", kl: "Gebalanceerd als een kroket op een servet" },
    { bb: "We houden elkaar scherp", sl: "Dat is de functie van concurrentie", kl: "Ik was al scherp. Jullie maken me scherper." },
    { bb: "Niemand hoeft zich te schamen vandaag", sl: "Dat is een lage lat BB", kl: "Maar hij is bereikt" },
    { bb: "Drie wegen, één doel", sl: "Geld verdienen", kl: "En de stad voeden" },
    { bb: "Gelijkspel smaakt naar meer", sl: "Meer omzet graag", kl: "Meer kroket altijd" },
    { bb: "Even niets te klagen", sl: "Geniet van die rust BB", kl: "Ik klaag niet. Ik verbeter." },
    { bb: "Vandaag gaan we samen door het stof", sl: "Of staan we samen op het podium", kl: "Ik sta altijd op mijn eigen podium" },
    { bb: "Als Feyenoord-Ajax 1-1 maar dan lekkerder", sl: "Dat is de beste wedstrijd", kl: "Ik ben de scheidsrechter" },
    { bb: "Harmonie in de Maasstad", sl: "Harmonie is goed voor de ziel", kl: "En voor de kroket" },
    { bb: "We zijn allemaal winnaars vandaag", sl: "Tot er één gaat afvallen", kl: "Die één ben ik niet" },
    { bb: "Perfecte balans. Zeldzaam.", sl: "Koester het", kl: "Ik koester mijn frituur" },
    { bb: "Drie kleuren, één score", sl: "Blauw, groen, en oranje samen", kl: "Oranje wint altijd. Ook bij gelijkspel." },
    { bb: "Niemand klaagt vandaag", sl: "Dat is ook news", kl: "Ik klaag nooit. Ik observeer." },
    { bb: "Zo zie je maar, concurrentie maakt iedereen beter", sl: "Dat is een mooie gedachte", kl: "Als mooie gedachten kroket bakken, ben ik al ver." },
    { bb: "Even bijladen allemaal", sl: "Bijladen voor het eindspurt", kl: "Ik laad bij met frituurvet. Figuurlijk." },
    { bb: "Vandaag leren we van elkaar", sl: "Van jullie leer ik hoe je koffie drinkt", kl: "Van jullie leer ik hoe ik NIET kroket maak" },
    { bb: "Alles gelijk. Dat is ook een prestatie.", sl: "In een andere context klinkt dat als falen", kl: "Vandaag is het succes" },
    { bb: "Goed weekend gevoel", sl: "Weekdag gevoel", kl: "Kroket-gevoel" },
    { bb: "Geen verliezers vandaag. Dat is fijn.", sl: "Morgen zijn er wel verliezers", kl: "Ik niet" },
    { bb: "Studio Goud als merk wint vandaag", sl: "Als merk wint altijd", kl: "Studio Goud met KL-kleuren is het mooiste" },
    { bb: "Iedereen draait mee. Dat is het doel.", sl: "Het doel is winnen maar dit is ook ok", kl: "Ok is ok" },
    { bb: "Balans is kunst. Wij zijn kunstenaars.", sl: "Saté is ook kunst", kl: "Kroket is ook kunst. Gouden korst, zachte binnenkant." },
    { bb: "We verdelen de klandizie eerlijk", sl: "Eerlijk verdelen is ook een kunst", kl: "Ik wil iets meer dan eerlijk" },
    { bb: "Niemand hoeft door het stof vandaag", sl: "Fijn. Ik heb nieuwe schoenen.", kl: "Ik houd van stof. Frituurstof." },
    { bb: "De score staat. Iedereen blij.", sl: "Blij is groot woord maar ok", kl: "Ik ben redelijk content" },
    { bb: "Dit is samenwerking", sl: "Dit is toevallig", kl: "Dit is een momentopname" },
    { bb: "Gelijkspel in Rotterdam. Bijna net als bij PSV.", sl: "PSV gaat niet gelijk op. PSV wint of verliest.", kl: "Precies zoals wij" },
    { bb: "We verdelen de eer vandaag", sl: "Verdelen is goed. Ik pak mijn deel.", kl: "En ik pak mijn deel met extra kroket" },
    { bb: "Drie sterren vandaag voor iedereen", sl: "Ik neem ze", kl: "Ik neem ze ook maar wel in goud" },
  ],
  bb_nul: [
    { bb: "De koffie moet nog zetten ☕", sl: "Brunch & Slapen bedoel je?", kl: "Haha eindelijk mijn moment" },
    { bb: "Wij zijn meer van de late start", sl: "Dat geloof ik ja", kl: "Geen klanten of geen zin?" },
    { bb: "Even opwarmen nog", sl: "Al hoelang opwarmen?", kl: "De kroket warmt sneller op" },
    { bb: "Kwaliteit kost tijd", sl: "Dat zeg je elke dag BB", kl: "En elke dag begrijp ik het minder" },
    { bb: "Onze klanten komen later", sl: "Ja die zitten nog te brunchen thuis", kl: "Goede" },
    { bb: "Rustige ochtend bij ons", sl: "Rustige ochtend, rustige omzet", kl: "Rustig rustig rustig" },
    { bb: "Geduld is een schone zaak", sl: "Jij hebt er veel van BB", kl: "Te veel" },
    { bb: "Wij tellen de suikerklontjes", sl: "Dat doen ze ook in Den Haag", kl: "Alleen wij doen het gratis" },
    { bb: "Nul is ook een getal", sl: "Het is het armste getal", kl: "Behalve als je BB bent" },
    { bb: "De Erasmusbrug heeft ook stille uren", sl: "De brug draait wel gewoon", kl: "Touché" },
    { bb: "We zijn aan het mise-en-place doen", sl: "Dat duurt blijkbaar een tijdje", kl: "Kroket mise-en-place duurt 20 min. Wij zijn al klaar." },
    { bb: "Nul maar het gaat komen", sl: "Dat hopen we voor je", kl: "Ik ook. Solidariteit." },
    { bb: "BB is aan het ademen", sl: "Meer dan dat is het niet vandaag", kl: "Ademen is een begin" },
    { bb: "We openen rustig", sl: "Rustig is understatement", kl: "Zwijgen is ook communiceren" },
    { bb: "Klant komt als klant wil", sl: "Klant wil nu niet naar BB blijkbaar", kl: "Klant wil wel naar mij. Bijna." },
    { bb: "Wij staan er klaar voor", sl: "Staan er klaar voor nul mensen", kl: "Wij ook maar dan voor meer mensen" },
    { bb: "Rotterdam rijdt nog op de snooze-knop", sl: "Rotterdam rijdt gewoon bij SL langs", kl: "Rotterdam rijdt ook bij mij langs" },
    { bb: "Nul vandaag maar dat is van tijdelijke aard", sl: "Tijdelijk kan lang duren", kl: "Soms heel lang" },
    { bb: "We wachten op de eerste klant", sl: "Die eerste klant is de langste wacht", kl: "Ik ken dat gevoel" },
    { bb: "Geen nood. We staan er.", sl: "Staan is niet hetzelfde als draaien", kl: "Maar het is beter dan zitten" },
    { bb: "Nul is geen indicatie voor de rest van de dag", sl: "Statistisch gezien wel", kl: "Statistische regel: eerste uur voorspelt de dag" },
    { bb: "Brunch-klanten zijn niet vroeg", sl: "Brunch-klanten zijn late ontbijters. Dat is hun recht.", kl: "Rechten hebben ze. Kroket eten is ook een recht." },
    { bb: "De dag begint altijd", sl: "Voor iedereen op een ander moment", kl: "Mijn dag begint bij de eerste kroket. Die is al binnen." },
    { bb: "Wij zijn er. De klant nog niet.", sl: "Dat is het wezenskenmerk van nul", kl: "Filosofisch geformuleerd" },
    { bb: "Nul is ons startpunt", sl: "Elk startpunt is nul. Maar het startmoment is voor jou later.", kl: "Ik was al weg voor BB begon" },
    { bb: "Schoon schip. Lege balie.", sl: "Schoon schip is positief", kl: "Een schoon schip zonder lading vaart nergens heen" },
    { bb: "BB stelt even teleur maar dat komt goed", sl: "Positief ingesteld", kl: "Ik ook. Voor BB dan." },
    { bb: "Nul en toch glimlachen", sl: "Dat is kracht", kl: "Of ontkenning" },
    { bb: "We laden op", sl: "Opladen voor wat precies", kl: "Voor de grote verkoop die maar niet komt" },
    { bb: "Nul maakt me niet gek", sl: "Je bent al gek als je op nul staat en rustig blijft", kl: "Of wijs" },
  ],
  sl_nul: [
    { bb: "Saté op vakantie vandaag?", sl: "De oven staat op te warmen", kl: "Die oven is altijd aan het opwarmen" },
    { bb: "Heeft SL al opengedaan?", sl: "Wij beginnen later. Dat is het.", kl: "Straks inhalen toch?" },
    { bb: "Iemand de saté vergeten aan te steken?", sl: "Het steekt zichzelf wel aan", kl: "Bewijs het" },
    { bb: "SL doet het rustig aan vandaag", sl: "Wij zijn strategisch aan het wachten", kl: "Op wat dan?" },
    { bb: "Zonder SL is het stiller", sl: "Ik ben stil maar ik ben er", kl: "Dat telt niet voor de omzet" },
    { bb: "Het stokje is er maar de sate nog niet", sl: "Het stokje wacht ook", kl: "Goed gezelschap dan" },
    { bb: "SL doet net of nul normaal is", sl: "Nul is een goede basis", kl: "Voor wat precies" },
    { bb: "Saté Lounge meer Lounge dan Saté vandaag", sl: "Lounging is ook een kunst", kl: "Eén die niet betaalt" },
    { bb: "Wij maken ons zorgen SL", sl: "Lief van je BB", kl: "Doe ik ook een beetje" },
    { bb: "Straks sprint SL nog voorbij ons", sl: "Dat is de bedoeling", kl: "Dat zie ik dan wel" },
    { bb: "Saté zonder klanten is gewoon vlees", sl: "Vlees wacht op zijn moment", kl: "Kroket ook maar wacht niet zo lang" },
    { bb: "SL is rustig aan het grillen voor niemand", sl: "Grillen voor jezelf is ook fijn", kl: "Beetje duur hobby" },
    { bb: "Nul bij SL. Dat is zeldzaam.", sl: "Zeldzaam is niet hetzelfde als slecht", kl: "Nul is wel gewoon slecht" },
    { bb: "Kom op SL. Je kan dit.", sl: "Dank je BB. Dat is onverwacht aardig.", kl: "Ik had ze ook aangespoord maar ok" },
    { bb: "SL staat klaar voor niets", sl: "Wij staan klaar voor alles. Niets komt alleen nog.", kl: "Ik begrijp dat gevoel" },
    { bb: "De pindakaassaus staat te wachten", sl: "En dat is het enige wat wacht. Nog.", kl: "Geduld is een deugd. Maar geen omzet." },
    { bb: "Katendrecht slaapt nog", sl: "Katendrecht is altijd wakker. Ik nog niet helemaal.", kl: "Dan moet je koffie drinken. Vraag BB." },
    { bb: "SL-klanten zijn selectief", sl: "Selectief en slim", kl: "En blijkbaar ook laat" },
    { bb: "Nul bij SL geeft BB een goed gevoel", sl: "Geniet er maar van BB", kl: "Niet te lang genieten. Komt verandering." },
    { bb: "Stilte voor de saté-storm", sl: "Precies hoe ik het zie", kl: "Storm of briesje. Dat zien we dan." },
    { bb: "SL bouwt spanning op", sl: "Bewust. Heel bewust.", kl: "Spanning zonder omzet is theater" },
    { bb: "Is SL vandaag wel open?", sl: "Open en leeg. Dat is het verschil.", kl: "Open en leeg bij mij heet 'nog even'" },
    { bb: "Nul als strategie van SL", sl: "Niet als strategie. Als situatie.", kl: "Nuance" },
    { bb: "SL verkoopt niks maar heeft wel sfeer", sl: "Sfeer converteert ook", kl: "Langzaam" },
    { bb: "Rust voor de rush bij SL", sl: "Precies dat", kl: "Of rust voor meer rust" },
    { bb: "SL in de wachtkamer", sl: "Wachtkamer met goede muziek", kl: "Muziek betaalt de rekening niet" },
    { bb: "Grill staat aan, mensen niet", sl: "Mensen komen vanzelf", kl: "Met kroket idem" },
    { bb: "SL's nul heeft karakter", sl: "Alles bij SL heeft karakter", kl: "Karakter is fijn. Omzet is beter." },
    { bb: "Wij kijken mee SL. Niks geks.", sl: "We zien jullie kijken BB", kl: "Ik kijk ook maar dan naar mijn frituur" },
    { bb: "Saté verdient klanten. Ze komen eraan.", sl: "Ze komen. Altijd.", kl: "Ik geloof ze" },
  ],
  kl_nul: [
    { bb: "Heeft KL al iemand gezien?", sl: "Ssht, laat ze slapen", kl: "Ik wacht op de juiste klant" },
    { bb: "Kroket-stand gesloten geloof ik", sl: "Of ze tellen de munten nog", kl: "Kwaliteit boven kwantiteit" },
    { bb: "KL staat er al wel hè?", sl: "Ja maar niemand wil", kl: "Ze komen wel... 🥟" },
    { bb: "Nul krokets verkocht. Nul.", sl: "Nul is een feit BB", kl: "Het vet moet eerst op temperatuur" },
    { bb: "KL doet rustig aan vandaag", sl: "KL doet altijd rustig aan", kl: "Rustig is goed voor de kroket" },
    { bb: "Ik gun ze een klantje", sl: "Ik ook eigenlijk", kl: "Ik ook. Eentje maar." },
    { bb: "Ze zoeken nog de frituurpan", sl: "Die staat er toch al?", kl: "Ik zoek de motivatie" },
    { bb: "Nul bij KL maar ze staan er", sl: "Aanwezig zijn is ook wat", kl: "Dankjewel. Dat raak me." },
    { bb: "Geen verkoop is ook data", sl: "Negatieve data", kl: "Ik noem het: baseline" },
    { bb: "KL wacht op de lunchrun", sl: "Die lunchrun duurt lang", kl: "Goed ding kan lang duren" },
    { bb: "Hoe lang staat die kroket al warm?", sl: "Te lang", kl: "Een kroket is nooit te lang warm" },
    { bb: "Rotterdam zegt: kroket kan wachten", sl: "Rotterdam zegt: geef maar", kl: "Rotterdam snapt het gewoon niet" },
    { bb: "KL in de startblokken maar het pistool komt niet", sl: "Ik hoor het pistool in mijn hoofd", kl: "Dan ren ik alvast" },
    { bb: "Kroket-nul is ook een vibe", sl: "Geen vibe. Geen klanten.", kl: "Alle vibes zijn vibes" },
    { bb: "KL heeft geduld als een frituurpan", sl: "Een frituurpan wacht altijd", kl: "En wordt beter met de tijd" },
    { bb: "Het loket staat open. De klant staat niet.", sl: "Dat is het punt van een loket", kl: "Er staat iemand. Achter het loket. Ik." },
    { bb: "KL-nul is mysterieus", sl: "Mysterie of eenvoud", kl: "Mysterie. Definitief." },
    { bb: "Ik geloof in KL. Echt.", sl: "Ik ook BB. Dat is lief.", kl: "Ik geloof ook in mezelf. Heel erg." },
    { bb: "Nul maar niet verslagen", sl: "Nul maar vol overtuiging", kl: "Nul met trots" },
    { bb: "KL bouwt aan iets", sl: "Aan wat precies?", kl: "Aan het kroket-imperium. Fase 1: bestaan." },
    { bb: "KL-klanten zijn specifiek", sl: "Selectief publiek", kl: "Mijn publiek weet wat het wil" },
    { bb: "Ze komen. KL's klanten. Ze komen.", sl: "Positief ingesteld", kl: "Ze komen altijd. Ik heb vertrouwen." },
    { bb: "Wacht op die eerste kroket van de dag", sl: "Die eerste is de start van een reeks", kl: "Die eerste is de mooiste" },
    { bb: "Nul vandaag maar het seizoen is lang", sl: "Lang seizoen is ook uitputtend", kl: "Ik loop de marathon. Geen sprint." },
    { bb: "KL-standaardpositie vroeg in de dag", sl: "Herkenbaar", kl: "Karakteristiek zeg ik liever" },
    { bb: "De frituur staat klaar. De klant wordt gevonden.", sl: "Vinden of afwachten?", kl: "Beetje van beiden" },
    { bb: "KL en nul. Bijna een vaste combinatie.", sl: "Vroeg in de dag dan", kl: "En dan explodeert de teller. Echt." },
    { bb: "Houd moed KL", sl: "We steunen je", kl: "Jullie steun is fijn maar ik heb de kroket" },
    { bb: "Straks staat KL er toch weer", sl: "KL staat er altijd", kl: "Altijd. Zonder uitzondering." },
    { bb: "De zon komt ook altijd op. Voor KL ook.", sl: "Poëtisch. En klopt.", kl: "Zon of regen: de kroket blijft" },
    { bb: "KL heeft de langste adem", sl: "En de heetste frituur", kl: "Beide kloppen" },
    { bb: "Nul nu. Maar de dag is nog lang.", sl: "Lange dag. Korte kroket. Mooie combinatie.", kl: "Ik houd van lange dagen" },
  ],
};

function bepaalScenario(bb: number, sl: number, kl: number): string {
  if (bb === 0 && sl === 0 && kl === 0) return "ochtend";
  if (bb === 0) return "bb_nul";
  if (sl === 0) return "sl_nul";
  if (kl === 0) return "kl_nul";

  // Volledige ranking — bepaalt leider, middle én laatste zodat elke
  // papegaai een zin krijgt die past bij zijn ECHTE positie vandaag.
  const rangen: Array<[string, number]> = [["bb", bb], ["sl", sl], ["kl", kl]];
  rangen.sort((a, b) => b[1] - a[1]);
  const max = rangen[0][1];
  const min = rangen[2][1];

  // Alle drie dicht bij elkaar (spread <25%) → gelijkspel
  if (max === 0 || (max - min) / max < 0.25) return "gelijkspel";

  return `${rangen[0][0]}_${rangen[1][0]}_${rangen[2][0]}`;
}

// ─── Animatie-definities ──────────────────────────────────────────────────────

interface AnimDef { naam: string; duur: string; herh: string; timing: string }

const ANIMATIES: AnimDef[] = [
  { naam: "pBob",     duur: "2.2s",  herh: "1",  timing: "ease-in-out" }, // rustige bob
  { naam: "pSpread",  duur: "1.4s",  herh: "1",  timing: "ease-in-out" }, // vleugels spreiden
  { naam: "pGaap",    duur: "1.8s",  herh: "1",  timing: "ease-in-out" }, // gapen
  { naam: "pSchud",   duur: "0.6s",  herh: "3",  timing: "ease-in-out" }, // hoofd schudden
  { naam: "pSprong",  duur: "0.9s",  herh: "1",  timing: "ease-out"    }, // springen
  { naam: "pWiebel",  duur: "0.5s",  herh: "4",  timing: "ease-in-out" }, // wiebelen
  { naam: "pBuig",    duur: "1.4s",  herh: "1",  timing: "ease-in-out" }, // buigen/strikken
  { naam: "pTril",    duur: "0.1s",  herh: "10", timing: "linear"      }, // opgewonden trillen
  { naam: "pDraai",   duur: "1.0s",  herh: "1",  timing: "ease-in-out" }, // flip/draaien
  { naam: "pKnik",    duur: "0.5s",  herh: "3",  timing: "ease-in-out" }, // knikken
];

const IDLE: AnimDef = { naam: "pIdle", duur: "3s", herh: "infinite", timing: "ease-in-out" };

// ─── Papegaai component ───────────────────────────────────────────────────────

function Papegaai({
  kleur,
  startDelay,
  tekst,
  actief,
}: {
  kleur: string;
  startDelay: number;
  tekst: string;
  actief: boolean;
}) {
  const [huidig, setHuidig] = useState<AnimDef>(IDLE);
  const [animKey, setAnimKey] = useState(0); // force re-render om animatie opnieuw te triggeren
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const planVolgende = useCallback(() => {
    // Wacht 1–4 seconden (idle), dan nieuwe willekeurige animatie
    const wacht = 1000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => {
      setHuidig(ANIMATIES[Math.floor(Math.random() * ANIMATIES.length)]);
      setAnimKey(k => k + 1);
    }, wacht);
  }, []);

  useEffect(() => {
    // Start na initiële vertraging
    timerRef.current = setTimeout(() => {
      setHuidig(ANIMATIES[Math.floor(Math.random() * ANIMATIES.length)]);
      setAnimKey(k => k + 1);
    }, startDelay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* Papegaai emoji */}
      <span
        key={animKey}
        className="text-3xl select-none cursor-default"
        style={{
          filter: `drop-shadow(0 0 8px ${kleur}) drop-shadow(0 0 16px ${kleur}66)`,
          animation: `${huidig.naam} ${huidig.duur} ${huidig.timing} ${huidig.herh}`,
          display: "inline-block",
          transformOrigin: "bottom center",
        }}
        onAnimationEnd={planVolgende}
      >
        🦜
      </span>

      {/* Speech bubble — hangt ONDER de papegaai */}
      <div
        className="absolute top-full mt-0.5 px-2 py-1 rounded-lg text-[9px] font-semibold text-white w-[140px] text-center leading-tight transition-all duration-500 z-50"
        style={{
          background: kleur + "ee",
          opacity: actief ? 1 : 0,
          transform: actief ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.9)",
          pointerEvents: "none",
          boxShadow: actief ? `0 2px 12px ${kleur}66` : "none",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          whiteSpace: "normal",
        }}
      >
        <span
          className="absolute left-1/2 -top-1 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: `5px solid ${kleur}ee`,
          }}
        />
        {tekst}
      </div>
    </div>
  );
}

// ─── BedrijfKolom ─────────────────────────────────────────────────────────────

function BedrijfKolom({
  slug, naam, emoji, kleur, onOmzetUpdate, isActief,
}: {
  slug: Slug; naam: string; emoji: string; kleur: string;
  onOmzetUpdate: (slug: Slug, omzet: number) => void;
  isActief?: boolean;
}) {
  const [data, setData]         = useState<LiveData | null>(null);
  const [verwacht, setVerwacht] = useState<VerwachtData | null>(null);
  const [nu, setNu]             = useState(new Date());

  const laadLive = useCallback(async () => {
    try {
      const res  = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
      onOmzetUpdate(slug, json.omzetVandaag ?? 0);
    } catch { /* stil */ }
  }, [slug, onOmzetUpdate]);

  const laadVerwacht = useCallback(async () => {
    try {
      const res  = await fetch(`/api/verwacht/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setVerwacht(json);
    } catch { /* stil */ }
  }, [slug]);

  useEffect(() => {
    laadLive();
    laadVerwacht();
    const tLive     = setInterval(laadLive,        20_000);
    const tVerwacht = setInterval(laadVerwacht, 5 * 60_000);
    const tKlok     = setInterval(() => setNu(new Date()), 60_000);
    window.addEventListener("dashboard:refresh", laadLive);
    return () => {
      clearInterval(tLive); clearInterval(tVerwacht); clearInterval(tKlok);
      window.removeEventListener("dashboard:refresh", laadLive);
    };
  }, [laadLive, laadVerwacht]);

  const verwachtNu = useMemo(
    () => verwacht ? verwachtTotNu(verwacht.weekdagCurve) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verwacht, nu]
  );

  const omzet    = data?.omzetVandaag ?? 0;
  const klanten  = data?.aantalTransactiesVandaag ?? null;
  const heeftSchema = verwacht !== null && (verwacht.verwachtVandaag > 0 || verwacht.weekdagCurve.some(v => v > 0));
  const voorOp   = omzet >= verwachtNu;
  const verschil = Math.abs(omzet - verwachtNu);

  return (
    <div
      className="px-3 sm:px-4 py-2 border-r last:border-r-0"
      style={{ borderColor: "#1e2530" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] font-mono truncate"
          style={{ color: kleur, opacity: isActief ? 1 : 0.6 }}
        >
          {naam}
        </span>
      </div>
      <p
        className="text-sm sm:text-base font-bold font-mono tabular-nums leading-tight"
        style={{ color: "#e2e8f0" }}
      >
        {data ? fmt(omzet) : "€–"}
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-0.5 gap-0.5">
        {heeftSchema ? (
          <span
            className="text-[9px] sm:text-[10px] font-mono font-semibold"
            style={{ color: voorOp ? "#4ade80" : "#f87171" }}
          >
            {voorOp ? "✓" : "✗"} {voorOp ? "+" : "-"}{fmt(verschil)}
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#475569" }}>
            schema laadt…
          </span>
        )}
        {klanten !== null && (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#64748b" }}>
            {klanten} klanten
          </span>
        )}
      </div>
    </div>
  );
}

// ─── LiveBalk (root) ──────────────────────────────────────────────────────────

export default function LiveBalk() {
  const pathname   = usePathname();
  const [omzetten, setOmzetten] = useState<Record<Slug, number>>({ bb: 0, sl: 0, kl: 0 });
  // Gesprekstoestand: wie praat nu, welke zin, welk grappenset
  const [spreker, setSpreker]   = useState<number | null>(null); // null = stilte
  const [jokeSetIdx, setJokeSetIdx] = useState(0);
  const [zinIdx, setZinIdx]     = useState(0); // 0=bb 1=sl 2=kl
  const convTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const omzettenRef  = useRef(omzetten);
  omzettenRef.current = omzetten;

  const updateOmzet = useCallback((slug: Slug, omzet: number) => {
    setOmzetten(prev => ({ ...prev, [slug]: omzet }));
  }, []);

  // Shuffle-helper — geeft willekeurige volgorde 0,1,2
  const shuffleVolgorde = () => [0, 1, 2].sort(() => Math.random() - 0.5);

  // Plan het gesprek als een echte uitwisseling:
  // BB zegt iets → pauze → SL reageert → pauze → KL sluit af → langere stilte → nieuw gesprek
  const volgordeRef  = useRef<number[]>(shuffleVolgorde());
  const stapRef      = useRef(0); // welke zin in het gesprek

  const planVolgendeZin = useCallback(() => {
    if (convTimerRef.current) clearTimeout(convTimerRef.current);

    const stap = stapRef.current;

    if (stap >= 3) {
      // Gesprek klaar — langere stilte (5–12s) voor een nieuw gesprek
      setSpreker(null);
      const stilte = 5000 + Math.random() * 7000;
      convTimerRef.current = setTimeout(() => {
        volgordeRef.current = shuffleVolgorde();
        stapRef.current = 0;
        setJokeSetIdx(j => j + 1);
        planVolgendeZin();
      }, stilte);
      return;
    }

    // Toon zin van de volgende spreker (in willekeurige volgorde)
    const sprekerIdx = volgordeRef.current[stap];
    setSpreker(sprekerIdx);
    setZinIdx(sprekerIdx);
    stapRef.current = stap + 1;

    // Zin blijft 2.5–5s zichtbaar (langere zinnen wat langer)
    const leestijd = 2500 + Math.random() * 2500;
    convTimerRef.current = setTimeout(() => {
      setSpreker(null); // pauze tussen zinnen
      const pauze = 400 + Math.random() * 800;
      convTimerRef.current = setTimeout(planVolgendeZin, pauze);
    }, leestijd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Start gesprek na 2s
    convTimerRef.current = setTimeout(planVolgendeZin, 2000);
    return () => { if (convTimerRef.current) clearTimeout(convTimerRef.current); };
  }, [planVolgendeZin]);

  // Kies grappen op basis van huidige omzetten — willekeurige volgorde per scenario
  const shuffleRef = useRef<Record<string, number[]>>({});
  const grappen = useMemo(() => {
    const scenario = bepaalScenario(omzetten.bb, omzetten.sl, omzetten.kl);
    const sets     = GRAPPEN[scenario] ?? GRAPPEN.ochtend;
    if (!shuffleRef.current[scenario] || shuffleRef.current[scenario].length !== sets.length) {
      shuffleRef.current[scenario] = sets.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    const volgorde = shuffleRef.current[scenario];
    return sets[volgorde[jokeSetIdx % volgorde.length]];
  }, [omzetten, jokeSetIdx]);

  const ZINNEN: Record<number, string> = { 0: grappen.bb, 1: grappen.sl, 2: grappen.kl };
  const TEKSTEN: Record<Slug, string> = {
    bb: ZINNEN[0],
    sl: ZINNEN[1],
    kl: ZINNEN[2],
  };

  const DELAYS = [0, 800, 1800];

  // Welkomst via papegaai ipv WelkomBanner
  const [welkomOverride, setWelkomOverride] = useState<{ idx: number; tekst: string } | null>(null);
  const welkomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WELKOM_PAPEGAAI: Record<string, { idx: number; tekst: string }> = {
    Ricardo: { idx: 0, tekst: "Welkom Ricardo! ☕ Goeie dag gewenst 💙" },
    Matthieu: { idx: 2, tekst: "Welkom Matthieu! 🥟 Klaar voor de dag? 🧡" },
  };

  useEffect(() => {
    function toonWelkom(naam: string) {
      const config = WELKOM_PAPEGAAI[naam];
      if (!config) return;
      setWelkomOverride(config);
      if (welkomTimerRef.current) clearTimeout(welkomTimerRef.current);
      welkomTimerRef.current = setTimeout(() => setWelkomOverride(null), 5000);
    }
    const pending = sessionStorage.getItem("sg_welkom_pending");
    if (pending) {
      sessionStorage.removeItem("sg_welkom_pending");
      toonWelkom(pending);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ naam: string }>).detail;
      if (detail?.naam) {
        sessionStorage.removeItem("sg_welkom_pending");
        toonWelkom(detail.naam);
      }
    };
    window.addEventListener("sg:welkom", handler);
    return () => {
      window.removeEventListener("sg:welkom", handler);
      if (welkomTimerRef.current) clearTimeout(welkomTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* CSS animaties */}
      <style>{`
        /* Idle: heel rustige schommel */
        @keyframes pIdle {
          0%,100% { transform: rotate(0deg) scale(1); }
          50%     { transform: rotate(3deg) scale(1.03); }
        }
        /* Bob: rustige op-neer */
        @keyframes pBob {
          0%,100% { transform: translateY(0); }
          40%     { transform: translateY(-8px) scale(1.05); }
          70%     { transform: translateY(-4px); }
        }
        /* Vleugels spreiden: breed uitklappen */
        @keyframes pSpread {
          0%,100% { transform: scaleX(1)   scaleY(1); }
          30%     { transform: scaleX(1.8) scaleY(0.65); }
          60%     { transform: scaleX(1.5) scaleY(0.8); }
          80%     { transform: scaleX(1.1) scaleY(0.95); }
        }
        /* Gapen: rek en gaap */
        @keyframes pGaap {
          0%,100% { transform: scaleY(1)   scaleX(1); }
          20%     { transform: scaleY(1.25) scaleX(0.85); }
          50%     { transform: scaleY(1.35) scaleX(0.8); }
          80%     { transform: scaleY(1.1)  scaleX(0.95); }
        }
        /* Hoofd schudden: nee nee nee */
        @keyframes pSchud {
          0%,100% { transform: rotate(0deg); }
          25%     { transform: rotate(-22deg); }
          75%     { transform: rotate(22deg); }
        }
        /* Springen: squat → lucht → landen */
        @keyframes pSprong {
          0%,100% { transform: translateY(0)    scaleY(1)    scaleX(1); }
          15%     { transform: translateY(3px)   scaleY(0.7)  scaleX(1.2); }
          40%     { transform: translateY(-20px) scaleY(1.15) scaleX(0.9); }
          75%     { transform: translateY(-6px)  scaleY(1.05) scaleX(0.97); }
          90%     { transform: translateY(2px)   scaleY(0.85) scaleX(1.1); }
        }
        /* Wiebelen: heupen zwaaien */
        @keyframes pWiebel {
          0%,100% { transform: translateX(0)   rotate(0deg); }
          25%     { transform: translateX(-6px) rotate(-12deg); }
          75%     { transform: translateX(6px)  rotate(12deg); }
        }
        /* Buigen: diep buigen en terug */
        @keyframes pBuig {
          0%,100% { transform: rotate(0deg); }
          30%,60% { transform: rotate(40deg); }
        }
        /* Opgewonden trillen */
        @keyframes pTril {
          0%,100% { transform: translateX(0)   rotate(0deg); }
          25%     { transform: translateX(-4px) rotate(-6deg); }
          75%     { transform: translateX(4px)  rotate(6deg); }
        }
        /* Omdraaien/flip (scaleX) */
        @keyframes pDraai {
          0%    { transform: scaleX(1); }
          25%   { transform: scaleX(0.1) scaleY(1.1); }
          50%   { transform: scaleX(-1); }
          75%   { transform: scaleX(-0.1) scaleY(1.1); }
          100%  { transform: scaleX(1); }
        }
        /* Knikken: ja ja ja */
        @keyframes pKnik {
          0%,100% { transform: rotate(0deg); }
          30%     { transform: rotate(-18deg); }
          60%     { transform: rotate(8deg); }
        }
      `}</style>

      <div
        className="w-full sticky top-0 z-50"
        style={{ background: "#0a0e14", borderBottom: "1px solid #1e2530" }}
      >
        {/* Datakolommen — klikbaar als navigatie */}
        <div className="flex" style={{ borderBottom: "1px solid #1a2030" }}>
          {BEDRIJVEN.map((b) => {
            const isActief = pathname === `/${b.slug}`;
            return (
              <Link
                key={b.slug}
                href={`/${b.slug}`}
                className="flex-1 block"
                style={isActief ? { borderBottom: `2px solid ${b.kleur}` } : { borderBottom: "2px solid transparent" }}
              >
                <BedrijfKolom
                  {...b}
                  onOmzetUpdate={updateOmzet}
                  isActief={isActief}
                />
              </Link>
            );
          })}
        </div>

        {/* Papegaaienrij — onderaan de balk */}
        <div className="flex">
          {BEDRIJVEN.map((b, i) => {
            const welkomActief = welkomOverride?.idx === i;
            const isActief = welkomOverride ? welkomActief : spreker === i;
            const tekst = welkomActief ? welkomOverride!.tekst : TEKSTEN[b.slug];
            return (
              <div
                key={b.slug}
                className="flex-1 flex justify-center items-center py-1 border-r last:border-r-0"
                style={{ borderColor: "#1e2530" }}
              >
                <Papegaai
                  kleur={b.kleur}
                  startDelay={DELAYS[i]}
                  tekst={tekst}
                  actief={isActief}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
