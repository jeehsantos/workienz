import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface TextBlockToolbarProps {
  textareaId: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextBlockToolbar({ textareaId, value, onChange }: TextBlockToolbarProps) {
  const insertFormat = (before: string, after: string = "") => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = 
      value.substring(0, start) + 
      before + 
      selectedText + 
      after + 
      value.substring(end);
    
    onChange(newText);
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = value.split('\n');
    
    // Find which line the cursor is on
    let charCount = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        lineIndex = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }
    
    const lineStart = charCount;
    // Add prefix to the current line
    lines[lineIndex] = prefix + lines[lineIndex];
    const newText = lines.join('\n');
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      const shift = start >= lineStart ? prefix.length : 0;
      const endShift = end >= lineStart ? prefix.length : 0;
      textarea.setSelectionRange(start + shift, end + endShift);
    }, 0);
  };

  const tools = [
    { 
      icon: Bold, 
      label: "Bold", 
      action: () => insertFormat("**", "**"),
      shortcut: "**text**"
    },
    { 
      icon: Italic, 
      label: "Italic", 
      action: () => insertFormat("*", "*"),
      shortcut: "*text*"
    },
    { 
      icon: Underline, 
      label: "Underline", 
      action: () => insertFormat("<u>", "</u>"),
      shortcut: "<u>text</u>"
    },
    { 
      icon: List, 
      label: "Bullet List", 
      action: () => insertAtLineStart("• "),
      shortcut: "• item"
    },
    { 
      icon: ListOrdered, 
      label: "Numbered List", 
      action: () => insertAtLineStart("1. "),
      shortcut: "1. item"
    },
    { 
      icon: Quote, 
      label: "Quote", 
      action: () => insertAtLineStart("> "),
      shortcut: "> quote"
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-muted/50 rounded-t-lg border border-b-0 border-border">
        {tools.map((tool) => (
          <Tooltip key={tool.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={tool.action}
              >
                <tool.icon className="w-3.5 h-3.5" />
                <span className="sr-only">{tool.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>{tool.label}</p>
              <p className="text-muted-foreground font-mono">{tool.shortcut}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground px-2">
          Select text to format
        </span>
      </div>
    </TooltipProvider>
  );
}
