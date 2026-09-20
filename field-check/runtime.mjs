// These are operator-declared estimates, not measured efficacy or consent.
export function assessField(subjects) {
  const ids = new Set(subjects.map(subject => subject.id));
  const validGroup = subjects.length >= 2 && subjects.length <= 6 && ids.size === subjects.length;
  const linksVerified = validGroup && subjects.every(subject => subject.trustTo !== subject.id && ids.has(subject.trustTo));
  const metrics = Object.fromEntries(["alpha", "qualityHypothesis", "T"].map(key => {
    const values = subjects.map(subject => subject[key]);
    const complete = validGroup && values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1);
    return [key, complete ? values.reduce((sum, value) => sum + value, 0) / values.length : null];
  }));
  const missing = Object.values(metrics).some(value => value === null);
  const gate = !linksVerified ? "trust" : missing ? "missing-metrics" : Object.values(metrics).every(value => value >= .75) ? "ok" : "metrics";
  return { linksVerified, metrics, gate, allow: gate === "ok" };
}
