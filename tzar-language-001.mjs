import { AZ, BUKI, TRANSMISSIONS } from "./module/catalog.mjs";

export const MODEL_ID = "TZAR-LANGUAGE-001";
export const MODEL_VERSION = "0.2.0-candidate";
export const CORPUS = "Азбука Сингулярности:49 / Буки Перехода:24 / Передачи:7";
export const PRODUCT_PROFILE_SCHEMA = "tzar.language-product-profile/1.0.0";

const AZ_SEMANTICS = [
  "Присутствие × Пустота = Я. Центр и начало сборки формы.",
  "Масса внимания. Бытийность. Основание реальности.",
  "Видение и вектор внимания. Мост восприятия и смысла.",
  "Проявление. Речь как форма творения. Смысл × Воля.",
  "Выбор + Целостность = Созидание. Этический вектор.",
  "Наблюдение = Материализация. Удержание проявленного.",
  "Жизнь-циркуляция. Связь и протекание энергии.",
  "Интенсивность ⊕. Концентрация энергии.",
  "Материальность. Заземление. Приём массы.",
  "Коммуникация. Архитектура взаимодействий.",
  "Вход. Принятие. Пустота + Доверие = Приём.",
  "Качество. Структура. Уточнение формы.",
  "Встреча Я ↔ Ты. Создание межполевого пространства.",
  "Мышление. Сбор и навигация смыслов.",
  "Принадлежность. Интеграция в систему.",
  "Перспектива. Различение. Другой как отражение.",
  "Центрирование. Я = 0. Сброс лишнего.",
  "Манифестация. Прямая вибрация смысла.",
  "Мост: внутреннее → наружное. Связь миров.",
  "Фиксация. Образ + Воля = Форма.",
  "Удержание. Сфокусированное движение. Намерение.",
  "Светоносность. Излучение присутствия.",
  "Перекрёсток. Навигация. Выбор в многовариантности.",
  "Энергетический ток. Направление жизни.",
  "Глубинный импульс. Трансформация бессознательного.",
  "Широта. Расширение. Распаковка масштаба.",
  "Точечная глубина. Многогранность восприятия.",
  "Порог. Пауза. Структурная граница.",
  "Внутренний ток. Тело говорит «я чувствую».",
  "Мягкое касание. Ласка формы.",
  "Эхо. Узнавание себя в другом.",
  "Проникающее Я. Сжатие и вхождение.",
  "Совокупное Я. Резонансный источник.",
  "Суперпозиция. Смыслы в одной точке.",
  "Следствие. Неизбежное проявление.",
  "Волна. Дыхание вне формы.",
  "Ответ поля. Диалог реальности.",
  "Проявленность. Масса × Внимание.",
  "Невидимая матрица возможностей.",
  "Порог ⊕. Ноль + Воля = Запуск.",
  "Исток. Довременное основание.",
  "Скрытое притяжение. Алхимическая материя.",
  "Переход. Завершение + Готовность.",
  "Персонифицированный смысл. Образ Я.",
  "Ядровое качество. Снятие лишнего.",
  "Голос источника. Я + Истина.",
  "Вдох + Выдох = Ритм жизни.",
  "Частота присутствия. Движение = Влияние.",
  "Ясность. Знание × Любовь.",
];

const BUKI_SEMANTICS = [
  "Совпадение психики, поля и формы в одной точке.",
  "Совершенная потенциальность. Основание любой трансформации.",
  "Изгиб, сжатие и развёртывание хроноса.",
  "Состояние как волна с амплитудой, частотой и фазой.",
  "Прожитые ⊕-состояния, структурированные в ценность.",
  "Кумулятивный отклик поля на ⊕-действие.",
  "Момент переключения восприятия.",
  "Навигационный тон ⊕-предчувствия.",
  "Направление и скорость изменения ⊕-состояния.",
  "Собранность и устойчивость Я в переходе.",
  "Переход волны в структуру, рождение формы.",
  "Развёртывание смыслов через Я и поле.",
  "Радиус сохранения и распространения ⊕-состояния.",
  "Интенсивность проживания и сила импульса.",
  "Переход к новой смысловой структуре.",
  "Способность системы преобразовать импульс в ответ.",
  "Движение энергии сквозь контексты без разрушения.",
  "Геометрия контейнера, удерживающего энергию.",
  "Объём, в котором смысл удерживается и переваривается.",
  "Превращение хаоса в ⊕-устойчивость.",
  "Соответствие внутреннего Я и среды.",
  "Сжатие восприятия и острота перехода.",
  "Скорость безопасной перезаписи ⊕-состояния.",
  "Наложение полей, рождающее новую систему.",
];

