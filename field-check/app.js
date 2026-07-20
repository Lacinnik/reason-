(() => {
  const state = { title: "", subjects: [], decision: null };
  const $ = selector => document.querySelector(selector);
  const cleanNames = value => [...new Set(String(value).split(/[\n,;]+/u).map(name => name.trim()).filter(Boolean))].slice(0, 6);
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
    const valid = title.length >= 3 && names.length >= 2;
    $("#build").disabled = !valid;
    $("#setup-hint").textContent = `${names.length} из 2–6 участников · ${title.length >= 3 ? "общий объект назван" : "назовите общий объект"}`;
  }

  function buildField() {
    state.title = $("#field-title").value.trim();
    state.subjects = cleanNames($("#participants").value).map((name, index) => ({ id: `s${index + 1}`, name, trustTo: "", alpha: .75, Q: .75, T: .75 }));
    renderSubjects();
    setStage("field");
  }

  function metricControl(subject, key, label) {
    return `<div class="metric-control"><header><span>${label}</span><output data-output="${subject.id}-${key}">0.75</output></header><input type="range" min="0" max="1" step="0.25" value="0.75" data-subject="${subject.id}" data-metric="${key}" aria-label="${label} · ${escapeHtml(subject.name)}"></div>`;
  }

  function renderSubjects() {
    $("#subject-cards").innerHTML = state.subjects.map((subject, index) => `
      <article class="subject-card">
        <div class="subject-id"><i>${String(index + 1).padStart(2, "0")}</i><b>${escapeHtml(subject.name)}</b></div>
        <label><span>Предъявляет связь</span><select data-trust="${subject.id}"><option value="">Выберите участника</option>${state.subjects.filter(other => other.id !== subject.id).map(other => `<option value="${other.id}">${escapeHtml(other.name)}</option>`).join("")}</select></label>
        <div class="sliders">${metricControl(subject, "alpha", "α · соответствие")}${metricControl(subject, "Q", "Q · качество")}${metricControl(subject, "T", "T · текучесть")}</div>
      </article>`).join("");
    document.querySelectorAll("[data-trust]").forEach(select => select.addEventListener("change", () => {
      state.subjects.find(subject => subject.id === select.dataset.trust).trustTo = select.value;
    }));
    document.querySelectorAll("[data-metric]").forEach(input => input.addEventListener("input", () => {
      const subject = state.subjects.find(item => item.id === input.dataset.subject);
      subject[input.dataset.metric] = Number(input.value);
      document.querySelector(`[data-output="${subject.id}-${input.dataset.metric}"]`).textContent = Number(input.value).toFixed(2);
    }));
  }

  function average(key) {
    return state.subjects.reduce((sum, subject) => sum + subject[key], 0) / state.subjects.length;
  }

  function evaluate() {
    const linksVerified = state.subjects.every(subject => subject.trustTo && subject.trustTo !== subject.id);
    const metrics = { alpha: average("alpha"), Q: average("Q"), T: average("T") };
    const metricsReady = Object.values(metrics).every(value => value >= .75);
    const gate = !linksVerified ? "trust" : !metricsReady ? "metrics" : "ok";
    const allow = gate === "ok";
    state.decision = {
      schema: "reson.collective-meta-decision/1.0.0",
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
    };
    localStorage.setItem("reson.collective-meta.last-decision.v1", JSON.stringify(state.decision));
    renderDecision();
    setStage("result");
  }

  function renderDecision() {
    const decision = state.decision;
    $("#decision").textContent = decision.allow ? "ALLOW" : "HOLD";
    $("#decision").classList.toggle("hold", !decision.allow);
    $("#decision-title").textContent = decision.allow ? "Поле готово к синтезу." : decision.gate === "trust" ? "Связи ещё не предъявлены." : "Проводимость пока недостаточна.";
    $("#decision-copy").textContent = decision.allow ? "Каждый участник предъявил связь, а средние α, Q и T удерживают порог 0.75." : decision.gate === "trust" ? "У каждого участника должна быть явно выбранная связь с другим голосом поля." : "Связи предъявлены, но хотя бы одна средняя метрика ниже порога 0.75.";
    $("#metrics").innerHTML = Object.entries(decision.avg_metrics).map(([key, value]) => `<div><span>${key}</span><b>${value.toFixed(2)}</b></div>`).join("");
    $("#evidence").innerHTML = `<div><span>Связи доверия</span><b>${decision.links_verified ? "предъявлены" : "неполны"}</b></div><div><span>Ворота решения</span><b>${decision.gate}</b></div><div><span>Общий объект</span><b>${escapeHtml(decision.shared_object)}</b></div><div><span>Хранение</span><b>локально</b></div>`;
  }

  function restart() {
    state.title = ""; state.subjects = []; state.decision = null;
    $("#field-title").value = ""; $("#participants").value = "";
    validateSetup(); setStage("setup");
  }

  function exportDecision() {
    if (!state.decision) return;
    const blob = new Blob([JSON.stringify(state.decision, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `reson-field-${state.decision.id}.json`; link.click(); URL.revokeObjectURL(url);
  }

  $("#field-title").addEventListener("input", validateSetup);
  $("#participants").addEventListener("input", validateSetup);
  $("#build").addEventListener("click", buildField);
  $("#evaluate").addEventListener("click", evaluate);
  $("#restart").addEventListener("click", restart);
  $("#export").addEventListener("click", exportDecision);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js").catch(() => {});
})();
