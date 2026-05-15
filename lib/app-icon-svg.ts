/**
 * Markthal HQ app-icoon — gedeelde SVG-bron voor zowel favicon (512×512)
 * als apple-touch-icon (180×180). De viewBox is 0 0 512 512 zodat 't
 * exact dezelfde tekening is, alleen op een ander output-formaat.
 *
 * Concept: Markthal-silhouet (horseshoe arch) met daarin de drie
 * vestiging-strips in BB blauw / SL groen / KL oranje. Gradient-stone
 * frame, neon-strips met halo + glow + tube-highlight.
 */
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="stone" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#2A2D35"/>
      <stop offset="50%" stop-color="#1A1C22"/>
      <stop offset="100%" stop-color="#0E0F13"/>
    </linearGradient>
    <linearGradient id="stoneEdge" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4A4D55"/>
      <stop offset="50%" stop-color="#2A2D35"/>
      <stop offset="100%" stop-color="#4A4D55"/>
    </linearGradient>
    <linearGradient id="void" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#020306"/>
      <stop offset="100%" stop-color="#060810"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="50%" cy="60%" r="55%">
      <stop offset="0%" stop-color="#30B26F" stop-opacity="0.16"/>
      <stop offset="50%" stop-color="#0A84FF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="112" fill="#070709"/>
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)"/>

  <path d="M 88 432 L 88 240 Q 88 88 256 88 Q 424 88 424 240 L 424 432 Z" fill="url(#stone)"/>
  <path d="M 88 240 Q 88 88 256 88 Q 424 88 424 240"
        fill="none" stroke="url(#stoneEdge)" stroke-width="2" opacity="0.5"/>

  <path d="M 140 432 L 140 256 Q 140 140 256 140 Q 372 140 372 256 L 372 432 Z" fill="url(#void)"/>

  <path d="M 140 256 Q 140 140 256 140 Q 372 140 372 256"
        fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.25"/>

  <g filter="url(#soft)" opacity="0.7">
    <rect x="170" y="232" width="172" height="10" rx="5" fill="#0A84FF"/>
    <rect x="170" y="290" width="172" height="10" rx="5" fill="#30B26F"/>
    <rect x="170" y="348" width="172" height="10" rx="5" fill="#E07A1F"/>
  </g>
  <g filter="url(#glow)" opacity="0.95">
    <rect x="170" y="232" width="172" height="10" rx="5" fill="#0A84FF"/>
    <rect x="170" y="290" width="172" height="10" rx="5" fill="#30B26F"/>
    <rect x="170" y="348" width="172" height="10" rx="5" fill="#E07A1F"/>
  </g>
  <rect x="170" y="232" width="172" height="10" rx="5" fill="#0A84FF"/>
  <rect x="170" y="290" width="172" height="10" rx="5" fill="#30B26F"/>
  <rect x="170" y="348" width="172" height="10" rx="5" fill="#E07A1F"/>
  <rect x="178" y="234" width="156" height="2" rx="1" fill="#FFFFFF" opacity="0.7"/>
  <rect x="178" y="292" width="156" height="2" rx="1" fill="#FFFFFF" opacity="0.7"/>
  <rect x="178" y="350" width="156" height="2" rx="1" fill="#FFFFFF" opacity="0.7"/>

  <line x1="88" y1="432" x2="424" y2="432" stroke="#FFFFFF" stroke-width="1.5" opacity="0.3"/>
  <rect x="160" y="432" width="192" height="2" fill="#FFFFFF" opacity="0.08"/>
</svg>`;

/** Data-URI versie voor gebruik in <img src="..."/> binnen Satori/ImageResponse. */
export const APP_ICON_DATA_URI =
  "data:image/svg+xml;base64," +
  Buffer.from(APP_ICON_SVG).toString("base64");