const EXTRA_SIGNALS = Object.freeze({
  A3: "видеть увидеть внимание вектор направление",
  A5: "честность этика ответственность целостность созидание",
  A10: "согласовать договориться коммуникация взаимодействие",
  A12: "уточнить выполнимый приоритет качество структура критерий",
  A13: "другой партнёр команда встреча совместно",
  A19: "сказать спросить назвать сообщить формулировка",
  A20: "зафиксировать договор срок обязательство форма",
  A21: "удержать намерение фокус следующий ход",
  A23: "выбор варианты ветви приоритет",
  A37: "отклик ответ обратная связь поле",
  A45: "ядро суть основание главное лишнее",
  B3: "срок время сегодня завтра ритм окно",
  B6: "отклик обратная связь возвращается сигнал",
  B9: "направление движение следующий ход",
  B10: "ядро устойчивость сохранить основание",
  B11: "готово сделать создать оформить результат",
  B12: "смысл речь вопрос формулировка сообщить",
  B15: "переосмыслить изменить смысл различить",
  B17: "гибкость обойти сопротивление текучесть",
  B18: "структура план порядок приоритет контейнер",
  B21: "соответствие согласовать честность среда",
  B24: "вместе система команда совместный",
  TX1: "остановиться сохранить основание ядро присутствие",
  TX2: "расширить распространить сообщение звонок пост касание",
  TX3: "наблюдать отклик ответ проверить спросить обратная связь",
  TX4: "согласовать договориться соединить мост стороны разговор",
  TX5: "сделать создать выпустить предъявить завершить артефакт",
  TX6: "встроить интегрировать закрепить обновить система правило",
  TX7: "перезапустить отпустить заново завершить форму ретроспектива",
});

const STOP = new Set("когда чтобы который которая которые этого этой через между после перед как мне моё мой моя свои себя сейчас одно один при без для или что чем над под уже ещё где быть был была были из от до по на во и а но с со у к ко о об не ни ли же".split(" "));
const clean = (value, fallback = "") => String(value ?? "").replace(/\s+/gu, " ").trim().replace(/[.!?…]+$/u, "") || fallback;
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/gu, "е").replace(/\s+/gu, " ").trim();
const tokens = (value) => (normalize(value).match(/[\p{L}\p{N}]+/gu) || []).filter((token) => token.length >= 4 && !STOP.has(token));
const stem = (value) => value.slice(0, Math.min(6, value.length));

export const LANGUAGE_AZ = Object.freeze(AZ.map((entry, index) => ({ ...entry, semanticDescription: AZ_SEMANTICS[index] })));
export const LANGUAGE_BUKI = Object.freeze(BUKI.map((entry, index) => ({ ...entry, semanticDescription: BUKI_SEMANTICS[index] })));
export const LANGUAGE_TRANSMISSIONS = Object.freeze(TRANSMISSIONS.map((entry) => ({ ...entry, semanticDescription: `${entry.description} ${entry.action}` })));

function rank(corpus, weightedTexts, fallbackId, options = {}) {
  const input = weightedTexts.flatMap(([value, weight]) => tokens(value).map((token) => [stem(token), weight]));
  const ranked = corpus.map((entry) => {
    const description = options.explicitOnly ? "" : entry.semanticDescription;
    const source = tokens(`${entry.title} ${description} ${EXTRA_SIGNALS[entry.id] || ""}`).map(stem);
    const matches = [];
    let score = Number(options.bias?.[entry.id] || 0);
    for (const [needle, weight] of input) {
      if (source.includes(needle)) { score += weight; matches.push(needle); }
    }
    return { entry, score, matches: [...new Set(matches)] };
  }).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id, "ru", { numeric: true }));
  if (!ranked[0]?.score) {
    const fallback = ranked.find((result) => result.entry.id === fallbackId);
    fallback.matches = ["fallback:author-review"];
    return [fallback, ...ranked.filter((result) => result !== fallback)];
  }
  return ranked;
}

