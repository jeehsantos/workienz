const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatInlineMarkdown = (text: string) => {
  let formatted = text;

  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/__(.*?)__/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
  formatted = formatted.replace(/~~(.*?)~~/g, "<u>$1</u>");
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>'
  );

  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  formatted = formatted.replace(
    /(^|[\s>])((https?:\/\/|www\.)[^\s<]+)/g,
    (match, prefix, url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `${prefix}<a href="${href}" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );

  return formatted;
};

export const formatMarkdownText = (text: string): string => {
  if (!text) return "";

  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let paragraphLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let orderedListStart: number | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const formatLineWithIndentation = (line: string) => {
    const match = line.match(/^[\t ]+/);
    const leading = match ? match[0] : "";
    const content = line.slice(leading.length);
    const indent = leading.replace(/\t/g, "    ").replace(/ /g, "&nbsp;");
    return `${indent}${formatInlineMarkdown(content)}`;
  };

  const parseTableRow = (row: string) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => formatInlineMarkdown(cell.trim()));

  const isTableSeparator = (row: string) =>
    /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(row);

  const closeLists = () => {
    if (inUnorderedList) {
      htmlParts.push("</ul>");
      inUnorderedList = false;
    }
    if (inOrderedList) {
      htmlParts.push("</ol>");
      inOrderedList = false;
      orderedListStart = null;
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.map(formatLineWithIndentation).join("<br />");
    htmlParts.push(`<p class="mb-4 last:mb-0 whitespace-pre-wrap">${content}</p>`);
    paragraphLines = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    htmlParts.push(
      `<pre class="bg-muted p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm">${escapeHtml(
        codeLines.join("\n")
      )}</code></pre>`
    );
    codeLines = [];
    inCodeBlock = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeLists();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (
      trimmed.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      flushParagraph();
      closeLists();

      const headerCells = parseTableRow(trimmed);
      const bodyRows: string[][] = [];
      index += 1;

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        if (!nextLine.trim() || !nextLine.includes("|")) break;
        bodyRows.push(parseTableRow(nextLine));
        index += 1;
      }

      const headerHtml = headerCells
        .map((cell) => `<th class="px-3 py-2 text-left font-semibold border-b border-border">${cell}</th>`)
        .join("");
      const bodyHtml = bodyRows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td class="px-3 py-2 border-b border-border">${cell}</td>`)
              .join("")}</tr>`
        )
        .join("");
      htmlParts.push(
        `<div class="my-4 overflow-x-auto"><table class="w-full text-sm border border-border"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
      );
      continue;
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      closeLists();
      htmlParts.push(
        `<img src="${imageMatch[2]}" alt="${imageMatch[1] || ""}" class="w-full rounded-lg my-6" />`
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h3>${formatInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h2>${formatInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h1>${formatInlineMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(
        `<blockquote class="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">${formatInlineMarkdown(
          trimmed.replace(/^>\s+/, "")
        )}</blockquote>`
      );
      continue;
    }

    const unorderedMatch = trimmed.match(/^[•\-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (!inUnorderedList) {
        closeLists();
        htmlParts.push('<ul class="list-disc list-inside my-2 space-y-1">');
        inUnorderedList = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!inOrderedList) {
        closeLists();
        orderedListStart = Number(orderedMatch[1]);
        htmlParts.push(
          `<ol class="list-decimal list-inside my-2 space-y-1"${
            orderedListStart ? ` start="${orderedListStart}"` : ""
          }>`
        );
        inOrderedList = true;
      }
      const orderNumber = Number(orderedMatch[1]);
      htmlParts.push(
        `<li${Number.isFinite(orderNumber) ? ` value="${orderNumber}"` : ""}>${formatInlineMarkdown(
          orderedMatch[2]
        )}</li>`
      );
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      closeLists();
      continue;
    }

    closeLists();
    paragraphLines.push(line);
  }

  flushParagraph();
  closeLists();
  flushCodeBlock();

  return htmlParts.join("");
};
