# Публикация RTE v2 через GitHub Web

Рабочая версия v1 в `main` не должна изменяться до приёмки RTE v2.

1. Откройте репозиторий `Lacinnik/reason-`.
2. Закройте старый PR #1 как `superseded`; не сливайте его.
3. Создайте ветку `feature/rte-v2` от `main`.
4. В новой ветке удалите временный файл `.github/workflows/assemble-rte-v02-runner.yml`.
5. Загрузите всё содержимое архива RTE v2, включая `.github`, `tests` и `vendor`.
6. Сообщение коммита: `RTE v2 clean release candidate`.
7. Создайте Draft PR: `feature/rte-v2` → `main`.
8. Дождитесь зелёной проверки **Verify RTE v2**.
9. Выполните матрицу из `TESTING.md` на компьютере и iPhone.
10. Только после онлайн- и офлайн-проверки обеих направлений переводите PR в Ready и сливайте.

После merge workflow `Deploy RTE to GitHub Pages` сначала повторно выполняет `npm run check`, а затем публикует статический пакет.