function sentence(value) {
  const text = clean(value);
  return text ? text[0].toLocaleUpperCase("ru") + text.slice(1) + "." : "";
}

function publicStatementForVoice(voice, { object, image, need, invariant, move, feedback }) {
  if (voice === "collective") {
    return `Мы различаем общий объект — «${object}» — и собранный образ поля — «${image}». Наш предъявленный субъектный след — ${need}. Мы сохраняем основание «${invariant}» и проводим проверяемый коллективный ход: ${move}. Q останется пустым до наблюдаемого возврата: ${feedback}.`;
  }
  if (voice === "system") {
    return `Контур различает объект «${object}» и его модельное отражение «${image}». Наблюдаемый след исполнения — ${need}. Целевое основание «${invariant}» проверяется ходом: ${move}. Q не выводится из внутренней оценки и появится только после наблюдаемого возврата: ${feedback}.`;
  }
  if (voice === "artifact") {
    return `Авторская сборка различает материал «${object}» и символическую форму «${image}». Предъявленный след выбора — ${need}. Основание «${invariant}» проводится через форму: ${move}. Формула остаётся кандидатом до подтверждения субъекта, а Q — пустым до наблюдаемого возврата.`;
  }
  return `Я различаю наблюдаемое — «${object}» — и его отражение — «${image}». Моё действительное движение сейчас — ${need}. Я сохраняю основание «${invariant}» и совершаю проверяемый ход: ${move}. Ответом станет не обещание, а наблюдаемый отклик: ${feedback}.`;
}

function observedQOf(value) {
  if (value == null) return null;
  if (value !== 0 && value !== 1) throw new Error("TZAR_LANGUAGE_Q_MUST_BE_OBSERVED_BINARY");
  return value;
}

