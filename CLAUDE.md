# reason- · лаборатория РЕЗОН

Статический сайт без сборки: переводчик RTE (`index.html`, `app.js`, `engine-core.js`, `storage.js`), `field-check/`, `transmissions/`, `axis-game/`. Node.js 20+.

## Перед отправкой

```bash
npm run check   # синтаксис + все тесты
```

## Ловушки

- **`SHA256SUMS.txt`**: после правки любого перечисленного в нём файла (README.md, package.json, ACCEPTANCE_STATUS.md, app.js…) обновить его строку, иначе падает тест `release checksum manifest`. Формат: хеш, два пробела, путь.
- **Версия** `2.0.0` должна совпадать в `package.json`, `package-lock.json`, `engine-core.js` (`APP_VERSION`), `sw.js` (`VERSION`), а строка `RTE v2.0.0` — в `index.html`, `README.md`, `TESTING.md`.
- **Service Worker**: после изменения файлов сайта поднять `CACHE_REVISION` в `sw.js`; новый локальный модуль добавить в его `SHELL`, иначе падают офлайн-тесты.
- **Transformers.js** закреплён на 3.7.2 (`vendor/transformers-3.7.2.js`); не обновлять без отдельной приёмки.
- **`tzar-language-001.mjs`, `local-journal.mjs`, `tzar-language.profiles.json`** копируются в `Game-GDEYA` по хешу. После их изменения там нужно выполнить `npm run vendor:update`.

## Приёмка переводчика

Статус RTE — `not-accepted` (см. `ACCEPTANCE_STATUS.md`). Свидетельства собирает ручной workflow «RTE acceptance evidence (CPU)» (`tools/acceptance-cpu.mjs`); решение `reviewer_decision` принимает человек, офлайн-перезапуск на устройстве проверяется вручную. Из облачной среды Hugging Face обычно недоступен — реальный прогон только в Actions.

## Экосистема

Четыре репозитория одного автора (Lacinnik): `architectonica-az-buki` (корпус и исходные ядра), `-tensor-architectonics` (научный канон ТзАр), `reason-` (лаборатория РЕЗОН), `Game-GDEYA` (игра и Platform 2.0 — единая точка входа). Все сайты — статические GitHub Pages, всё работает локально в браузере.

## Правила содержания

- Статусы (`canonical`, `stable`, `candidate`, `not-accepted`…) присваивает только автор. Не повышать статус по итогам CI или собственной проверки; в `ecosystem.status.json` у каждого статуса поле `source` указывает документ автора, а неуказанный статус — `unstated`.
- `Q` остаётся `null`, пока отклик не наблюдён; игровой балл — `Qsim`. Не выдавать симуляцию за наблюдение или диагностику.
- TZAR-LANGUAGE-001 — детерминированный символический компилятор, не обученная нейросеть. Не писать иного.
- Термины корпуса брать из канонических документов (`-tensor-architectonics/GLOSSARY.md`), не пересказывать своими определениями.
- Тексты и интерфейс — на русском; английский — только `README.en.md`.
- Ссылки в Markdown проверяет workflow `links.yml` (lychee): в PR — внутренние, еженедельно — внешние.
