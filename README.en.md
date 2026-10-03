# REZON Lab · Resonant Translation Engine

*English summary. The full, authoritative documentation is in Russian: [README.md](README.md).*

Browser-only tools from the REZON laboratory of the Architectonics ecosystem. Everything runs locally in the browser; no text is sent to a project server ([PRIVACY.md](PRIVACY.md)).

| Product | Status | Open |
|---|---|---|
| Resonant Translation Engine 2.0.0 — offline EN ↔ RU translator | **acceptance not passed** (sentence loss found on 2026-09-20, repair candidate under review) | https://lacinnik.github.io/reason-/ |
| Collective Field Check 1.0 — local check of declared links and a conductance threshold, with a JSON decision record | stable | https://lacinnik.github.io/reason-/field-check/ |
| 7 Transmissions 1.0 — a deck of seven transition modes with a local session passport | stable | https://lacinnik.github.io/reason-/transmissions/ |
| AXIS · TzArch — a browser game about keeping an axis under gradient pressure | stable | https://lacinnik.github.io/reason-/axis-game/ |

Machine-readable statuses: [`ecosystem.status.json`](ecosystem.status.json). Acceptance details: [ACCEPTANCE_STATUS.md](ACCEPTANCE_STATUS.md), [NEURAL_CHECK_20260920.md](NEURAL_CHECK_20260920.md).

## How the translator works

`text → segmentation → memory → glossary → candidates → back-translation check → form`

- Runs `Xenova/opus-mt-en-ru` and `Xenova/opus-mt-ru-en` through Transformers.js 3.7.2 (WebGPU when available, otherwise WASM q8).
- After the first model download it works offline, as long as the browser keeps its cache.
- Translation memory and glossary live in IndexedDB and can be exported as one JSON bundle.
- Numbers, versions, URLs, e-mails, abbreviations and approved terms are protected before the model runs and restored afterwards.
- Metrics (α, Q-hat, Cₘ, T) are a local engineering estimate, not an external quality certification. `Q` stays `null` until something is actually observed.

TZAR-LANGUAGE-001, used for product wording, is a deterministic symbolic compiler written by the author — not a trained neural language model.

## Development

Requires Node.js 20+. The site is static; there is no build step.

```bash
npm test        # unit, static and offline tests
npm run check   # syntax check + tests
```

## Ecosystem

The single entry point to all products is [Platform 2.0](https://lacinnik.github.io/Game-GDEYA/platform/). Related repositories: [architectonica-az-buki](https://github.com/Lacinnik/architectonica-az-buki) (source corpus and cores), [-tensor-architectonics](https://github.com/Lacinnik/-tensor-architectonics) (TzAr scientific canon), [Game-GDEYA](https://github.com/Lacinnik/Game-GDEYA) (game and platform).

## License

[MIT](LICENSE).
