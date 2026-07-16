# Публикация RTE v2 в ветку `feature/rte-v2`

Целевая ветка — `feature/rte-v2`. Она создаётся автоматически скриптом `tools/publish-rte-v2.ps1` от актуальной `main`.

## Автоматически на Windows

Распакуйте архив и дважды нажмите `PUBLISH_RTE_V2.cmd`. Скрипт проверит Git/GitHub CLI, откроет авторизацию GitHub, создаст чистую ветку от `main`, закроет старый PR #1, загрузит RTE v2 и создаст новый Draft PR.

## Через веб-интерфейс GitHub

1. Откройте репозиторий `Lacinnik/reason-`.
2. Создайте ветку `feature/rte-v2` от `main` и переключитесь на неё.
3. Нажмите **Add file → Upload files**.
4. Перетащите содержимое этого архива, сохраняя каталоги `.github/workflows`, `tests` и `vendor`.
5. Commit message: `RTE v2 production candidate`.
6. Откройте Pull Request из `feature/rte-v2` в `main`.
7. Не сливайте PR, пока проверка **Verify RTE v2** не станет зелёной.

## Локальная проверка

```bash
npm run check
python3 -m http.server 4173
```

После запуска откройте `http://localhost:4173`.
