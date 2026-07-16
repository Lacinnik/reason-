const parts = ['./app.part-00.txt', './app.part-01.txt', './app.part-02.txt', './app.part-03.txt', './app.part-04.txt', './app.part-05.txt', './app.part-06.txt', './app.part-07.txt', './app.part-08.txt', './app.part-09.txt'];
const source = (await Promise.all(parts.map(async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Не загружен модуль ${path}: ${response.status}`);
  return response.text();
}))).join('');
const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try { await import(url); } finally { URL.revokeObjectURL(url); }
