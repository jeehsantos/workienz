import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Settings, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminVerificationReview from "@/components/admin/AdminVerificationReview";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuthContext();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [maxPositionsPerJob, setMaxPositionsPerJob] = useState("10");
  const [freeTierCooldownDays, setFreeTierCooldownDays] = useState("3");
  const [paidTierMaxActiveApps, setPaidTierMaxActiveApps] = useState("3");
  const [paidTierCooldownDays, setPaidTierCooldownDays] = useState("3");
  const [singlePostJobLimit, setSinglePostJobLimit] = useState("1");
  const [singlePostDurationDays, setSinglePostDurationDays] = useState("14");
  const [sprintDurationDays, setSprintDurationDays] = useState("14");
  const [sprintJobLimit, setSprintJobLimit] = useState("3");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hideUpgradeButtons, setHideUpgradeButtons] = useState(false);
  const [isSavingUpgradeVisibility, setIsSavingUpgradeVisibility] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin())) {
      navigate("/dashboard");
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin()) {
      fetchSettings();
    }
  }, [user, isAdmin]);

  async function fetchSettings() {
    setIsLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "max_positions_per_job",
        "free_tier_cooldown_days",
        "paid_tier_max_active_apps",
        "paid_tier_cooldown_days",
        "single_post_job_limit",
        "single_post_duration_days",
        "14_day_sprint_duration_days",
        "14_day_sprint_job_limit",
        "hide_upgrade_buttons",
      ]);

    if (data) {
      data.forEach((setting) => {
        switch (setting.setting_key) {
          case "max_positions_per_job": setMaxPositionsPerJob(setting.setting_value); break;
          case "free_tier_cooldown_days": setFreeTierCooldownDays(setting.setting_value); break;
          case "paid_tier_max_active_apps": setPaidTierMaxActiveApps(setting.setting_value); break;
          case "paid_tier_cooldown_days": setPaidTierCooldownDays(setting.setting_value); break;
          case "single_post_job_limit": setSinglePostJobLimit(setting.setting_value); break;
          case "single_post_duration_days": setSinglePostDurationDays(setting.setting_value); break;
          case "14_day_sprint_duration_days": setSprintDurationDays(setting.setting_value); break;
          case "14_day_sprint_job_limit": setSprintJobLimit(setting.setting_value); break;
          case "hide_upgrade_buttons": setHideUpgradeButtons(setting.setting_value === "true"); break;
        }
      });
    }
    setIsLoading(false);
  }

  async function toggleHideUpgradeButtons(checked: boolean) {
    setIsSavingUpgradeVisibility(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ setting_value: checked ? "true" : "false" })
      .eq("setting_key", "hide_upgrade_buttons");

    if (error) {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    } else {
      setHideUpgradeButtons(checked);
      toast({ title: "Success", description: `Upgrade buttons ${checked ? "hidden" : "visible"}` });
    }
    setIsSavingUpgradeVisibility(false);
  }

  async function saveSettings() {
    setIsSavingSettings(true);
    const updates = [
      { key: "max_positions_per_job", value: maxPositionsPerJob },
      { key: "free_tier_cooldown_days", value: freeTierCooldownDays },
      { key: "paid_tier_max_active_apps", value: paidTierMaxActiveApps },
      { key: "paid_tier_cooldown_days", value: paidTierCooldownDays },
      { key: "single_post_job_limit", value: singlePostJobLimit },
      { key: "single_post_duration_days", value: singlePostDurationDays },
      { key: "14_day_sprint_duration_days", value: sprintDurationDays },
      { key: "14_day_sprint_job_limit", value: sprintJobLimit },
    ];

    let hasError = false;
    for (const update of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ setting_value: update.value })
        .eq("setting_key", update.key);
      if (error) {
        console.error(`Failed to update ${update.key}:`, error);
        hasError = true;
      }
    }

    if (hasError) {
      toast({ title: "Error", description: "Failed to save some settings", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Settings saved successfully" });
    }
    setIsSavingSettings(false);
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-6 sm:py-8 px-4 sm:px-0">
        <Button variant="ghost" asChild className="mb-4 sm:mb-6">
          <Link to="/admin">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Link>
        </Button>

        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Platform Settings</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Configure platform-wide settings for job posting and applications
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Platform Settings</CardTitle>
            <CardDescription>Configure platform-wide settings for job posting and applications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Job Posting Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Job Posting Limits</h3>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="maxPositions">Maximum Positions Per Job</Label>
                <Input id="maxPositions" type="number" min="1" max="100" value={maxPositionsPerJob} onChange={(e) => setMaxPositionsPerJob(e.target.value)} />
                <p className="text-xs text-muted-foreground">Contractors cannot post jobs with more positions than this limit.</p>
              </div>
            </div>

            {/* Application Throttling Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Application Throttling (Workers)</h3>
              <p className="text-sm text-muted-foreground">Control how frequently workers can apply to jobs based on their subscription tier.</p>
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="freeTierCooldown">Free Tier Cooldown (Days)</Label>
                  <Input id="freeTierCooldown" type="number" min="0" max="30" value={freeTierCooldownDays} onChange={(e) => setFreeTierCooldownDays(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Days free users must wait between applications.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paidTierMaxApps">Paid Tier Max Active Apps</Label>
                  <Input id="paidTierMaxApps" type="number" min="1" max="20" value={paidTierMaxActiveApps} onChange={(e) => setPaidTierMaxActiveApps(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max pending/shortlisted applications for subscribers.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paidTierCooldown">Paid Tier Cooldown (Days)</Label>
                  <Input id="paidTierCooldown" type="number" min="0" max="30" value={paidTierCooldownDays} onChange={(e) => setPaidTierCooldownDays(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Days subscribers must wait between applications.</p>
                </div>
              </div>
            </div>

            {/* Upgrade Button Visibility */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Upgrade Button Visibility</h3>
              <p className="text-sm text-muted-foreground">Control whether upgrade/premium buttons are shown to users.</p>
              <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                <Switch id="hideUpgradeButtons" checked={hideUpgradeButtons} onCheckedChange={toggleHideUpgradeButtons} disabled={isSavingUpgradeVisibility} />
                <div className="space-y-1">
                  <Label htmlFor="hideUpgradeButtons" className="font-medium cursor-pointer">Hide Upgrade Buttons</Label>
                  <p className="text-xs text-muted-foreground">When enabled:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li><strong>Employees:</strong> "Upgrade to Premium" buttons are completely hidden</li>
                    <li><strong>Contractors:</strong> Upgrade buttons become "Become a Partner" and redirect to Contact page</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Contractor Tier Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Contractor Tier Limits</h3>
              <p className="text-sm text-muted-foreground">Configure job posting limits and durations for one-time contractor plans.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="singlePostJobLimit">Single Post Job Limit</Label>
                  <Input id="singlePostJobLimit" type="number" min="1" max="10" value={singlePostJobLimit} onChange={(e) => setSinglePostJobLimit(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max jobs for Single Post tier.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="singlePostDuration">Single Post Duration (Days)</Label>
                  <Input id="singlePostDuration" type="number" min="1" max="90" value={singlePostDurationDays} onChange={(e) => setSinglePostDurationDays(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Days after first job published.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprintJobLimit">14-Day Sprint Job Limit</Label>
                  <Input id="sprintJobLimit" type="number" min="1" max="20" value={sprintJobLimit} onChange={(e) => setSprintJobLimit(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max jobs for 14-Day Sprint tier.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprintDuration">Sprint Duration (Days)</Label>
                  <Input id="sprintDuration" type="number" min="1" max="90" value={sprintDurationDays} onChange={(e) => setSprintDurationDays(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Days after first job published.</p>
                </div>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={isSavingSettings} className="mt-6">
              {isSavingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
