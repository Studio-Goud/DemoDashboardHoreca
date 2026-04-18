import { unstable_cache } from "next/cache";
import { format, subYears, parseISO, addDays } from "date-fns";

// Rotterdam coördinaten (Markthal)
const LAT = 51.9225;
const LON = 4.47917;

export interface WeerDag {
  datum: string;          // yyyy-MM-dd
  tempMax: number;        // °C
  tempMin: number;        // °C
  neerslag: number;       // mm
  weerCode: number;       // WMO code
}

// WMO weer-codes → categorie + emoji
const CATEGORIEEN: Array<{ codes: number[]; categorie: string; emoji: string }> = [
  { codes: [0],                     categorie: "zonnig",    emoji: "☀️" },
  { codes: [1, 2],                  categorie: "licht bewolkt", emoji: "🌤" },
  { codes: [3],                     categorie: "bewolkt",   emoji: "☁️" },
  { codes: [45, 48],                categorie: "mist",      emoji: "🌫" },
  { codes: [51, 53, 55, 56, 57],    categorie: "motregen",  emoji: "🌦" },
  { codes: [61, 63, 65, 66, 67],    categorie: "regen",     emoji: "🌧" },
  { codes: [71, 73, 75, 77],        categorie: "sneeuw",    emoji: "❄️" },
  { codes: [80, 81, 82],            categorie: "buien",     emoji: "🌧" },
  { codes: [85, 86],                categorie: "sneeuwbuien", emoji: "🌨" },
  { codes: [95, 96, 99],            categorie: "onweer",    emoji: "⛈" },
];

export function weerInfo(code: number): { categorie: string; emoji: string } {
  for (const c of CATEGORIEEN) {
    if (c.codes.includes(code)) return { categorie: c.categorie, emoji: c.emoji };
  }
  return { categorie: "onbekend", emoji: "·" };
}

interface OpenMeteoResponse {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
}

function parseResponse(data: OpenMeteoResponse): WeerDag[] {
  const d = data.daily;
  if (!d) return [];
  const n = d.time.length;
  const uit: WeerDag[] = [];
  for (let i = 0; i < n; i++) {
    uit.push({
      datum: d.time[i],
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      neerslag: d.precipitation_sum[i],
      weerCode: d.weather_code[i],
    });
  }
  return uit;
}

async function fetchWeerHistorie(startDatum: string, eindDatum: string): Promise<WeerDag[]> {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    start_date: startDatum,
    end_date: eindDatum,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    timezone: "Europe/Amsterdam",
  });
  const res = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  return parseResponse(await res.json());
}

async function fetchWeerForecast(dagen = 16): Promise<WeerDag[]> {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    timezone: "Europe/Amsterdam",
    forecast_days: String(dagen),
    past_days: "1",
  });
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  return parseResponse(await res.json());
}

// Gecombineerde historie + forecast. 24h cache — weer verandert niet snel
// genoeg om vaker op te halen.
export const getWeer = unstable_cache(
  async (): Promise<WeerDag[]> => {
    const vandaag = new Date();
    const startHist = format(subYears(vandaag, 3), "yyyy-MM-dd");
    const eindHist = format(addDays(vandaag, -2), "yyyy-MM-dd");
    const [historie, forecast] = await Promise.all([
      fetchWeerHistorie(startHist, eindHist),
      fetchWeerForecast(16),
    ]);
    // Ontdubbel op datum (forecast heeft past_days overlap)
    const map = new Map<string, WeerDag>();
    for (const d of historie) map.set(d.datum, d);
    for (const d of forecast) map.set(d.datum, d);
    return Array.from(map.values()).sort((a, b) =>
      a.datum.localeCompare(b.datum)
    );
  },
  ["weer-rotterdam-v1"],
  { revalidate: 86400, tags: ["weer"] }
);
