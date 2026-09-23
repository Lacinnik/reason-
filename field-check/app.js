import { persistValue } from "../local-journal.mjs";
import { assessField } from "./runtime.mjs";
import { compileTzarLanguage } from "../tzar-language-001.mjs";

(() => {
  const state = { title: "", subjects: [], decision: null };
  const $ = selector => document.querySelector(selector);
  const cleanNames = value => {
    const seen = new Set();
    return String(value).split(/[\n,;]+/u).map(name => name.trim()).filter(name => {
      const key = name.toLocaleLowerCase("ru-RU");
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

  function setStage(name) {
    const order = ["setup", "field", "result"];
    const activeIndex = order.indexOf(name);
    document.querySelectorAll("[data-stage]").forEach(section => {
      const active = section.dataset.stage === name;
      section.classList.toggle("active", active);
      section.setAttribute("aria-hidden", String(!active));
    });
    document.querySelectorAll(".steps span").forEach((step, index) => step.classList.toggle("active", index <= activeIndex));
  }

  function validateSetup() {
    const names = cleanNames($("#participants").value);
    const title = $("#field-title").value.trim();
    const participantsValid = names.length >= 2 && names.length <= 6;
    const valid = title.length >= 3 && participantsValid;
    $("#build").disabled = !valid;
    const participantHint = names.length > 6 ? "укажите не более 6 участников" : `${names.length} из 2–6 участников`;
    $("#setup-hint").textContent = `${participantHint} · ${title.length >= 3 ? "общий объект назван" : "назовите общий объект"}`;
  }

  function buildField() {
    const title = $("#field-title").value.trim();
    const names = cleanNames($("#participants").value);
    if (title.length < 3 || names.length < 2 || names.length > 6) return;
    state.title = title;
    state.subjects = names.map((name, index) => ({ id: `s${index + 1}`, name, trustTo: "", alpha: null, qualityHypothesis: null, T: null }));
    renderSubjects();
    setStage("field");
  }

  function metricControl(subject, key, label) {
    return `<div class="metric-control"><header><span>${label}</span><output data-output="${subject.id}-${key}">не предъявлено</output></header><input type="number" min="0" max="1" step="0.25" placeholder="0–1" data-subject="${subject.id}" data-metric="${key}" aria-label="${label} · ${escapeHtml(subject.name)}"></div>`;
  }

  function renderSubjects() {
    $("#subject-cards").innerHTML = state.subjects.map((subject, index) => `
      <article class="subject-card">
        <div class="subject-id"><i>${String(index + 1).padStart(2, "0")}</i><b>${escapeHtml(subject.name)}</b></div>
        <label><span>Предъявляет связь</span><select data-trust="${subject.id}"><option value="">Выберите участника</option>${state.subjects.filter(other => other.id !== subject.id).map(other => `<option value="${other.id}">${escapeHtml(other.name)}</option>`).join("")}</select></label>
        <div class="sliders">${metricControl(subject, "alpha", "α · соответствие")}${metricControl(subject, "qualityHypothesis", "Q̂ · гипотеза качества")}${metricControl(subject, "T", "T · текучесть")}</div>
      </article>`).join("");
    document.querySelectorAll("[data-trust]").forEach(select => select.addEventListener("change", () => {
      state.subjects.find(subject => subject.id === select.dataset.trust).trustTo = select.value;
    }));
    document.querySelectorAll("[data-metric]").forEach(input => input.addEventListener("input", () => {
      const subject = state.subjects.find(item => item.id === input.dataset.subject);
      subject[input.dataset.metric] = input.value === "" || !input.validity.valid ? null : Number(input.value);
      document.querySelector(`[data-output="${subject.id}-${input.dataset.metric}"]`).textContent = subject[input.dataset.metric] === null ? "не предъявлено" : Number(input.value).toFixed(2);
    }));
  }

  function evaluate() {
    const { linksVerified, metrics, gate, allow } = assessField(state.subjects);
    const decision = {
      schema: "reson.collective-meta-decision/1.1.0",
      id: globalThis.crypto?.randomUUID?.() || `field-${Date.now()}`,
      ts: new Date().toISOString(),
      laboratory: "reson",
      shared_object: state.title,
      subjects: state.subjects.map(subject => ({ ...subject })),
      links_verified: linksVerified,
      avg_metrics: metrics,
      gate,
      allow,
      synthesis_ready: allow,
      q: null,
    };
    const links = state.subjects.map(subject => `${subject.name} → ${state.subjects.find(item => item.id === subject.trustTo)?.name || "связь не предъявлена"}`).join("; ");
    decision.language = compileTzarLanguage({
      object: state.title,
      subjectTrace: links,
      innerImage: `gate=${gate}; α=${metrics.alpha ?? "null"}; Q̂=${metrics.qualityHypothesis ?? "null"}; T=${metrics.T ?? "null"}`,
      coreNeed: allow ? "провести общий объект к следующему коллективному синтезу" : "допредъявить связи и проводимость поля",
      supra: "сохранить отдельность голосов и явность связей",
      nextExperiment: allow ? "назвать владельца следующего коллективного шага" : gate === "trust" ? "вернуться к непредъявленным связям" : gate === "missing-metrics" ? "явно предъявить недостающие предварительные оценки" : "пересмотреть предварительные оценки ниже порога",
      riemann: "фактический возврат группы после следующего действия",
      observedQ: null,
    }, {
      profile: "collective-meta-core",
      voice: "collective",
      targetRelation: "проверить предъявленность связей и проводимость общего объекта",
      context: `РЕЗОН Field Check · gate=${gate}`,
      subjectConfirmed: false,
    });
    let saved;
    try { saved = persistValue(localStorage, "reson.collective-meta.last-decision.v1", decision); } catch { saved = { ok: false }; }
    $("#storage-error").textContent = saved.ok ? "" : "Решение не сохранено: хранилище недоступно. Результат не выдан.";
    if (!saved.ok) return;
    state.decision = decision;
    renderDecision();
    setStage("result");
  }

  function renderDecision() {
    const decision = state.decision;
    $("#decision").textContent = decision.allow ? "ALLOW" : "HOLD";
    $("#decision").classList.toggle("hold", !decision.allow);
    $("#decision-title").textContent = decision.allow ? "Предварительный порог по заявленным оценкам пройден." : decision.gate === "trust" ? "Связи ещё не предъявлены." : decision.gate === "missing-metrics" ? "Оценки ещё не предъявлены." : "Предварительный порог не пройден.";
    $("#decision-copy").textContent = decision.allow ? "Оператор указал связи и оценки для каждого участника; средние α, Q̂ и T удерживают порог 0.75. Это не независимая проверка согласия или эффективности. Q остаётся null." : decision.gate === "trust" ? "У каждого участника должна быть явно выбрана связь с другим голосом поля; Q остаётся null." : decision.gate === "missing-metrics" ? "Заполните все оценки явно: пустые поля сохраняются как null, а не как ноль или порог допуска." : "Связи предъявлены, но хотя бы одна предварительная метрика ниже порога 0.75; Q остаётся null.";
    $("#metrics").innerHTML = [...Object.entries(decision.avg_metrics), ["Q", null]].map(([key, value]) => `<div><span>${key}</span><b>${value == null ? "null" : value.toFixed(2)}</b></div>`).join("");
    $("#evidence").innerHTML = `<div><span>Слово поля</span><b>${escapeHtml(decision.language.layers.publicStatement)}</b></div><div><span>Сингулярная формула</span><b>${escapeHtml(decision.language.formula)}</b></div><div><span>Связи доверия</span><b>${decision.links_verified ? "предъявлены" : "неполны"}</b></div><div><span>Ворота решения</span><b>${decision.gate}</b></div><div><span>Общий объект</span><b>${escapeHtml(decision.shared_object)}</b></div><div><span>Хранение</span><b>локально</b></div>`;
  }

  function revise() {
    state.decision = null;
    $("#storage-error").textContent = "";
    setStage("field");
  }

  function restart() {
    state.title = ""; state.subjects = []; state.decision = null;
    $("#field-title").value = ""; $("#participants").value = "";
    $("#storage-error").textContent = ""; validateSetup(); setStage("setup");
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportDecision() {
    if (!state.decision) return;
    downloadJson(`reson-field-${state.decision.id}.json`, state.decision);
  }

  $("#field-title").addEventListener("input", validateSetup);
  $("#participants").addEventListener("input", validateSetup);
  $("#build").addEventListener("click", buildField);
  $("#evaluate").addEventListener("click", evaluate);
  $("#revise").addEventListener("click", revise);
  $("#restart").addEventListener("click", restart);
  $("#export").addEventListener("click", exportDecision);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js").catch(() => {});
})();
