// Where the nine grahas are right now, in the sidereal zodiac (Lahiri ayanamsa).
// Geocentric ecliptic longitudes from Paul Schlyter's "How to compute planetary positions"
// (mean orbital elements + the main Moon, Jupiter and Saturn perturbations). Good to well
// under a degree, which is all a sign placement needs. Pure functions, no DOM.

const RAD = Math.PI / 180;
const norm = (x) => ((x % 360) + 360) % 360;
const sin = (x) => Math.sin(x * RAD), cos = (x) => Math.cos(x * RAD);

// Days since 2000 Jan 0.0 UT, the epoch the elements below are written for.
export const dayNumber = (date) => date.getTime() / 864e5 + 2440587.5 - 2451543.5;

const ELEMENTS = {
  sun: (d) => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.047 + 0.9856002585 * d }),
  moon: (d) => ({ N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d }),
  mercury: (d) => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  venus: (d) => ({ N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  mars: (d) => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  jupiter: (d) => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d }),
  saturn: (d) => ({ N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d }),
};

// Position in the orbit's own ecliptic frame: rectangular x, y, z (same units as a).
function orbit({ N, i, w, a, e, M }) {
  M = norm(M);
  let E = M + (e / RAD) * sin(M) * (1 + e * cos(M));
  for (let k = 0; k < 8; k++) E -= (E - (e / RAD) * sin(E) - M) / (1 - e * cos(E));
  const xv = a * (cos(E) - e), yv = a * Math.sqrt(1 - e * e) * sin(E);
  const v = Math.atan2(yv, xv) / RAD, r = Math.hypot(xv, yv);
  const vw = v + w;
  return [
    r * (cos(N) * cos(vw) - sin(N) * sin(vw) * cos(i)),
    r * (sin(N) * cos(vw) + cos(N) * sin(vw) * cos(i)),
    r * sin(vw) * sin(i),
  ];
}

// Tropical geocentric ecliptic longitude (degrees, equinox of date) of one body.
export function tropical(body, d) {
  if (body === 'rahu') return norm(ELEMENTS.moon(d).N);
  if (body === 'ketu') return norm(ELEMENTS.moon(d).N + 180);
  const sun = ELEMENTS.sun(d);
  const [sx, sy] = orbit(sun);
  if (body === 'sun') return norm(Math.atan2(sy, sx) / RAD);

  if (body === 'moon') {
    const m = ELEMENTS.moon(d);
    const [x, y] = orbit(m);
    const Ls = norm(sun.M + sun.w), Lm = norm(m.N + m.w + m.M);
    const Ms = sun.M, Mm = m.M, D = Lm - Ls, F = Lm - m.N;
    return norm(Math.atan2(y, x) / RAD
      - 1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms)
      - 0.059 * sin(2 * Mm - 2 * D) - 0.057 * sin(Mm - 2 * D + Ms) + 0.053 * sin(Mm + 2 * D)
      + 0.046 * sin(2 * D - Ms) + 0.041 * sin(Mm - Ms) - 0.035 * sin(D)
      - 0.031 * sin(Mm + Ms) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D));
  }

  const el = ELEMENTS[body](d);
  let [x, y, z] = orbit(el);
  // Jupiter and Saturn pull on each other enough to matter; fold that in before going geocentric.
  if (body === 'jupiter' || body === 'saturn') {
    const Mj = ELEMENTS.jupiter(d).M, Ms = ELEMENTS.saturn(d).M;
    const lon = Math.atan2(y, x) / RAD, r = Math.hypot(x, y, z), lat = Math.asin(z / r) / RAD;
    const dl = body === 'jupiter'
      ? -0.332 * sin(2 * Mj - 5 * Ms - 67.6) - 0.056 * sin(2 * Mj - 2 * Ms + 21) + 0.042 * sin(3 * Mj - 5 * Ms + 21)
        - 0.036 * sin(Mj - 2 * Ms) + 0.022 * cos(Mj - Ms) + 0.023 * sin(2 * Mj - 3 * Ms + 52) - 0.016 * sin(Mj - 5 * Ms - 69)
      : 0.812 * sin(2 * Mj - 5 * Ms - 67.6) - 0.229 * cos(2 * Mj - 4 * Ms - 2) + 0.119 * sin(Mj - 2 * Ms - 3)
        + 0.046 * sin(2 * Mj - 6 * Ms - 69) + 0.014 * sin(Mj - 3 * Ms + 32);
    x = r * cos(lat) * cos(lon + dl); y = r * cos(lat) * sin(lon + dl);
  }
  return norm(Math.atan2(y + sy, x + sx) / RAD);
}

// Lahiri (Chitrapaksha) ayanamsa: 23°51'11" at J2000, drifting with precession.
export const ayanamsa = (d) => 23.85306 + (50.2884 / 3600) * (d - 1.5) / 365.25;

export const SIGNS = [
  ['Mesha', 'Aries', '♈'], ['Vrishabha', 'Taurus', '♉'], ['Mithuna', 'Gemini', '♊'], ['Karka', 'Cancer', '♋'],
  ['Simha', 'Leo', '♌'], ['Kanya', 'Virgo', '♍'], ['Tula', 'Libra', '♎'], ['Vrishchika', 'Scorpio', '♏'],
  ['Dhanu', 'Sagittarius', '♐'], ['Makara', 'Capricorn', '♑'], ['Kumbha', 'Aquarius', '♒'], ['Meena', 'Pisces', '♓'],
].map(([sa, en, glyph]) => ({ sa, en, glyph: `${glyph}︎` }));

export const GRAHAS = [
  { id: 'sun', sa: 'Surya', en: 'Sun' },
  { id: 'moon', sa: 'Chandra', en: 'Moon' },
  { id: 'mars', sa: 'Mangal', en: 'Mars' },
  { id: 'mercury', sa: 'Budh', en: 'Mercury' },
  { id: 'jupiter', sa: 'Guru', en: 'Jupiter' },
  { id: 'venus', sa: 'Shukra', en: 'Venus' },
  { id: 'saturn', sa: 'Shani', en: 'Saturn' },
  { id: 'rahu', sa: 'Rahu', en: 'North node' },
  { id: 'ketu', sa: 'Ketu', en: 'South node' },
];

// Every graha for a moment: sidereal longitude, sign, degree in sign, retrograde.
export function gochar(date = new Date()) {
  const d = dayNumber(date), ay = ayanamsa(d);
  return GRAHAS.map((g) => {
    const lon = norm(tropical(g.id, d) - ay);
    // Nodes always move backwards; for the rest compare with a few hours later.
    const step = norm(tropical(g.id, d + 0.25) - tropical(g.id, d));
    const retro = g.id === 'rahu' || g.id === 'ketu' || (g.id !== 'sun' && g.id !== 'moon' && step > 180);
    const sign = Math.floor(lon / 30);
    return { ...g, lon, sign, signInfo: SIGNS[sign], deg: lon - sign * 30, retro };
  });
}

// Moon phase from the Sun-Moon elongation: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
export function moonPhase(date = new Date()) {
  const d = dayNumber(date);
  const phase = norm(tropical('moon', d) - tropical('sun', d)) / 360;
  return { phase, lit: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}
