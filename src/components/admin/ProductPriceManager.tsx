import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, Save, Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlanProduct {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_type: string;
  price_cents: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  coming_soon: boolean;
  hidden: boolean;
  interval: string | null;
}

export function ProductPriceManager() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [newPrice, setNewPrice] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("plan_products")
      .select("*")
      .order("plan_type", { ascending: true })
      .order("price_cents", { ascending: true });

    if (error) {
      console.error("Error fetching plans:", error);
      toast({
        title: "Error",
        description: "Failed to fetch plans",
        variant: "destructive",
      });
    } else {
      // Type assertion since coming_soon may not be in the generated types yet
      setPlans((data as PlanProduct[]) || []);
    }
    setIsLoading(false);
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleUpdatePrice = async () => {
    if (!selectedPlanId || !newPrice) {
      toast({
        title: "Error",
        description: "Please select a plan and enter a new price",
        variant: "destructive",
      });
      return;
    }

    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    const priceCents = Math.round(priceValue * 100);
    setIsSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-stripe-price", {
        body: {
          action: "update_price",
          planId: selectedPlanId,
          newPriceCents: priceCents,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Price updated successfully!",
      });

      // Reset form and refresh plans
      setSelectedPlanId("");
      setNewPrice("");
      fetchPlans();
    } catch (error) {
      console.error("Error updating price:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update price",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComingSoon = async (planId: string, currentValue: boolean) => {
    setTogglingPlanId(planId);

    try {
      const { data, error } = await supabase.functions.invoke("update-stripe-price", {
        body: {
          action: "toggle_coming_soon",
          planId,
          comingSoon: !currentValue,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Plan visibility updated successfully`,
      });

      // Update local state
      setPlans(plans.map(p => 
        p.plan_id === planId ? { ...p, coming_soon: !currentValue } : p
      ));
    } catch (error) {
      console.error("Error toggling coming soon:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update visibility",
        variant: "destructive",
      });
    } finally {
      setTogglingPlanId(null);
    }
  };

  const [togglingHiddenId, setTogglingHiddenId] = useState<string | null>(null);

  const handleToggleHidden = async (planId: string, currentValue: boolean) => {
    setTogglingHiddenId(planId);

    try {
      const { data, error } = await supabase.functions.invoke("update-stripe-price", {
        body: {
          action: "toggle_hidden",
          planId,
          hidden: !currentValue,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `Plan visibility updated successfully`,
      });

      // Update local state
      setPlans(plans.map(p => 
        p.plan_id === planId ? { ...p, hidden: !currentValue } : p
      ));
    } catch (error) {
      console.error("Error toggling hidden:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update visibility",
        variant: "destructive",
      });
    } finally {
      setTogglingHiddenId(null);
    }
  };

  const selectedPlan = plans.find(p => p.plan_id === selectedPlanId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Update Product Price
        </CardTitle>
        <CardDescription>
          Update Stripe product prices and manage plan visibility on the pricing page
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Update Form */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="plan-select">Select Product</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger id="plan-select">
                <SelectValue placeholder="Choose a product..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.plan_id} value={plan.plan_id}>
                    {plan.plan_name} ({formatPrice(plan.price_cents)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-price">New Price (NZD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="new-price"
                type="number"
                step="0.01"
                min="0"
                placeholder={selectedPlan ? (selectedPlan.price_cents / 100).toFixed(2) : "0.00"}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={handleUpdatePrice} 
              disabled={isSaving || !selectedPlanId || !newPrice}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Price
            </Button>
          </div>
        </div>

        {/* Current Prices Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead className="text-center">Coming Soon</TableHead>
                <TableHead className="text-center">Hidden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.plan_name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {plan.plan_type}
                  </TableCell>
                  <TableCell>{formatPrice(plan.price_cents)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.interval === "one_time" ? "One-time" : 
                     plan.interval ? `Per ${plan.interval}` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        checked={plan.coming_soon}
                        onCheckedChange={() => handleToggleComingSoon(plan.plan_id, plan.coming_soon)}
                        disabled={togglingPlanId === plan.plan_id}
                      />
                      {togglingPlanId === plan.plan_id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {plan.coming_soon ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        checked={plan.hidden}
                        onCheckedChange={() => handleToggleHidden(plan.plan_id, plan.hidden)}
                        disabled={togglingHiddenId === plan.plan_id}
                      />
                      {togglingHiddenId === plan.plan_id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {plan.hidden ? (
                        <EyeOff className="w-4 h-4 text-destructive" />
                      ) : (
                        <Eye className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> "Coming Soon" shows the tier with disabled pricing. "Hidden" completely removes the tier from the pricing page.
        </p>
      </CardContent>
    </Card>
  );
}
