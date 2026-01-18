import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Building2, Percent, Image } from "lucide-react";

interface Partner {
  id: string;
  contractor_user_id: string;
  display_name: string;
  logo_url: string | null;
  is_active: boolean;
  discount_percent: number;
  stripe_coupon_id: string | null;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
}

interface Contractor {
  user_id: string;
  company_name: string;
}

export default function AdminPartners() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const [formData, setFormData] = useState({
    contractor_user_id: "",
    display_name: "",
    logo_url: "",
    is_active: true,
    discount_percent: 0,
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin())) {
      navigate("/auth");
    }
  }, [user, authLoading, isAdmin, navigate]);

  const fetchPartners = async () => {
    const { data, error } = await supabase.functions.invoke("manage-partner", {
      body: { action: "list" },
    });

    if (error) {
      toast({ title: "Error", description: "Failed to load partners", variant: "destructive" });
      return;
    }

    setPartners(data.partners || []);
  };

  const fetchContractors = async () => {
    const { data } = await supabase
      .from("contractor_profiles")
      .select("user_id, company_name")
      .order("company_name");

    setContractors(data || []);
  };

  useEffect(() => {
    if (user && isAdmin()) {
      Promise.all([fetchPartners(), fetchContractors()]).finally(() => setIsLoading(false));
    }
  }, [user, isAdmin]);

  const handleSubmit = async () => {
    if (!formData.contractor_user_id || !formData.display_name) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const action = editingPartner ? "update" : "create";
    const body = editingPartner
      ? { action, partner_id: editingPartner.id, ...formData }
      : { action, ...formData };

    const { error } = await supabase.functions.invoke("manage-partner", { body });

    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: `Failed to ${action} partner`, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: `Partner ${action}d successfully` });
    setDialogOpen(false);
    resetForm();
    fetchPartners();
  };

  const handleDelete = async (partnerId: string) => {
    if (!confirm("Are you sure you want to delete this partner?")) return;

    const { error } = await supabase.functions.invoke("manage-partner", {
      body: { action: "delete", partner_id: partnerId },
    });

    if (error) {
      toast({ title: "Error", description: "Failed to delete partner", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Partner deleted" });
    fetchPartners();
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      contractor_user_id: partner.contractor_user_id,
      display_name: partner.display_name,
      logo_url: partner.logo_url || "",
      is_active: partner.is_active,
      discount_percent: partner.discount_percent,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPartner(null);
    setFormData({ contractor_user_id: "", display_name: "", logo_url: "", is_active: true, discount_percent: 0 });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container-tight py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Partner Management</h1>
          <p className="text-muted-foreground">Manage partner companies and their discounts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Partner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPartner ? "Edit Partner" : "Add New Partner"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Contractor *</Label>
                <Select value={formData.contractor_user_id} onValueChange={(v) => setFormData({ ...formData, contractor_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} placeholder="Partner display name" />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={formData.logo_url} onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input type="number" min="0" max="100" value={formData.discount_percent} onChange={(e) => setFormData({ ...formData, discount_percent: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              </div>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingPartner ? "Update Partner" : "Create Partner"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {partners.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No partners yet</CardContent></Card>
        ) : (
          partners.map((partner) => (
            <Card key={partner.id} className={!partner.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {partner.logo_url ? <img src={partner.logo_url} alt={partner.display_name} className="w-full h-full rounded-full object-cover" /> : <Building2 className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{partner.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{partner.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {partner.discount_percent > 0 && (
                    <span className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                      <Percent className="w-3 h-3" />{partner.discount_percent}% off
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${partner.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {partner.is_active ? "Active" : "Inactive"}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(partner)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(partner.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}