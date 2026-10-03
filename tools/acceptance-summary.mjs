#!/usr/bin/env node
// Renders acceptance-report.json as a Markdown table for the run page and the job log.
//   node tools/acceptance-summary.mjs acceptance-report.json
import { readFile } from 'node:fs/promises';

const cell = (value = '') => String(value).replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ⏎ ');

export function renderSummary(report) {
  const { pass = 0, fail = 0, rejected = 0 } = report.summary ?? {};
  const lines = [
    '# RTE: свидетельства повторной приёмки',
    '',
    `Commit \`${report.commit}\` · ${report.environment?.backend ?? ''} · ${report.generated_at ?? ''}`,
    '',
    `**${pass} pass · ${fail} fail · ${rejected} rejected.** Автоматические проверки не оценивают качество перевода; решение \`reviewer_decision\` принимает проверяющий.`,
    '',
    '| Случай | Режим | Итог | Вход | Выход | Непройденные проверки |',
    '|---|---|---|---|---|---|',
  ];
  for (const item of report.results ?? []) {
    const outputs = item.outputs ?? [];
    const text = item.rejected
      ? `отклонено: ${item.rejected}`
      : outputs.map((entry) => entry.output).join(' ‖ ') + (item.back_translation ? ` ↩ ${item.back_translation}` : '');
    const failed = outputs.flatMap((entry) => Object.entries(entry.checks ?? {}).filter(([, check]) => !check.ok).map(([name]) => name));
    lines.push(`| ${cell(item.case)} | ${cell(item.mode)} | ${cell(item.automated)} | ${cell(item.input)} | ${cell(text)} | ${cell([...new Set(failed)].join(', '))} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = JSON.parse(await readFile(process.argv[2] || 'acceptance-report.json', 'utf8'));
  process.stdout.write(renderSummary(report));
}
