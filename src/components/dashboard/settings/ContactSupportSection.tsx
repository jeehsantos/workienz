import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2, Send, Mail } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

type FormData = z.infer<typeof schema>;

const employeeSubjects = [
  { value: "support", label: "Account & Login Help" },
  { value: "general", label: "Job Application Question" },
  { value: "feedback", label: "Profile / Verification Issue" },
  { value: "billing", label: "Payment or Referral Question" },
];

const contractorSubjects = [
  { value: "support", label: "Account & Login Help" },
  { value: "general", label: "Job Posting Question" },
  { value: "billing", label: "Billing & Subscription" },
  { value: "partnerships", label: "Partnership / Verification" },
  { value: "feedback", label: "Feedback or Feature Request" },
];

export function ContactSupportSection() {
  const { user, isContractor } = useAuthContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: user?.email ?? "",
    subject: "",
    message: "",
  });

  const subjects = isContractor() ? contractorSubjects : employeeSubjects;
  const rolePrefix = isContractor() ? "[Contractor]" : "[Employee]";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(formData);
    if (!result.success) {
      const newErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as keyof FormData] = err.message;
      });
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const subjectLabel = subjects.find((s) => s.value === formData.subject)?.label ?? formData.subject;
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          ...formData,
          message: `${rolePrefix} ${subjectLabel}\n\n${formData.message}`,
        },
      });
      if (error) throw error;
      toast({ title: "Message sent!", description: "Our support team will reply within 24 hours." });
      setFormData({ name: "", email: user?.email ?? "", subject: "", message: "" });
    } catch (err: any) {
      toast({
        title: "Failed to send",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
        <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Need direct contact?</p>
          <p className="text-muted-foreground">
            Email us anytime at{" "}
            <a href="mailto:hello@workie.co.nz" className="text-primary hover:underline">
              hello@workie.co.nz
            </a>
            . We typically respond within 24 hours on business days.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cs-name">Your Name</Label>
            <Input
              id="cs-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Smith"
              className="mt-1.5"
            />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="cs-email">Email Address</Label>
            <Input
              id="cs-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@example.com"
              className="mt-1.5"
            />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="cs-subject">Subject</Label>
          <Select
            value={formData.subject}
            onValueChange={(value) => setFormData({ ...formData, subject: value })}
          >
            <SelectTrigger id="cs-subject" className="mt-1.5">
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject}</p>}
        </div>

        <div>
          <Label htmlFor="cs-message">Message</Label>
          <Textarea
            id="cs-message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Tell us how we can help..."
            className="mt-1.5 min-h-[150px] resize-none"
          />
          {errors.message && <p className="text-sm text-destructive mt-1">{errors.message}</p>}
          <p className="text-xs text-muted-foreground mt-1 text-right">{formData.message.length}/2000</p>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
