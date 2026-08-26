export const MAX_MATH_RESPONSE_LENGTH = 50;

const plainNumber = /^-?(?:\d+(?:\.\d*)?|\.\d+|\d+\/\d+)$/;
const latexFraction = /^(-?)\\(?:d|t)?frac\{(-?\d+)\}\{(\d+)\}$/;

export function normalizeMathResponse(response: string) {
  const compact = response.trim().replace(/\s/g, "");
  if (plainNumber.test(compact)) return compact;

  const fraction = compact.match(latexFraction);
  if (!fraction) return null;

  const numerator = BigInt(fraction[2]) * (fraction[1] === "-" ? -1n : 1n);
  return `${numerator}/${fraction[3]}`;
}

export function mathResponseToLatex(response: string) {
  const value = response.trim();
  const fraction = value.match(/^(-?\d+)\/(\d+)$/);
  if (!fraction) return value;
  const negative = fraction[1].startsWith("-");
  const numerator = negative ? fraction[1].slice(1) : fraction[1];
  return `${negative ? "-" : ""}\\frac{${numerator}}{${fraction[2]}}`;
}
