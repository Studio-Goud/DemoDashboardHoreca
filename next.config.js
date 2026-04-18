/** @type {import('next').NextConfig} */
const nextConfig = {
  // Zorg dat de historische Excel-bestanden worden meegebundeld in de
  // Vercel serverless function. Zonder deze config pakt Next's file-
  // tracing de .xlsx's in de repo-root niet op en crasht getZettle...
  // in productie ("file not found").
  experimental: {
    outputFileTracingIncludes: {
      "/[bedrijf]": ["./*.xlsx"],
      "/[bedrijf]/page": ["./*.xlsx"],
    },
  },
};

module.exports = nextConfig;
