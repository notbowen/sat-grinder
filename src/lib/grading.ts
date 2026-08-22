export type GradeableQuestion = { type: "mcq" | "spr"; correctAnswers: string[] };

export type GradeResult = { correct: boolean; valid: boolean; message?: string };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a; let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
}

function rational(value: string): [bigint, bigint] | null {
  const normalized = value.trim();
  if (/^-?\d+\/\d+$/.test(normalized)) {
    const [numerator, denominator] = normalized.split("/").map(BigInt);
    if (denominator === 0n) return null;
    const divisor = gcd(numerator, denominator);
    const sign = denominator < 0n ? -1n : 1n;
    return [(numerator / divisor) * sign, (denominator / divisor) * sign];
  }
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    const negative = normalized.startsWith("-");
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [whole = "0", fraction = ""] = unsigned.split(".");
    const denominator = 10n ** BigInt(fraction.length);
    const numerator = BigInt((whole || "0") + fraction) * (negative ? -1n : 1n);
    const divisor = gcd(numerator, denominator);
    return [numerator / divisor, denominator / divisor];
  }
  return null;
}

export function validateNumericResponse(response: string): GradeResult {
  const value = response.trim();
  const maximum = value.startsWith("-") ? 6 : 5;
  if (!value || value.length > maximum) return { correct: false, valid: false, message: `Use no more than ${maximum} characters.` };
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+|\d+\/\d+)$/.test(value)) return { correct: false, valid: false, message: "Enter a number, decimal, or improper fraction." };
  if (!rational(value)) return { correct: false, valid: false, message: "Enter a valid response with a nonzero denominator." };
  return { correct: false, valid: true };
}

export function gradeAnswer(question: GradeableQuestion, response: string): GradeResult {
  if (question.type === "mcq") {
    const value = response.trim().toUpperCase();
    if (!/^[A-D]$/.test(value)) return { correct: false, valid: false, message: "Choose an answer before checking." };
    return { correct: question.correctAnswers.some((answer) => answer.trim().toUpperCase() === value), valid: true };
  }
  const validation = validateNumericResponse(response);
  if (!validation.valid) return validation;
  const entered = rational(response)!;
  const correct = question.correctAnswers.some((answer) => {
    const expected = rational(answer);
    return expected ? entered[0] === expected[0] && entered[1] === expected[1] : answer.trim() === response.trim();
  });
  return { correct, valid: true };
}

