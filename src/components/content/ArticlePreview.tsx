import { AlertTriangle, Lightbulb, Clock } from "lucide-react";
import type { ContentBlock } from "./ContentBlockEditor";
import { formatMarkdownText } from "@/lib/formatMarkdownText";

interface ArticlePreviewProps {
  title: string;
  summary: string;
  blocks: ContentBlock[];
  articleType: string;
  previewMode: "desktop" | "mobile";
}

export function ArticlePreview({
  title,
  summary,
  blocks,
  articleType,
  previewMode,
}: ArticlePreviewProps) {
  const renderBlock = (block: ContentBlock, index: number) => {
    const formattedContent = formatMarkdownText(block.value);
    
    switch (block.type) {
      case "heading":
        return (
          <h2
            key={block.id || index}
            className="text-xl font-bold text-foreground pt-6 pb-2 border-t border-border mt-6"
          >
            {block.value || "Section Heading"}
          </h2>
        );
      case "warning":
        return (
          <div
            key={block.id || index}
            className="flex gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-100 my-6"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <div>
              <strong className="block text-xs font-bold uppercase tracking-tight mb-1">
                Legal Requirement
              </strong>
              <div 
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formattedContent || "Warning text..." }}
              />
            </div>
          </div>
        );
      case "tip":
        return (
          <div
            key={block.id || index}
            className="flex gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100 my-6"
          >
            <Lightbulb className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
            <div>
              <strong className="block text-xs font-bold uppercase tracking-tight mb-1">
                Pro Tip
              </strong>
              <div 
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formattedContent || "Tip text..." }}
              />
            </div>
          </div>
        );
      default:
        return (
          <div
            key={block.id || index}
            className="text-base leading-relaxed text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: formattedContent || "Content text goes here..." }}
          />
        );
    }
  };

  const getArticleTypeLabel = () => {
    switch (articleType) {
      case "qa":
        return "Atomic Answer";
      case "guide":
        return "Step-by-Step Guide";
      case "checklist":
        return "Checklist";
      default:
        return "Article";
    }
  };

  return (
    <div
      className={`bg-card shadow-2xl transition-all duration-300 overflow-y-auto rounded-lg border border-border ${
        previewMode === "mobile"
          ? "w-[375px] h-[667px] mx-auto"
          : "w-full h-full"
      }`}
    >
      <div className="p-6">
        {/* Article Type Badge */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] px-3 py-1 bg-primary/10 rounded-full">
            {getArticleTypeLabel()}
          </span>
          <div className="w-1 h-1 bg-muted rounded-full" />
          <div className="flex items-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
            <Clock className="w-3 h-3 mr-1" />
            2 min read
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight mb-6">
          {title || "Article Question Title"}
        </h1>

        {/* Summary / TL;DR */}
        {summary && (
          <div className="bg-foreground text-background p-6 rounded-2xl mb-8 shadow-lg">
            <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">
              The short answer
            </h4>
            <p className="text-base leading-relaxed font-medium">
              {summary}
            </p>
          </div>
        )}

        {/* Content Blocks */}
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Add content blocks to see the preview
            </p>
          ) : (
            blocks.map((block, idx) => renderBlock(block, idx))
          )}
        </div>
      </div>
    </div>
  );
}
