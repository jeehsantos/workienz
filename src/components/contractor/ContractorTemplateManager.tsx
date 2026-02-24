import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  GripVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TemplateField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "file" | "checkbox" | "textarea";
  required: boolean;
}

interface TemplateSection {
  title: string;
  fields: TemplateField[];
}

interface TemplateSchema {
  sections: TemplateSection[];
}

interface Template {
  id: string;
  name: string;
  version: string;
  created_at: string;
  updated_at: string;
  template_schema?: TemplateSchema;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "textarea", label: "Long Text" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File Upload" },
];

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ContractorTemplateManager() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [sections, setSections] = useState<TemplateSection[]>([
    { title: "Section 1", fields: [] },
  ]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const response = await supabase.functions.invoke("manage-pre-employment-template", {
        body: { action: "list" },
      });
      if (response.data?.templates) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleNew = () => {
    setEditingId(null);
    setTemplateName("");
    setSections([{ title: "Personal Information", fields: [] }]);
    setEditorOpen(true);
  };

  const handleEdit = async (template: Template) => {
    // Fetch full template with schema
    const response = await supabase.functions.invoke("manage-pre-employment-template", {
      body: { action: "get", template_id: template.id },
    });

    if (response.data?.template) {
      const t = response.data.template;
      setEditingId(t.id);
      setTemplateName(t.name);
      setSections(t.template_schema?.sections || [{ title: "Section 1", fields: [] }]);
      setEditorOpen(true);
    }
  };

  const handleDelete = async (templateId: string) => {
    setDeleting(templateId);
    try {
      const response = await supabase.functions.invoke("manage-pre-employment-template", {
        body: { action: "delete", template_id: templateId },
      });

      if (response.data?.error) {
        toast({ title: "Cannot Delete", description: response.data.error, variant: "destructive" });
        return;
      }

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast({ title: "Template Deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast({ title: "Error", description: "Template name is required.", variant: "destructive" });
      return;
    }

    // Validate sections have at least one field
    const hasFields = sections.some((s) => s.fields.length > 0);
    if (!hasFields) {
      toast({ title: "Error", description: "Add at least one field to your template.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const action = editingId ? "update" : "create";
      const body: Record<string, unknown> = {
        action,
        name: templateName.trim(),
        template_schema: { sections },
      };
      if (editingId) body.template_id = editingId;

      const response = await supabase.functions.invoke("manage-pre-employment-template", { body });

      if (response.data?.error) {
        toast({ title: "Error", description: response.data.error, variant: "destructive" });
        return;
      }

      toast({ title: editingId ? "Template Updated" : "Template Created" });
      setEditorOpen(false);
      fetchTemplates();
    } catch {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addField = (sectionIndex: number) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[sectionIndex] = {
        ...updated[sectionIndex],
        fields: [
          ...updated[sectionIndex].fields,
          { id: generateFieldId(), label: "", type: "text", required: false },
        ],
      };
      return updated;
    });
  };

  const updateField = (sectionIndex: number, fieldIndex: number, updates: Partial<TemplateField>) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[sectionIndex] = {
        ...updated[sectionIndex],
        fields: updated[sectionIndex].fields.map((f, i) =>
          i === fieldIndex ? { ...f, ...updates } : f
        ),
      };
      return updated;
    });
  };

  const removeField = (sectionIndex: number, fieldIndex: number) => {
    setSections((prev) => {
      const updated = [...prev];
      updated[sectionIndex] = {
        ...updated[sectionIndex],
        fields: updated[sectionIndex].fields.filter((_, i) => i !== fieldIndex),
      };
      return updated;
    });
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: `Section ${prev.length + 1}`, fields: [] }]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pre-Employment Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable onboarding forms for your hires. You own and manage the content.
          </p>
        </div>
        <Button onClick={handleNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first pre-employment form template to assign to new hires.
            </p>
            <Button onClick={handleNew} size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.version} • Updated {new Date(t.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(t)} className="h-8">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="h-8 text-destructive hover:text-destructive"
                  >
                    {deleting === t.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Design your pre-employment form. Workie securely delivers it to the candidate and encrypts their responses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard Onboarding Form"
              />
            </div>

            {sections.map((section, sIdx) => (
              <Card key={sIdx}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <Input
                      value={section.title}
                      onChange={(e) => {
                        setSections((prev) => {
                          const updated = [...prev];
                          updated[sIdx] = { ...updated[sIdx], title: e.target.value };
                          return updated;
                        });
                      }}
                      className="font-semibold text-sm h-8 w-auto"
                      placeholder="Section title"
                    />
                    {sections.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSection(sIdx)}
                        className="h-7 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  {section.fields.map((field, fIdx) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2 rounded border bg-background"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                        placeholder="Field label"
                        className="h-8 text-sm flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(sIdx, fIdx, { type: v as TemplateField["type"] })}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => (
                            <SelectItem key={ft.value} value={ft.value}>
                              {ft.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(c) => updateField(sIdx, fIdx, { required: !!c })}
                        />
                        <span className="text-xs text-muted-foreground">Req</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeField(sIdx, fIdx)}
                        className="h-7 w-7 p-0 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addField(sIdx)} className="h-7 text-xs w-full">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Field
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button size="sm" variant="outline" onClick={addSection} className="w-full">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Section
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
