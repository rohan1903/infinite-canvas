export const DEFAULT_TEXT_FONT_SIZE = 20;
export const DEFAULT_TEXT_BOX_WIDTH = 180;
export const DEFAULT_TEXT_BOX_HEIGHT = 34;
export const TEXT_LINE_HEIGHT_RATIO = 1.25;

export function getTextFont(fontSize) {
  return `${fontSize}px Inter, Segoe UI, Roboto, sans-serif`;
}

export function layoutText(text, maxWidth, measureWidth) {
  const source = text ?? "";
  const width = Math.max(24, maxWidth || DEFAULT_TEXT_BOX_WIDTH);
  const lines = [];
  const paragraphs = source.split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let current = words[0] ?? "";
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (measureWidth(candidate) <= width) {
        current = candidate;
        continue;
      }
      if (measureWidth(words[i]) > width) {
        lines.push(current);
        current = "";
        const broken = breakWord(words[i], width, measureWidth);
        for (let j = 0; j < broken.length - 1; j += 1) {
          lines.push(broken[j]);
        }
        current = broken[broken.length - 1] ?? "";
        continue;
      }
      lines.push(current);
      current = words[i];
    }
    lines.push(current);
  }
  if (lines.length === 0) {
    lines.push("");
  }
  return lines;
}

export function getTextMetrics(element, measureWidth) {
  const fontSize = element.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const boxWidth = Math.max(24, element.boxWidth ?? DEFAULT_TEXT_BOX_WIDTH);
  const lines = layoutText(element.text ?? "", boxWidth, measureWidth);
  const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO;
  const naturalHeight = Math.max(fontSize, lines.length * lineHeight);
  const height = Math.max(naturalHeight, element.boxHeight ?? DEFAULT_TEXT_BOX_HEIGHT);
  return {
    fontSize,
    lineHeight,
    lines,
    width: boxWidth,
    height
  };
}

export function getTextBounds(element, measureWidth) {
  const metrics = getTextMetrics(element, measureWidth);
  return {
    left: element.x,
    top: element.y - metrics.height,
    right: element.x + metrics.width,
    bottom: element.y
  };
}

export function getTextStartY(element, metrics) {
  return element.y - metrics.height + metrics.fontSize;
}

export function estimateTextWidth(value, fontSize) {
  return Math.max(1, String(value).length * (fontSize * 0.62));
}

function breakWord(word, width, measureWidth) {
  const out = [];
  let token = "";
  for (const char of word) {
    const candidate = `${token}${char}`;
    if (token && measureWidth(candidate) > width) {
      out.push(token);
      token = char;
    } else {
      token = candidate;
    }
  }
  if (token) {
    out.push(token);
  }
  return out.length > 0 ? out : [word];
}
