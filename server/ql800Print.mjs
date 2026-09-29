/**
 * Logique pure de l'agent d'impression Brother QL-800 (testable sans
 * imprimante : aucune E/S, aucun processus enfant ici — cf. printAgent.mjs).
 */

/** Longueur max du préfixe d'une data URL PNG (marge sur le standard). */
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

/**
 * Décode une data URL PNG (`data:image/png;base64,…`) en Buffer.
 * Retourne null si le format est invalide ou si l'image dépasse maxBytes.
 *
 * @param {unknown} payload
 * @param {number} maxBytes
 * @returns {Buffer | null}
 */
export function parsePngDataUrl(payload, maxBytes = 8_000_000) {
  if (typeof payload !== 'string' || !payload.startsWith(PNG_DATA_URL_PREFIX)) return null
  const b64 = payload.slice(PNG_DATA_URL_PREFIX.length)
  // Le base64 ajoute ~33 % : rejet rapide avant décodage
  if (b64.length > Math.ceil(maxBytes / 3) * 4) return null
  let buffer
  try {
    buffer = Buffer.from(b64, 'base64')
  } catch {
    return null
  }
  if (buffer.length === 0 || buffer.length > maxBytes) return null
  // Signature PNG : 8 octets fixes
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, 8).equals(PNG_MAGIC)) return null
  return buffer
}

/**
 * Construit la ligne de commande brother_ql, ex. :
 *   brother_ql -b file -p file:///dev/usb/lp0 -m QL-800 print -l 62 badge.png
 * La QL-800 coupe automatiquement en fin d'étiquette.
 *
 * @param {{ model?: string, printer?: string, label?: string, imagePath: string }} opts
 * @returns {string[]}
 */
export function buildBrotherQlArgs({
  model = 'QL-800',
  printer = 'file:///dev/usb/lp0',
  label = '62',
  imagePath,
}) {
  if (!imagePath) throw new Error('imagePath requis')
  if (String(imagePath).startsWith('-')) throw new Error('imagePath invalide')
  return ['-b', 'file', '-p', String(printer), '-m', String(model), 'print', '-l', String(label), String(imagePath)]
}

/**
 * Configuration de l'agent depuis l'environnement, avec valeurs par défaut.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function agentConfigFromEnv(env) {
  return {
    host: env.QL800_HOST || '127.0.0.1',
    port: Number(env.QL800_PORT ?? 9100),
    model: env.QL800_MODEL || 'QL-800',
    printer: env.QL800_PRINTER || 'file:///dev/usb/lp0',
    label: env.QL800_LABEL || '62',
  }
}
