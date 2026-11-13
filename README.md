# error-enrichment-decorator

Wraps a thrown error to attach contextual key-value metadata that survives
serialization and rethrow chains without mutating the original error class.

```js
import { enrichError, getEnrichment, serializeError, deserializeError } from './src/index.js';

const original = new Error('database timeout');
const enriched = enrichError(original, { requestId: 'req-1', userId: 42 });

// The original error is untouched.
console.log(original.requestId); // undefined

// Metadata travels with the enriched representation.
console.log(getEnrichment(enriched)); // { requestId: 'req-1', userId: 42 }

// It survives a JSON round-trip.
const restored = deserializeError(serializeError(enriched));
console.log(restored._enrichment.userId); // 42
```

## Why this exists

When an error crosses a boundary — a worker, a queue, a log sink — the useful
context is usually in local variables, not on the error. Mutating the error to
carry that context is tempting, but it changes an object that other handlers
may already be inspecting, and it does not survive `JSON.stringify` because
`Error` properties are not enumerable.

This library chooses a wrapper over mutation. `enrichError` returns a plain
object with the original `name`, `message`, and `stack`, plus an `_enrichment`
map. That shape serializes predictably and can be rethrown through code that
does not know about the decorator. The trade-off is that the enriched value is
not an `Error` instance, so `instanceof` checks must happen before enrichment,
not after.

## Edge case to know about

`deserializeError` returns a plain object, never an `Error`. Reconstructing the
original class would require guessing its constructor, which is exactly the
kind of fragile magic this library avoids. If you need an `Error` after
deserialization, wrap the result yourself. Metadata is shallow-merged: nested
objects are shared by reference, so serialize before mutating shared state if
that matters to you.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

