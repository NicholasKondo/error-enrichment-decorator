// Error Enrichment Decorator
//
// The core problem: when an error passes through several layers, the original
// error class is often the only thing preserved. Attaching metadata directly to
// the error object mutates it, which is observable by other handlers and can
// break `instanceof` checks or serialization. This module wraps the original
// error in a plain object that carries the original `name`, `message`, `stack`,
// and an `_enrichment` map. The wrapper survives `JSON.stringify` and can be
// rethrown without changing the original error's identity or prototype.

const ENRICHMENT_KEY = '_enrichment';

/**
 * Wrap an error to attach contextual key-value metadata.
 *
 * The original error is not mutated. The returned object is a plain object
 * (not an Error instance) so that it serializes deterministically. It keeps the
 * original `name`, `message`, and `stack` values, plus an `_enrichment` map.
 *
 * @param {Error} error - The error to enrich. Must be an Error instance.
 * @param {Record<string, unknown>} metadata - Context to attach.
 * @returns {object} A new enriched error representation.
 */
export function enrichError(error, metadata) {
  if (!(error instanceof Error)) {
    throw new TypeError('enrichError expects an Error instance');
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be a plain object');
  }

  const enrichment = Object.assign({}, getEnrichment(error), metadata);
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    [ENRICHMENT_KEY]: enrichment,
  };
}

/**
 * Read enrichment metadata from an enriched error.
 *
 * Returns the metadata map if present, otherwise an empty object. This makes
 * callers safe to spread or merge without null checks.
 *
 * @param {object} enriched - An object produced by `enrichError`.
 * @returns {Record<string, unknown>} The enrichment map, or an empty object.
 */
export function getEnrichment(enriched) {
  if (enriched && typeof enriched === 'object' && enriched[ENRICHMENT_KEY]) {
    return Object.assign({}, enriched[ENRICHMENT_KEY]);
  }
  return {};
}

/**
 * Serialize an enriched error to a JSON string.
 *
 * JSON.stringify already handles the plain object shape, but this function
 * exists so callers do not have to remember the exact key and so we can guard
 * against non-enriched inputs.
 *
 * @param {object} enriched - An object produced by `enrichError`.
 * @returns {string} JSON representation.
 */
export function serializeError(enriched) {
  if (!enriched || typeof enriched !== 'object') {
    throw new TypeError('serializeError expects an object');
  }
  return JSON.stringify(enriched);
}

/**
 * Deserialize a JSON string back into an enriched error representation.
 *
 * The result is a plain object, not an Error instance. That is deliberate:
 * reconstructing an Error would require guessing the constructor, and the
 * point of this library is to preserve context, not to recreate the original
 * class. Callers who need an Error can wrap the result themselves.
 *
 * @param {string} json - A string produced by `serializeError`.
 * @returns {object} The enriched error representation.
 */
export function deserializeError(json) {
  if (typeof json !== 'string') {
    throw new TypeError('deserializeError expects a string');
  }
  const parsed = JSON.parse(json);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('deserialized value must be an object');
  }
  if (!(ENRICHMENT_KEY in parsed)) {
    parsed[ENRICHMENT_KEY] = {};
  }
  return parsed;
}