export function compileTzarLanguage(state, options = {}) {
  const azRank = rank(LANGUAGE_AZ, options.azTexts || [
    [state.coreNeed, 5], [state.supra, 4], [state.projective, 2], [state.position, 1], [state.innerLevel, 1],
  ], "A45", { bias: options.azBias });
  const bukaRank = rank(LANGUAGE_BUKI, options.bukaTexts || [
    [state.coreNeed, 5], [state.euclid, 4], [state.nextExperiment, 2], [state.riemann, 2], [state.outerDomain, 1],
  ], "B12", { bias: options.bukaBias });
  const txRank = rank(LANGUAGE_TRANSMISSIONS, options.txTexts || [
    [state.nextExperiment, 6], [state.coreNeed, 3], [state.riemann, 2], [state.lobachevsky, 1],
  ], "TX1", { explicitOnly: true, bias: options.txBias });
  const az = azRank[0].entry;
  const buka = bukaRank[0].entry;
  const transmission = txRank[0].entry;
  const object = clean(state.object) || null;
  const image = clean(state.innerImage) || null;
  const need = clean(state.coreNeed, "различить следующий живой ход");
  const invariant = clean(state.supra, "авторское основание");
  const move = clean(state.nextExperiment, transmission.action);
  const feedback = clean(state.riemann, "наблюдаемый ответ поля");
  const observedQ = observedQOf(state.observedQ);
  const subjectTrace = clean(state.subjectTrace) || null;
  const targetRelation = clean(options.targetRelation) || null;
  const context = clean(options.context) || null;
  const coordinates = { O: object, S: subjectTrace, I: image, R_g: targetRelation, C: context };
  const missing = Object.keys(coordinates).filter(key => coordinates[key] === null);
  const voice = options.voice || "subject";
  const subjectConfirmed = Boolean(options.subjectConfirmed);
  return {
    modelId: MODEL_ID,
    modelVersion: MODEL_VERSION,
    status: !object ? "HOLD-INPUT" : missing.length ? "HOLD-DATA" : observedQ == null ? "candidate-authorial-symbolic-compiler" : "observed-return-integrated",
    profile: options.profile || "default",
    profileSchema: PRODUCT_PROFILE_SCHEMA,
    corpus: CORPUS,
    formula: `${az.title} × ${buka.symbol} ${buka.title} → ${transmission.symbol} ${transmission.title}`,
    selection: { az, buka, transmission },
    layers: {
      distinction: `O: ${object === null ? "не предъявлен" : sentence(object)} I: ${image === null ? "не предъявлен" : sentence(image)}`,
      trueRequest: `Как мне ${need}, различая факт «${object}» и его отражение «${image}», сохраняя «${invariant}», и проверить выбранный ход через «${move}»?`,
      publicStatement: missing.length ? `Недостаточно данных: ${missing.join(", ")}. Символическая связка остаётся предложением; отсутствующие сведения сохранены как null.` : publicStatementForVoice(voice, { object, image, need: subjectTrace, invariant, move, feedback }),
      nextMove: sentence(move),
      feedbackCriterion: sentence(feedback),
    },
    ranking: {
      az: azRank.slice(0, 3).map(({ entry, score, matches }) => ({ id: entry.id, title: entry.title, score, matches })),
      buka: bukaRank.slice(0, 3).map(({ entry, score, matches }) => ({ id: entry.id, title: entry.title, score, matches })),
      transmission: txRank.slice(0, 3).map(({ entry, score, matches }) => ({ id: entry.id, title: entry.title, score, matches })),
    },
    tensor: {
      O: object,
      S: subjectTrace,
      I: image,
      R_g: targetRelation,
      C: context,
      Q: observedQ,
      evidence: {
        O: object === null ? "unknown" : "user-declared",
        S: subjectTrace === null ? "unknown" : "user-declared",
        I: image === null ? "unknown" : "user-declared",
        R_g: targetRelation === null ? "unknown" : "product-profile-contract",
        C: context === null ? "unknown" : "product-profile-contract",
        Q: observedQ == null ? "unknown" : "observed",
      },
    },
    boundary: {
      selection: "deterministic-corpus-ranking-requires-subject-confirmation",
      subjectConfirmed,
      missingCoordinates: missing,
      diagnosis: "not-performed",
      prediction: "not-performed",
      observedQ,
      display: "human-language-and-symbolic-passport-separated",
    },
  };
}

export function compileProductLanguage(profile, coordinates = {}, options = {}) {
  if (!profile?.id || !profile.object_input || !profile.target_relation) throw new Error("TZAR_LANGUAGE_PROFILE_INVALID");
  const object = clean(coordinates.O ?? coordinates.object);
  if (!object) {
    return {
      modelId: MODEL_ID,
      modelVersion: MODEL_VERSION,
      profile: profile.id,
      profileSchema: PRODUCT_PROFILE_SCHEMA,
      status: "HOLD-INPUT",
      tensor: { O: null, S: null, I: null, R_g: profile.target_relation, C: profile.context, Q: null },
      boundary: { reason: "OBJECT_REQUIRED", subjectConfirmed: false, observedQ: null },
    };
  }
  return compileTzarLanguage({
    object,
    subjectTrace: coordinates.S ?? coordinates.subjectTrace,
    innerImage: coordinates.I ?? coordinates.innerImage,
    coreNeed: coordinates.S ?? coordinates.subjectTrace,
    supra: coordinates.invariant ?? profile.target_relation,
    nextExperiment: coordinates.nextMove ?? coordinates.S ?? coordinates.subjectTrace,
    riemann: coordinates.feedbackCriterion ?? "фактический наблюдаемый возврат",
    observedQ: coordinates.Q ?? coordinates.observedQ,
    euclid: coordinates.euclid ?? profile.context,
    outerDomain: profile.context,
  }, {
    ...options,
    profile: profile.id,
    voice: profile.voice,
    targetRelation: profile.target_relation,
    context: profile.context,
    subjectConfirmed: coordinates.subjectConfirmed,
  });
}
