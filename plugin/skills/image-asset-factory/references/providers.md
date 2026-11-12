# Providers

| Provider | Kind | Needs | Notes |
|---|---|---|---|
| `local-procedural` | local | nothing | Recipes: horizon-field, contour-map, strata-bands, orbit-rings, bloom-mesh, pattern-tile, grid-instrument. Deterministic from seed. Vector and raster. Free. |
| `openai` | remote | `OPENAI_API_KEY` | Image generation over the OpenAI Images API. Raster only; output is cropped to the exact requirement. Cost estimates are indicative. Implemented and tested against a local mock of the API; not exercised against the live service in this release. |
| `mock` | test | `CIS_ALLOW_MOCK=1` | For tests and benchmarks. Output is marked simulated. |

Adding a provider: implement `{ id, kind, label, available(), capabilities, estimateCostUsd(job), generate(job, ctx) }` and call `registerProvider` (see docs/extending.md). `generate` returns either `{svg}` or `{buffer, format}` plus `model`, `costUsd`, `parameters`.

Recipes take `variant` (for horizon-field: dawn, noon, dusk, night), `layer`, `scheme` and `seed`.
