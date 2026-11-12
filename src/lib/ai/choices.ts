const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function optionLabel(value: string): string | null {
  const match = value.trim().match(/^(?:[(（\[]\s*)?([A-Za-zＡ-Ｚ])\s*[.、．:：)）\]]/);
  const letter = match?.[1]?.normalize("NFKC").toUpperCase() ?? "";
  return LETTERS.includes(letter) ? letter : null;
}

export function choiceBody(value: string) {
  return value.replace(/^(?:[(（\[]\s*)?[A-Za-zＡ-Ｚ]\s*[.、．:：)）\]]\s*/, "").trim();
}

export function optionList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "number" && Number.isFinite(item)) return [String(item)];
    if (typeof item === "string" && item.trim()) return [item.trim()];
    return [];
  });
}

export function labelChoices(options: string[]) {
  const expanded = expandBareNumbers(options);
  let cursor = 0;
  return expanded.map((option, index) => {
    const existing = optionLabel(option);
    if (existing) {
      const at = LETTERS.indexOf(existing);
      if (at >= 0) cursor = at + 1;
      return option;
    }
    while (cursor < LETTERS.length && expanded.some((item) => optionLabel(item) === LETTERS[cursor])) cursor += 1;
    if (cursor >= LETTERS.length) return `${index + 1}. ${option}`;
    return `${LETTERS[cursor++]}. ${option}`;
  });
}

export function alignChoiceAnswer(answer: string, choices: string[]) {
  const trimmed = answer.trim();
  if (!trimmed || !choices.length) return trimmed;
  const cited = trimmed.match(/选\s*([A-Za-zＡ-Ｚ])/) ?? trimmed.match(/^([A-Za-zＡ-Ｚ])(?:\s*[.、．:：]|\s*$)/);
  if (cited?.[1]) {
    const letter = cited[1].normalize("NFKC").toUpperCase();
    const choice = choices.find((item) => optionLabel(item) === letter);
    const body = choice ? choiceBody(choice) : "";
    if (!body || trimmed.includes(body)) return trimmed;
    return `${trimmed}（${body}）`;
  }
  const match = choices.find((item) => choiceBody(item) === trimmed);
  const letter = match ? optionLabel(match) : null;
  if (match && letter) return `${letter}. ${trimmed}`;
  return trimmed;
}

function expandBareNumbers(options: string[]) {
  if (options.length !== 1) return options;
  const parts = options[0].trim().split(/\s+/);
  if (parts.length < 2 || !parts.every((part) => /^-?\d+(?:\.\d+)?$/.test(part))) return options;
  return parts;
}
