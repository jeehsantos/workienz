import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  PlusCircle,
  Trash2,
  GripVertical,
  Type,
  Heading2,
  AlertTriangle,
  Lightbulb,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export type ContentBlock = {
  id: string;
  type: "text" | "heading" | "warning" | "tip";
  value: string;
};

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function ContentBlockEditor({ blocks, onChange }: ContentBlockEditorProps) {
  const addBlock = (type: ContentBlock["type"]) => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      value: "",
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, value: string) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, value } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    onChange(newBlocks);
  };

  const getBlockStyles = (type: ContentBlock["type"]) => {
    switch (type) {
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
      case "tip":
        return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
      case "heading":
        return "bg-muted/50 border-border";
      default:
        return "bg-background border-border";
    }
  };

  const getBlockIcon = (type: ContentBlock["type"]) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case "tip":
        return <Lightbulb className="w-4 h-4 text-emerald-600" />;
      case "heading":
        return <Heading2 className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Type className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            No content blocks yet. Add your first block below.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className={`group relative border rounded-xl p-4 transition-all ${getBlockStyles(block.type)}`}
            >
              {/* Block Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getBlockIcon(block.type)}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {block.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveBlock(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveBlock(index, "down")}
                    disabled={index === blocks.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeBlock(block.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Block Content */}
              {block.type === "heading" ? (
                <Input
                  value={block.value}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  placeholder="Section heading..."
                  className="text-lg font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                />
              ) : (
                <Textarea
                  value={block.value}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  placeholder={
                    block.type === "warning"
                      ? "Important warning or legal requirement..."
                      : block.type === "tip"
                      ? "Helpful tip or pro advice..."
                      : "Paragraph content..."
                  }
                  className="border-0 bg-transparent p-0 min-h-[80px] resize-none focus-visible:ring-0"
                  rows={block.type === "text" ? 4 : 2}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Block Buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addBlock("text")}
          className="flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Paragraph
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addBlock("heading")}
          className="flex items-center gap-2"
        >
          <Heading2 className="w-4 h-4" />
          Heading
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addBlock("warning")}
          className="flex items-center gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
        >
          <AlertTriangle className="w-4 h-4" />
          Warning
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addBlock("tip")}
          className="flex items-center gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
        >
          <Lightbulb className="w-4 h-4" />
          Tip
        </Button>
      </div>
    </div>
  );
}
