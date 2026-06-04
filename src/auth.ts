/**
 * Vérifie un header Authorization de type "Bearer <token>" contre la valeur attendue.
 * Parsing sans regex (startsWith + slice). Les deux côtés sont trimés : on tolère les
 * espaces parasites (header ou secret env) sans jamais accepter un token différent.
 * Comparaison à temps constant SANS early-return sur la longueur (pas d'oracle de longueur).
 */
export function checkBearer(authHeader: string | undefined, expected: string): boolean {
  const exp = (expected ?? "").trim();
  if (!exp) return false;
  if (!authHeader) return false;

  // "bearer " et "Bearer " ont la même longueur (7) → slice à offset constant, scheme insensible à la casse.
  const PREFIX = "bearer ";
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith(PREFIX)) return false;
  const got = trimmed.slice(PREFIX.length).trim();

  const maxLen = Math.max(got.length, exp.length);
  let diff = got.length ^ exp.length; // non-nul si longueurs différentes
  for (let i = 0; i < maxLen; i++) {
    diff |= (got.charCodeAt(i) || 0) ^ (exp.charCodeAt(i) || 0);
  }
  return diff === 0;
}
