import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading2, 
  Quote, 
  Code,
  Eye,
  Edit
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const insertMarkdown = (before: string, after: string = "") => {
    const textarea = document.getElementById("content-editor") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const formatContent = (content: string) => {
    const sections = content.split(/\n\n+/);
    
    return sections.map((section, idx) => {
      // Handle headings
      if (section.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-2xl font-semibold mt-8 mb-4 first:mt-0">
            {section.replace('## ', '')}
          </h2>
        );
      }
      
      if (section.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-xl font-semibold mt-6 mb-3">
            {section.replace('### ', '')}
          </h3>
        );
      }

      // Handle blockquotes
      if (section.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
            {section.replace(/^> /gm, '')}
          </blockquote>
        );
      }

      // Handle code blocks
      if (section.startsWith('```')) {
        const code = section.replace(/```\w*\n?/g, '');
        return (
          <pre key={idx} className="bg-muted p-4 rounded-lg my-4 overflow-x-auto">
            <code className="text-sm">{code}</code>
          </pre>
        );
      }

      // Handle unordered lists
      if (section.match(/^[-*] /m)) {
        const items = section.split('\n').filter(line => line.match(/^[-*] /));
        return (
          <ul key={idx} className="list-disc list-inside my-4 space-y-2">
            {items.map((item, i) => (
              <li key={i}>{item.replace(/^[-*] /, '')}</li>
            ))}
          </ul>
        );
      }

      // Handle ordered lists
      if (section.match(/^\d+\. /m)) {
        const items = section.split('\n').filter(line => line.match(/^\d+\. /));
        return (
          <ol key={idx} className="list-decimal list-inside my-4 space-y-2">
            {items.map((item, i) => (
              <li key={i}>{item.replace(/^\d+\. /, '')}</li>
            ))}
          </ol>
        );
      }

      // Handle images
      if (section.match(/!\[.*?\]\(.*?\)/)) {
        const match = section.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <img 
              key={idx} 
              src={match[2]} 
              alt={match[1]} 
              className="w-full rounded-lg my-6"
            />
          );
        }
      }

      // Handle inline formatting in paragraphs
      const formatInline = (text: string) => {
        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Inline code
        text = text.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
        
        return text;
      };

      // Regular paragraph
      const lines = section.split('\n');
      return (
        <p 
          key={idx} 
          className="text-base md:text-lg leading-relaxed mb-6"
          dangerouslySetInnerHTML={{ __html: formatInline(lines.join('<br />')) }}
        />
      );
    });
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "write" | "preview")}>
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="write" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Write
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="write" className="space-y-2">
          {/* Formatting Toolbar */}
          <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-lg border border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("## ", "")}
              title="Heading"
            >
              <Heading2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("**", "**")}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("*", "*")}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("- ", "")}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("1. ", "")}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("> ", "")}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("`", "`")}
              title="Inline Code"
            >
              <Code className="w-4 h-4" />
            </Button>
          </div>

          <Textarea
            id="content-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={15}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use markdown formatting: **bold**, *italic*, ## headings, - lists, &gt; quotes, `code`
          </p>
        </TabsContent>

        <TabsContent value="preview">
          <div className="min-h-[400px] p-6 bg-card rounded-lg border border-border">
            {value ? (
              <div className="prose prose-slate max-w-none">
                {formatContent(value)}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Nothing to preview yet. Start writing to see your content here.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
