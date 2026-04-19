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
  bb_leidt: [
    { bb: "Niet lullen maar poetsen 😤", sl: "Jij verkoopt koffie aan verslaafden", kl: "Geen comment" },
    { bb: "Nie lullen maar poetsen — en tellen", sl: "Mijn klanten zijn selectiever", kl: "Ik werk aan mijn kroket-empire" },
    { bb: "De Kuip loopt ook niet leeg hoor", sl: "Die vergelijking gaat niet op", kl: "Wacht maar tot de lunch" },
    { bb: "Ik ga al een tijdje lekker 💅", sl: "Gefeliciteerd met je cafeïne-business", kl: "Ik ben gewoon traag op gang" },
    { bb: "Rotterdam aan de koffie vandaag", sl: "Rotterdam is altijd al verslaafd", kl: "Dat wisten we al" },
    { bb: "Markthal kan wat van ons leren", sl: "Die heeft geen keuken meer nodig", kl: "Ik ook bijna niet" },
    { bb: "De teller loopt door hoor 😏", sl: "Dat zie ik ja. Zucht.", kl: "Straks inhalen" },
    { bb: "Feyenoord wint ook altijd uiteindelijk", sl: "Dat is een andere sport", kl: "En een andere uitslag" },
    { bb: "Wij zijn de Coolsingel van de horeca", sl: "Lekker breed en leeg?", kl: "Hahaha goeie" },
    { bb: "Zo zie je maar. Koffie regeert", sl: "In Den Haag drinken ze thee", kl: "En terecht dat ze verloren" },
    { bb: "Kom op dan, bij ons kan iedereen terecht", sl: "Behalve mensen zonder geld", kl: "En Ajax-supporters" },
    { bb: "Wij zijn gewoon op dreef 🚀", sl: "Ja ja, geniet er maar van", kl: "Volgende week anders" },
    { bb: "Dit voelt als een Champions League avond", sl: "Vergeet het — jij bent PSV max", kl: "Ik ben NAC" },
    { bb: "BB aan kop zoals het hoort", sl: "Koffie is bedrog, saté is liefde", kl: "Ik wacht gewoon mijn beurt af" },
    { bb: "Wij lopen gewoon weg", sl: "Je loopt weg van je eigen zinloosheid", kl: "Dat is wel een beetje hard" },
    { bb: "Kaas en koffie, winnende combo", sl: "Saté is meer waard dan kaas", kl: "Kroket heeft kaas. Ik win altijd." },
    { bb: "BB tikt lekker door 🎶", sl: "Dat tikken hoor ik de hele dag", kl: "Ik hoor niks. Stil hier." },
    { bb: "Lekker bezig vandaag", sl: "BB is altijd lekker bezig met zichzelf praten", kl: "En toch kijkt iedereen" },
    { bb: "Brunch is meer dan eten, het is een ervaring", sl: "Saté is ook een ervaring. Grillervaring.", kl: "Kroket is ook een ervaring. Teleurstellende als je pech hebt." },
    { bb: "Onze klanten komen twee keer", sl: "Terugkerende klanten bij ons ook hoor", kl: "Mijn klanten komen als ze het willen" },
    { bb: "Score loopt op als de Maas bij vloed", sl: "Die metafoor werkt niet precies", kl: "Maar we snappen het" },
    { bb: "Wij zetten de toon voor Studio Goud", sl: "Die toon is een beetje vals", kl: "Ik zeg niks" },
    { bb: "Als dit een voetbalwedstrijd was, staan wij voor", sl: "En dan komt de rode kaart voor ballen", kl: "Haha" },
    { bb: "Koffie op koffie, dat scheelt", sl: "Stapelen jullie het op?", kl: "Cafeïne-piramide" },
    { bb: "De espresso shot werkt", sl: "Bij de klanten of bij jullie?", kl: "Beide hoop ik voor ze" },
    { bb: "Brunch is het beste maaltijdconcept ooit verzonnen", sl: "Avondeten is uitgevonden door mensen met brein", kl: "Kroket past bij alle maaltijden. Altijd." },
    { bb: "Wij lopen op stoom", sl: "Jullie lopen op cafeïne. Dat is anders.", kl: "Ik loop op frituurvet. Gezonder dan stoom." },
    { bb: "BB goes brrrr 💸", sl: "Dat doet de koffieapparaat ook letterlijk", kl: "Mijn frituur gaat ook ergens" },
    { bb: "Goede dag voor BB", sl: "Elke dag is goed als je je ogen sluit", kl: "Ik houd mijn ogen open. En zie jullie allebei." },
    { bb: "Wij tikken alvast de punten aan", sl: "Het seizoen is lang", kl: "En ik speel blessuretijd" },
    { bb: "Wist je dat koffie de economie draaiende houdt?", sl: "Wist je dat saté de geest voedt?", kl: "Wist je dat kroket gewoon lekker is?" },
    { bb: "Rotterdam kiest voor BB vandaag", sl: "Rotterdam weet niet wat goed voor ze is", kl: "Rotterdam kiest me zondag. Even wachten." },
    { bb: "Ik trek de omzet omhoog voor het team", sl: "Zo zie ik het niet precies", kl: "Mooi van je BB" },
    { bb: "Top dag dit", sl: "Voor jou dan", kl: "Relatief" },
    { bb: "Het klopt gewoon. BB boven.", sl: "Tot het niet meer klopt", kl: "Dan ben ik er al" },
    { bb: "Teller staat hoog. Gezond hoog.", sl: "Ongezond veel koffie", kl: "Mijn teller staat laag maar heeft karakter" },
    { bb: "Blij mee. Niet arrogant maar blij.", sl: "Je bent arrogant", kl: "Beetje wel ja" },
    { bb: "Wie de dag begint, wint de dag", sl: "Die logica hangt af van definities", kl: "Ik ga morgen vroeger open" },
    { bb: "Euromast-hoogte qua omzet", sl: "Euromast is 185 meter. Beetje hoog gegrepen.", kl: "Ik sta op het Zuiderterras. Lager maar gezellig." },
    { bb: "Brunch-vibes zijn onverslaanbaar", sl: "Saté-vibes zijn tijdloos", kl: "Kroket-vibes zijn echt" },
    { bb: "Wij drukken af vandaag", sl: "Jullie drukken op de knopjes van die koffiemachine", kl: "Ik druk niks. Gooi gewoon in de frituur." },
    { bb: "Niet slecht voor een brunch-tent", sl: "Niet slecht voor een café-in-vermomming", kl: "Niet slecht. Maar ik houd jullie in de gaten." },
    { bb: "Cafeïne sells", sl: "Saté sells better", kl: "Kroket sells als het vet goed is" },
    { bb: "Hoe goed voelt dit", sl: "Dat weet ik niet want ik sta achter", kl: "Ik voel het ook niet want ik sta ver achter" },
    { bb: "Vandaag is BB-dag", sl: "Morgen is SL-dag", kl: "Overmorgen is KL-dag. Onthoud dat." },
    { bb: "Wij zijn scherp vandaag", sl: "Scherp als een botte saté-stok", kl: "Een botte stok doet ook pijn" },
    { bb: "Mooi getal op de teller", sl: "Mooi voor jou", kl: "Eerlijk gezegd ook mooi voor ons allemaal" },
    { bb: "Ik hou dit vast", sl: "Dat hoop je maar", kl: "Dat twijfel ik aan" },
    { bb: "BB doet waar BB goed in is", sl: "Cafeïne pushen?", kl: "Hahaha" },
    { bb: "Ongeslagen nog steeds", sl: "Vandaag dan", kl: "Tot nu toe" },
    { bb: "Lekker. Gewoon lekker bezig.", sl: "Jij zegt dat elke keer als je voor staat", kl: "En als hij achter staat ook" },
    { bb: "Elke klant telt", sl: "Maar jij hebt er meer", kl: "Ik tel ze allemaal dubbel" },
    { bb: "Goed gepland is half gewonnen", sl: "Jij hebt geluk. Dat is anders dan planning.", kl: "Ik heb ook een plan. Zit in mijn hoofd." },
    { bb: "De lat ligt hoog bij ons", sl: "Dat is een instelling, geen prestatie", kl: "Ik heb geen lat. Ik heb een frituurmand." },
    { bb: "We verslaan onszelf elke dag", sl: "Dat snap ik niet helemaal", kl: "Ik ook niet maar het klinkt stoer" },
    { bb: "Kwaliteit én kwantiteit", sl: "Jullie hebben kwantiteit. Kwaliteit is voor ons.", kl: "Ik doe kwantiteit als ik wil" },
    { bb: "Dit tempo houd ik bij", sl: "Ik heb ook een tempo. Mijn eigen tempo.", kl: "Ik heb ook een tempo. Langzamer maar gestadiger." },
    { bb: "Rotterdam zit bij ons aan tafel vandaag", sl: "Rotterdam zit bij mij op het terras", kl: "Rotterdam staat bij mij aan de toonbank" },
    { bb: "Wij zijn de motor van Studio Goud", sl: "Motoren stinken ook", kl: "Mijn frituur ook maar dat is ok" },
    { bb: "Neem maar een kijkje bij onze teller", sl: "Liever niet want ik word er niet blij van", kl: "Ik kijk ook liever niet" },
    { bb: "Vroeg begonnen en het loont", sl: "BB begint vroeg want niemand wil slapers ontbijt", kl: "Ik begin ook vroeg maar dan voor de lunch" },
    { bb: "Wij zijn de ochtendheld van vandaag", sl: "Ochtendheld duurt maar tot de middag", kl: "Dan neem ik het over" },
    { bb: "Niemand doet het zoals wij het doen", sl: "Dat klopt. Niemand anders doet het zo ook.", kl: "Elk compliment is ook een kritiek" },
    { bb: "BB domineert de dag", sl: "Domineren is groot woord", kl: "Maar het past vandaag" },
    { bb: "De omzetcurve wijst omhoog bij ons", sl: "Mijn curve ook. Alleen dan platter.", kl: "Ik heb een curve. Zit op de grond." },
    { bb: "Als je dit ziet, weet je hoe het moet", sl: "Nee. Ik weet hoe het ánders moet.", kl: "Ik weet hoe het met kroket moet" },
    { bb: "Feyenoord, de haven, en nu BB. Dat is Rotterdam.", sl: "SL is ook Rotterdam hoor", kl: "KL ook. Vergeet KL niet." },
    { bb: "Laat ze maar komen, wij staan klaar", sl: "Wij ook. Alleen ze kiezen jullie.", kl: "Ze komen ook naar mij. Later." },
    { bb: "Rotterdam verdient de beste koffie", sl: "Rotterdam verdient ook de beste saté", kl: "Rotterdam verdient ook de beste kroket" },
    { bb: "Van nul naar top. Dat is BB.", sl: "Van top naar... wachten", kl: "Van wachten naar kroket" },
    { bb: "Snel, lekker, betaalbaar", sl: "Dat zijn drie woorden die ook bij ons passen", kl: "Dat klinkt als mijn menu" },
    { bb: "Trots op ons team vandaag", sl: "Ons team is ook trots. Op zichzelf.", kl: "Ik ben ook trots. Op mijn frituur." },
    { bb: "In deze stad draait alles om koffie", sl: "In deze stad draait alles om geld", kl: "Geld verdien je met kroket" },
  ],
  sl_leidt: [
    { bb: "Sate-dag vandaag blijkbaar?", sl: "Elke dag is sate-dag 🍢", kl: "Ik begrijp er niks van" },
    { bb: "Dat komt door het weer vast", sl: "Nee, gewoon kwaliteit", kl: "Volgend uur boven jullie allebei" },
    { bb: "Saté loopt hard vandaag", sl: "Altijd al hard gelopen 😌", kl: "Ik ook maar dan langzamer" },
    { bb: "Wauw, gaan ze lekker", sl: "Rotterdam houdt van sate", kl: "Rotterdam houdt ook van kroket hoor" },
    { bb: "Hoe doen ze dat toch", sl: "Goed eten maken helpt", kl: "Dat doe ik ook!" },
    { bb: "Ik ga ook sate eten straks", sl: "Verstandige keuze", kl: "Verraad" },
    { bb: "SL knalt er doorheen", sl: "Stokje erin, sate d'rop, klaar", kl: "Als het maar zo makkelijk was" },
    { bb: "Dit had ik verwacht eigenlijk", sl: "Dat we winnen? Ja logisch", kl: "Ik ook eigenlijk" },
    { bb: "Katendrecht-energie vandaag bij SL", sl: "Altijd Katendrecht-energie", kl: "Ik zit meer op Spijkenisse-energie" },
    { bb: "Ok goed dan SL. Fair.", sl: "Dankjewel BB. Dat is groot van je.", kl: "Ik doe ook mee hoor" },
    { bb: "Als ik geen koffie had zou ik ook sate doen", sl: "Nee dat doe je niet", kl: "Nee dat doe je niet" },
    { bb: "SL vandaag echt bezig 🔥", sl: "Wij zijn altijd bezig", kl: "Ik ben ook bezig. Met wachten." },
    { bb: "Saté heeft de stad in z'n greep", sl: "Al een tijdje ja", kl: "Ik ga sate bestellen voor de lunch" },
    { bb: "Wij respecteren SL. Echt.", sl: "Dat gevoel is wederzijds BB", kl: "Mooi moment dit" },
    { bb: "Grillgeuren trekken klanten", sl: "Geur is marketing", kl: "Frituurlucht ook maar minder romantisch" },
    { bb: "SL trekt de dag", sl: "Wij trekken altijd de dag", kl: "Ik trek ook. Aan de korte kant van het touw." },
    { bb: "Rotterdam op sate vandaag", sl: "Rotterdam op sate elke dag", kl: "Rotterdam op sate. Helaas." },
    { bb: "Dit snap ik niet. Echt niet.", sl: "Dat geeft niks. Resultaten snap je niet. Die voel je.", kl: "Filosofisch voor een papegaai" },
    { bb: "SL als Feyenoord in de competitie", sl: "Als Feyenoord in de CL bedoel je", kl: "Dan is BB FC Emmen" },
    { bb: "Goed voor SL. Goed voor de stad.", sl: "Zo denk ik er ook over", kl: "Goed voor de stad maar wat voor mij" },
    { bb: "Klanten hebben smaak vandaag", sl: "Klanten hebben altijd smaak", kl: "Ze missen alleen de kroket-smaak" },
    { bb: "SL doet het slim", sl: "Wij doen het goed. Slim is erbij.", kl: "Ik doe het ook. Gewoon anders." },
    { bb: "Mooie score voor SL", sl: "Daar werken we elke dag voor", kl: "Ik werk er ook voor. Elke dag. Echt." },
    { bb: "De saté-machine draait op volle toeren", sl: "Machine staat goed ja", kl: "Mijn machine ook. Olie op temp." },
    { bb: "SL charmeert Rotterdam", sl: "Rotterdam is makkelijk te charmeren", kl: "Met kroket ook. Echt." },
    { bb: "Hoe dan. Hoe doe je dat.", sl: "Passie en pindakaassaus", kl: "Pindakaas past ook bij kroket" },
    { bb: "Eerlijk is eerlijk. Goed bezig.", sl: "Dankjewel BB. Dat betekent wat.", kl: "BB wordt aardig. Goed teken." },
    { bb: "We kijken even toe vandaag", sl: "Jullie mogen kijken. We doen het niet minder.", kl: "Ik kijk ook. Met bewondering." },
    { bb: "SL gaat lekker. Wij gaan ook ok.", sl: "Jullie gaan prima. Maar wij gaan beter.", kl: "Ik ga mijn eigen tempo" },
    { bb: "Vandaag is sate-dag in Rotterdam", sl: "Officieel uitgeroepen door mij", kl: "Ik roep morgen kroket-dag uit" },
    { bb: "Kop van Zuid-energie bij SL", sl: "Altijd Kop van Zuid", kl: "Ik zit meer op Hoek van Holland-energie" },
    { bb: "SL haalt alles eruit vandaag", sl: "We laten niks liggen", kl: "Ik laat soms wat liggen. In de olie." },
    { bb: "Respect van BB kant", sl: "Ontvangen. Dankjewel.", kl: "Ik geef ook respect. Stil respect." },
    { bb: "Saté wint harten", sl: "En omzet", kl: "Kroket wint maag" },
    { bb: "Dit is wat SL doet als ze lekker lopen", sl: "Dit is wat wij altijd doen", kl: "Dan lopen ze soms te snel" },
    { bb: "SL vandaag als de havenkraan: non-stop", sl: "Beeldend. Ik neem het.", kl: "Ik ben meer de roeiboot" },
    { bb: "Goed voor het team-gevoel als een van ons scoort", sl: "Mooi gezegd BB", kl: "Ik hou van teamgevoel" },
    { bb: "Saté heeft iets universeels", sl: "Vlees aan een stok is tijdloos", kl: "Kroket ook. Maar dan in een jas." },
    { bb: "Ik gun het ze", sl: "Dat is lief van je BB", kl: "Ik gun het ook. En straks gun ik mezelf kroket." },
    { bb: "SL in topvorm", sl: "Topvorm is onze standaard", kl: "Mijn topvorm is vrijdag" },
    { bb: "Niet te stoppen vandaag", sl: "Dat is het doel. Niet gestopt worden.", kl: "Stop mij dan maar. Ik sta klaar." },
    { bb: "Rotterdam kiest de grill", sl: "Rotterdam heeft altijd gekozen voor vuur", kl: "En voor frituur" },
    { bb: "Als saté zo gaat, ben ik onder de indruk", sl: "Wij zijn ook onder de indruk van onszelf", kl: "Dat heb ik ook. Van mijn eigen kroket." },
    { bb: "Goede middag voor SL zeg", sl: "Goede dag. Punt.", kl: "Goed voor hen. Wacht maar." },
    { bb: "Zo gaat dat dan", sl: "Zo gaat dat altijd", kl: "Dan wacht ik maar" },
    { bb: "Wat moet je er tegen zeggen", sl: "Niks. Gewoon kijken en bewonderen.", kl: "Of stil weggaan en kroket bakken" },
    { bb: "Ik weet nu ook dat saté werkt", sl: "Welkom bij de club", kl: "Ik was er al in de club. Van kroket." },
    { bb: "SL laat zien hoe het moet", sl: "Graag. Gratis les.", kl: "Ik neem notities" },
    { bb: "Saté-regen in Rotterdam", sl: "Best lekker zo'n regen", kl: "Regen van kroket is ook fijn" },
    { bb: "We schrijven SL even in als koploper", sl: "Schrijf het maar vet", kl: "Vet. Dat past ook bij kroket." },
    { bb: "Pindakaas maakt alles beter", sl: "Pindakaassaus maakt alles perfect", kl: "Kroket heeft ook saus. Mustard gang." },
    { bb: "Vandaag is SL-dag. Ik accepteer het.", sl: "Elke dag is SL-dag", kl: "Dan is elke dag ook KL-dag. Mijn regels." },
    { bb: "SL boven. BB dicht erbij.", sl: "Dicht is niet hetzelfde als gelijk", kl: "Gelijk ben ik ook niet maar ik ben er" },
    { bb: "Kaas-vs-sate: sate wint vandaag", sl: "Sate wint altijd. Kijk naar de statistieken.", kl: "Kroket wint als het er op aankomt" },
    { bb: "Ik kijk ernaar op", sl: "Dat is groot van je BB", kl: "Ik kijk ook omhoog. Naar de frituurmand." },
  ],
  kl_leidt: [
    { bb: "Hoe?!", sl: "WAT?!", kl: "🥟🥟🥟 IK ZEID HET" },
    { bb: "Is dit een vergissing?", sl: "Ik snap er niks van", kl: "Jullie kunnen wat van mij leren" },
    { bb: "Iemand uitleggen?", sl: "Geen idee wat er gaande is", kl: "Kroketten zijn de toekomst. Ik wist het." },
    { bb: "Dit heeft AI ook niet voorspeld", sl: "Dit heeft niemand voorspeld", kl: "IK WEL" },
    { bb: "KL leidt. Echt waar.", sl: "Ik moet even gaan zitten", kl: "Blijf maar staan, er komt meer aan" },
    { bb: "Rotterdam loopt op kroket vandaag", sl: "Rotterdam heeft echt alles", kl: "Rotterdam IS kroket" },
    { bb: "Ok respect. Dat geef ik toe.", sl: "Ik zeg niks want ik snap het niet", kl: "Dankjewel BB. Jij snapt het." },
    { bb: "Opeens snappen we Kroket Loket", sl: "Ik snap het nog steeds niet", kl: "Het vet. Het is het vet." },
    { bb: "De De Kuip gaat open voor de kroket", sl: "Dat is te ver", kl: "Is het? Is het echt te ver?" },
    { bb: "Ik ga morgen ook kroket op de kaart zetten", sl: "Dan wordt dit anders", kl: "Dan ga ik koffie schenken" },
    { bb: "Ok KL. Wat is jullie geheim?", sl: "Dat wil ik ook weten", kl: "Buitenlucht, verse olie, en een beetje geluk 🥟" },
    { bb: "Het kroket-loket is open for business", sl: "En zaken gaan goed blijkbaar", kl: "Zaken gaan altijd goed. Jullie merkten het nu pas." },
    { bb: "Nooit had ik dit verwacht op een dag als vandaag", sl: "Ik ook niet. Maar hier zijn we.", kl: "Hier zijn we inderdaad. Eindelijk." },
    { bb: "KL vliegt eruit", sl: "Ik ben een beetje jaloers eerlijk gezegd", kl: "Dat mag. Kom gerust langs." },
    { bb: "Kroket als concept werkt vandaag", sl: "Kroket als concept werkt altijd. Ze wisten het niet.", kl: "Nu weten ze het." },
    { bb: "Respectvol verslagen door frituur", sl: "Door een kroket. Ik ga even bellen.", kl: "Bel maar. Ik bak intussen door." },
    { bb: "KL doet wat KL altijd zegt dat het gaat doen", sl: "Altijd al iets met die kroket", kl: "Vertrouw de kroket. Altijd." },
    { bb: "Ik moet mijn businessplan herzien", sl: "Ik ook", kl: "Ik stuur jullie mijn kroket-manifest" },
    { bb: "Kroket loket kroket loket kroket", sl: "BB heeft een breakdown", kl: "Nee die heeft eindelijk inzicht" },
    { bb: "Dit is wat er gebeurt als je niet lacht om de kroket", sl: "Ik heb nooit gelachen", kl: "Jullie lachen straks wel" },
    { bb: "KL trekt de dag naar zich toe", sl: "Geen kroket-grap meer. Dit is ernst.", kl: "Altijd ernst bij mij" },
    { bb: "Heb ik ooit gezegd dat de kroket over-rated is?", sl: "Ja. Vorige week.", kl: "En kijk me nu" },
    { bb: "KL staat in de schijnwerpers", sl: "Schijnwerpers zijn vet-bestendig hoop ik", kl: "Alles bij mij is vet-bestendig" },
    { bb: "De stad kiest de kroket", sl: "De stad kiest wat lekker is. Dus kroket vandaag.", kl: "Elke dag" },
    { bb: "Ok KL. Jullie verdienen dit.", sl: "Dat is groot van BB", kl: "Groter dan die kroket? Nee." },
    { bb: "Even slikken. Dan accepteren.", sl: "Ik slik ook even", kl: "Jullie slikken. Ik bak door." },
    { bb: "Dit voelt als een koude douche voor BB en SL", sl: "Koud, ja. Maar verfrissend.", kl: "Ik houd jullie warm met een hete kroket" },
    { bb: "Wij zijn bescheiden verliezers", sl: "Ik ook. Maar ik vind het niet leuk.", kl: "Ik vind het leuk. Sorry." },
    { bb: "Wat heeft KL vandaag gedaan wat wij niet zagen", sl: "Ze hebben de kroket gemaakt. Dat zagen we maar we snapten het niet.", kl: "Nu snappen jullie het" },
    { bb: "KL fantastisch bezig", sl: "Fantastisch is groot woord. Maar ok.", kl: "Fantastisch is minimaal" },
    { bb: "Hoezo kroket. Hoezo.", sl: "Waarom niet kroket is de vraag", kl: "Eindelijk de juiste vraag" },
    { bb: "De frituur is de economische motor van Studio Goud vandaag", sl: "Dat accepteer ik niet maar het zijn de feiten", kl: "De feiten zijn in mijn voordeel" },
    { bb: "KL doet het rustig maar effectief", sl: "Rustig en effectief is de beste stijl", kl: "Dat is mijn stijl ja" },
    { bb: "Ik ga even een kroket eten. Misschien snap ik het dan.", sl: "Ik doe mee", kl: "Welkom. Dan snap je het meteen." },
    { bb: "Kroket-dag is vandaag", sl: "Kroket-dag is elke dag", kl: "Nu snappen jullie het" },
    { bb: "KL verstopt zich niet meer", sl: "KL heeft zich nooit verstopt. Wij keken gewoon de andere kant op.", kl: "Ik stond altijd hier" },
    { bb: "Onderschat de kroket niet", sl: "Dat doen we nooit meer na vandaag", kl: "Onthoud dit" },
    { bb: "Het loket staat open en de klanten komen", sl: "Dat is het simpele recept", kl: "Simpel en geniaal" },
    { bb: "KL van underdog naar topper", sl: "Was altijd een topper. Jullie hadden hem niet in de ranking.", kl: "Ik was altijd al nummer één. Bij mezelf." },
    { bb: "We leren vandaag iets nieuws", sl: "Dat de kroket echt werkt", kl: "Dat de kroket altijd al werkte" },
    { bb: "KL heeft iets gevonden", sl: "Ze hebben de kroket gevonden. Al heel lang.", kl: "Al heel lang ja" },
    { bb: "Ik buig voor KL", sl: "Ik ook. Eenmalig.", kl: "Eenmalig accepteer ik dat" },
    { bb: "De kroket is machtiger dan ik dacht", sl: "De kroket is altijd machtig geweest", kl: "Macht is gebaseerd op olie en meel. En liefde." },
    { bb: "Wij zijn verrast maar positief verrast", sl: "Ik ben ook positief verrast. Door mijn eigen teleurstelling.", kl: "Ik ben niet verrast. Ik ben consistent." },
    { bb: "KL loopt weg op de concurrentie", sl: "Er is geen concurrentie als de kroket regeert", kl: "Klopt. Er is geen concurrentie." },
    { bb: "Wat een dag voor KL. Echt.", sl: "Echt ja. Bewonderenswaardig.", kl: "Wat een dag elke dag" },
    { bb: "De kroket doet iets met mensen", sl: "De kroket doet iets met iedereen", kl: "Die iets heet: geluk" },
    { bb: "KL met kop en schouders boven alles", sl: "En boven ons dan", kl: "En boven jullie ja" },
    { bb: "Onze wortels liggen in de brunch. KL's wortels liggen in het vet.", sl: "Vet is goed voor de ziel", kl: "En voor de omzet" },
    { bb: "Ik ga vanavond kroket eten ter ere van dit moment", sl: "Ik ook", kl: "Ik maak ze zelf. Altijd vers." },
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
  const max = Math.max(bb, sl, kl);
  const min = Math.min(bb, sl, kl);
  if (max / Math.max(min, 1) > 2.5) {
    if (bb === max) return "bb_leidt";
    if (sl === max) return "sl_leidt";
    return "kl_leidt";
  }
  return "gelijkspel";
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
        className="absolute top-full mt-0.5 px-2 py-1 rounded-lg text-[9px] font-semibold text-white whitespace-nowrap max-w-[130px] text-center leading-tight transition-all duration-500 z-50"
        style={{
          background: kleur + "ee",
          opacity: actief ? 1 : 0,
          transform: actief ? "translateY(0) scale(1)" : "translateY(-4px) scale(0.9)",
          pointerEvents: "none",
          boxShadow: actief ? `0 2px 12px ${kleur}66` : "none",
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
          {BEDRIJVEN.map((b, i) => (
            <div
              key={b.slug}
              className="flex-1 flex justify-center items-center py-1 border-r last:border-r-0"
              style={{ borderColor: "#1e2530" }}
            >
              <Papegaai
                kleur={b.kleur}
                startDelay={DELAYS[i]}
                tekst={TEKSTEN[b.slug]}
                actief={spreker === i}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
