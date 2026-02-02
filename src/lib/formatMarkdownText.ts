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
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const closeLists = () => {
    if (inUnorderedList) {
      htmlParts.push("</ul>");
      inUnorderedList = false;
    }
    if (inOrderedList) {
      htmlParts.push("</ol>");
      inOrderedList = false;
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const content = paragraphLines.map(formatInlineMarkdown).join("<br />");
    htmlParts.push(`<p>${content}</p>`);
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

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeLists();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      closeLists();
      htmlParts.push(
        `<img src="${imageMatch[2]}" alt="${imageMatch[1] || ""}" class="w-full rounded-lg my-6" />`
      );
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h3>${formatInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>`);
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h2>${formatInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>`);
      return;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(`<h1>${formatInlineMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>`);
      return;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      closeLists();
      htmlParts.push(
        `<blockquote class="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">${formatInlineMarkdown(
          trimmed.replace(/^>\s+/, "")
        )}</blockquote>`
      );
      return;
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
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!inOrderedList) {
        closeLists();
        htmlParts.push('<ol class="list-decimal list-inside my-2 space-y-1">');
        inOrderedList = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    if (trimmed === "") {
      flushParagraph();
      closeLists();
      return;
    }

    closeLists();
    paragraphLines.push(line);
  });

  flushParagraph();
  closeLists();
  flushCodeBlock();

  return htmlParts.join("");
};
