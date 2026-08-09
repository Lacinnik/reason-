export const TAGS = {
  ground: "основание",
  protect: "сохранение",
  expand: "расширение",
  act: "действие",
  connect: "связь",
  integrate: "интеграция",
  reflect: "различение",
  create: "творение",
};

const AZ_NAMES = ["Азъ","Буки","Веди","Глаголь","Добро","Есть","Живѣтє","Зело","Земля","Иже","И","Како","Люди","Мыслете","Наш","Он","Покой","Рцы","Слово","Твердо","Ук","Ферт","Хер","Ци","Червь","Ша","Ща","Твёрдый знак","Ы","Мягкий знак","Э","Ю","Я","⊕","∴","∞","Резон","Явь","Поле","Точка","Архе","Тень","Врата","Лик","Суть","Глас","Дыхание","Вибрация","Свет"];
const AZ_TAGS = ["ground","ground","reflect","create","integrate","ground","connect","act","ground","connect","connect","reflect","connect","reflect","integrate","reflect","ground","create","connect","protect","act","expand","reflect","act","integrate","expand","reflect","protect","integrate","connect","reflect","act","ground","integrate","act","expand","connect","ground","expand","act","ground","integrate","connect","reflect","integrate","create","connect","act","integrate"];

export const AZ = AZ_NAMES.map((title, index) => ({
  id: "A" + (index + 1),
  number: index + 1,
  title,
  tag: AZ_TAGS[index],
  description: "Внутренняя частота: " + TAGS[AZ_TAGS[index]] + ".",
}));

const BUKI_RAW = [
  ["⊕","Суперпозиция","integrate"],["∅","Пустота","create"],["τ","Пластичность времени","expand"],["Ψ","Волновая форма","connect"],
  ["C⊕","⊕‑Капитал","ground"],["Σ","Сумма резонансов","connect"],["φ","Фаза пробуждения","reflect"],["Rᶠ","Резонанс с будущим","create"],
  ["∇","Градиент","act"],["IЯ","Интеграция ядра","integrate"],["⊗","Точка кристаллизации","ground"],["Fₛ","Поток смысла","connect"],
  ["λ","Длина волны","expand"],["A","Амплитуда переживания","act"],["∆S","Изменение смысла","create"],["Q","Качество отклика","reflect"],
  ["T","Текучесть","expand"],["Sᶠ","Структурная форма","protect"],["Cₘ","Контейнер смыслов","protect"],["E⊕","Энтропическая энергия","act"],
  ["α","Соответствие","reflect"],["k","Плотность восприятия","ground"],["ω","Частота обновления","act"],["⊕Σ","Суперпозиция систем","integrate"],
];
export const BUKI = BUKI_RAW.map(([symbol, title, tag], index) => ({
  id: "B" + (index + 1),
  number: index + 1,
  symbol,
  title,
  tag,
  description: "Внешняя форма: " + TAGS[tag] + ".",
}));

export const TRANSMISSIONS = [
  { id:"TX1", number:1, symbol:"⊙", title:"Ядро", tag:"ground", description:"Вернуть действие к основанию.", action:"Назовите одно основание, которое следующий ход обязан сохранить." },
  { id:"TX2", number:2, symbol:"◌", title:"Орбита", tag:"expand", description:"Создать движение вокруг ядра.", action:"Совершите малый оборот вокруг задачи, не пытаясь закрыть её целиком." },
  { id:"TX3", number:3, symbol:"≈", title:"Резонанс", tag:"connect", description:"Настроить взаимный отклик.", action:"Предъявите формулу другому голосу и зафиксируйте его явный отклик." },
  { id:"TX4", number:4, symbol:"⌒", title:"Мост", tag:"connect", description:"Провести связь между мирами.", action:"Назовите две стороны разрыва и одно действие, которое касается обеих." },
  { id:"TX5", number:5, symbol:"◆", title:"Материализация", tag:"act", description:"Закрепить волну в форме.", action:"Создайте один наблюдаемый артефакт, который можно предъявить сегодня." },
  { id:"TX6", number:6, symbol:"⊕", title:"Интеграция", tag:"integrate", description:"Встроить опыт в целое.", action:"Укажите, куда входит результат и какое правило системы он меняет." },
  { id:"TX7", number:7, symbol:"↻", title:"Перезапуск", tag:"create", description:"Отпустить форму, сохранив ядро.", action:"Отделите сохраняемое ядро от формы, которую пора отпустить." },
];
