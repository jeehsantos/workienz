import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Building2, Percent, Upload, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [contractorSearchOpen, setContractorSearchOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    contractor_user_id: "",
    display_name: "",
    logo_url: "",
    is_active: true,
    discount_percent: "",
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

  const selectedContractor = useMemo(() => {
    return contractors.find(c => c.user_id === formData.contractor_user_id);
  }, [contractors, formData.contractor_user_id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 2MB", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("partner-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("partner-logos")
        .getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: publicUrl.publicUrl });
      toast({ title: "Success", description: "Logo uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload logo", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contractor_user_id || !formData.display_name) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const discountValue = formData.discount_percent === "" ? 0 : parseInt(formData.discount_percent);

    const action = editingPartner ? "update" : "create";
    const body = editingPartner
      ? { action, partner_id: editingPartner.id, ...formData, discount_percent: discountValue }
      : { action, ...formData, discount_percent: discountValue };

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
      discount_percent: partner.discount_percent?.toString() || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPartner(null);
    setFormData({ contractor_user_id: "", display_name: "", logo_url: "", is_active: true, discount_percent: "" });
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingPartner ? "Edit Partner" : "Add New Partner"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Searchable Contractor Selector */}
              <div className="space-y-2">
                <Label>Contractor *</Label>
                <Popover open={contractorSearchOpen} onOpenChange={setContractorSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contractorSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedContractor
                        ? selectedContractor.company_name
                        : "Select contractor..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search contractor..." />
                      <CommandList>
                        <CommandEmpty>No contractor found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                          {contractors.map((c) => (
                            <CommandItem
                              key={c.user_id}
                              value={c.company_name}
                              onSelect={() => {
                                setFormData({ ...formData, contractor_user_id: c.user_id });
                                setContractorSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.contractor_user_id === c.user_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {c.company_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input 
                  value={formData.display_name} 
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} 
                  placeholder="Partner display name" 
                />
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {formData.logo_url ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={formData.logo_url} 
                        alt="Partner logo" 
                        className="w-full h-full object-cover" 
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, logo_url: "" })}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label
                      htmlFor="logo-upload"
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer",
                        "hover:bg-muted transition-colors",
                        isUploadingLogo && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
                  </div>
                </div>
              </div>

              {/* Discount Input */}
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <div className="relative">
                  <Input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0" 
                    max="100" 
                    value={formData.discount_percent} 
                    onChange={(e) => {
                      // Allow empty string or numbers only
                      const value = e.target.value;
                      if (value === "" || /^\d+$/.test(value)) {
                        const numValue = value === "" ? "" : Math.min(100, parseInt(value)).toString();
                        setFormData({ ...formData, discount_percent: numValue });
                      }
                    }}
                    placeholder="0"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Enter a value between 0 and 100</p>
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
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {partner.logo_url ? (
                      <img src={partner.logo_url} alt={partner.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    )}
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
                  <span className={`text-xs px-2 py-1 rounded ${partner.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
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