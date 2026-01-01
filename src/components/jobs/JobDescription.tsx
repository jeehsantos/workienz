import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface JobDescriptionProps {
  description: string;
  requirements?: string | null;
  previewLines?: number;
}

export function JobDescription({
  description,
  requirements,
  previewLines = 8,
}: JobDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if content is long enough to need truncation
  const lines = description.split("\n");
  const needsTruncation = lines.length > previewLines || description.length > 500;

  // Format paragraphs nicely
  const formatContent = (text: string) => {
    return text.split(/\n\n+/).map((paragraph, idx) => (
      <p key={idx} className="mb-4 last:mb-0 leading-relaxed">
        {paragraph.split("\n").map((line, lineIdx) => (
          <span key={lineIdx}>
            {line}
            {lineIdx < paragraph.split("\n").length - 1 && <br />}
          </span>
        ))}
      </p>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Description Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">About this role</h3>
        <div className="relative">
          <div
            className={`text-muted-foreground ${
              !isExpanded && needsTruncation
                ? `line-clamp-[${previewLines}] max-h-48 overflow-hidden`
                : ""
            }`}
            style={
              !isExpanded && needsTruncation
                ? { WebkitLineClamp: previewLines, display: "-webkit-box", WebkitBoxOrient: "vertical" }
                : undefined
            }
          >
            {formatContent(description)}
          </div>

          {/* Gradient fade for truncated content */}
          {!isExpanded && needsTruncation && (
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Expand/Collapse button */}
        {needsTruncation && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Read full description
              </>
            )}
          </Button>
        )}
      </div>

      {/* Requirements Section */}
      {requirements && (
        <div className="pt-4 border-t border-border/50">
          <h3 className="text-lg font-semibold mb-3 text-foreground">Requirements</h3>
          <div className="text-muted-foreground">
            {formatContent(requirements)}
          </div>
        </div>
      )}
    </div>
  );
}
