// Reine Mathe-Helfer (DOM-frei).

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const sum = (values) => values.reduce((acc, v) => acc + v, 0);

/**
 * Distanz zweier Punkte in Polarkoordinaten (Abstand zum Stern in AU, Winkel in Grad).
 * @param {{au:number, angleDeg:number}} a
 * @param {{au:number, angleDeg:number}} b
 * @returns {number} Distanz in AU
 */
export function polarDistance(a, b) {
  const dTheta = ((a.angleDeg - b.angleDeg) * Math.PI) / 180;
  const d2 = a.au * a.au + b.au * b.au - 2 * a.au * b.au * Math.cos(dTheta);
  return Math.sqrt(Math.max(0, d2));
}
