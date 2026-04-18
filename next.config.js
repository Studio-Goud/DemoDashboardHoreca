// Forceer NL-tijdzone voor alle Date-operaties in server-code. Vercel
// serverless functions draaien standaard in UTC; zonder deze regel zouden
// uur-buckets en "vandaag" verkeerd vallen.
process.env.TZ = "Europe/Amsterdam";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Zorg dat de historische Excel-bestanden worden meegebundeld in de
  // Vercel serverless function. Zonder deze config pakt Next's file-
  // tracing de .xlsx's in de repo-root niet op en crasht getZettle...
  // in productie ("file not found").
  experimental: {
    outputFileTracingIncludes: {
      "/[bedrijf]": ["./*.xlsx", "./data/*.json"],
      "/[bedrijf]/page": ["./*.xlsx", "./data/*.json"],
    },
  },
};

module.exports = nextConfig;
