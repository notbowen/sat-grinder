const mathMlFenceTag = /<\s*(\/?)\s*mfenced\b([^>]*)>/gi;
const verticalBar = /^(?:\||&#0*124;|&#x0*7c;|&(?:vert|VerticalLine);)$/i;
const absoluteValueOperator = '<mo fence="true" stretchy="true">|</mo>';

function attributeValue(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

/**
 * Replaces legacy absolute-value `mfenced` elements with explicit MathML
 * operators. Some browsers render `mfenced` with its default parentheses even
 * when the source specifies vertical bars.
 */
export function normalizeQuestionHtml(html: string) {
  const absoluteValueElements: boolean[] = [];

  return html.replace(mathMlFenceTag, (tag, closing: string, attributes: string) => {
    if (closing) {
      return absoluteValueElements.pop()
        ? `${absoluteValueOperator}</mrow>`
        : tag;
    }

    if (attributes.trimEnd().endsWith("/")) return tag;

    const isAbsoluteValue = verticalBar.test(attributeValue(attributes, "open") ?? "")
      && verticalBar.test(attributeValue(attributes, "close") ?? "");
    absoluteValueElements.push(isAbsoluteValue);

    return isAbsoluteValue
      ? `<mrow>${absoluteValueOperator}`
      : tag;
  });
}
