import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NZ_REGIONS, getCitiesByRegion, getSuburbsByCity } from "@/data/nzRegions";

const INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Events & Hospitality",
  "Food & Beverage",
  "Healthcare",
  "Logistics & Warehousing",
  "Manufacturing",
  "Office & Admin",
  "Retail",
  "Transportation",
  "Other",
];

const VISA_STATUSES = [
  "New Zealand Citizen",
  "Permanent Resident",
  "Accredited Employer Work Visa (AEWV)",
  "Essential Skills Work Visa",
  "Post Study Work Visa",
  "Working Holiday Visa",
  "Partner of a Work Visa Holder",
  "Skilled Migrant Category Resident Visa",
  "Refugee/Protected Person",
  "Student Visa (with work rights)",
  "Visitor Visa (with work rights)",
  "Other",
];

interface WorkDetailsTabProps {
  formData: any;
  setFormData: (data: any) => void;
  comfortableHeavyLifting: boolean;
  setComfortableHeavyLifting: (value: boolean) => void;
  comfortableStanding: boolean;
  setComfortableStanding: (value: boolean) => void;
  hasCar: boolean;
  setHasCar: (value: boolean) => void;
  hasIrdNumber: boolean;
  setHasIrdNumber: (value: boolean) => void;
}

export function WorkDetailsTab({
  formData,
  setFormData,
  comfortableHeavyLifting,
  setComfortableHeavyLifting,
  comfortableStanding,
  setComfortableStanding,
  hasCar,
  setHasCar,
  hasIrdNumber,
  setHasIrdNumber,
}: WorkDetailsTabProps) {
  const availableCities = formData.location_region ? getCitiesByRegion(formData.location_region) : [];
  const availableSuburbs = formData.location_region && formData.location_city 
    ? getSuburbsByCity(formData.location_region, formData.location_city) : [];

  return (
    <Card className="p-4 sm:p-6 space-y-6">
      {/* Compliance Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Compliance & Legal</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="visa_status">Visa Status *</Label>
            <Select
              value={formData.visa_status}
              onValueChange={(value) => setFormData({ ...formData, visa_status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select visa status" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                {VISA_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ird_number">IRD Number *</Label>
            <Input
              id="ird_number"
              value={formData.ird_number}
              onChange={(e) => setFormData({ ...formData, ird_number: e.target.value })}
              placeholder="e.g., 123-456-789"
              required
            />
            <p className="text-xs text-muted-foreground">Your New Zealand tax number</p>
          </div>
        </div>
      </div>

      {/* Contact & Location Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Contact & Location</h3>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="e.g., +64 21 123 4567"
            required
          />
          <p className="text-xs text-muted-foreground">For employers to contact you</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select
              value={formData.location_region}
              onValueChange={(v) => setFormData({ ...formData, location_region: v, location_city: "", location_suburb: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                {NZ_REGIONS.map((r) => (
                  <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>City</Label>
            <Select
              value={formData.location_city}
              onValueChange={(v) => setFormData({ ...formData, location_city: v, location_suburb: "" })}
              disabled={!formData.location_region}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.location_region ? "Select city" : "Select region first"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Suburb</Label>
            <Select
              value={formData.location_suburb}
              onValueChange={(v) => setFormData({ ...formData, location_suburb: v })}
              disabled={!formData.location_city}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.location_city ? "Select suburb" : "Select city first"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                {availableSuburbs.map((suburb) => (
                  <SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Work Preferences Section */}
      <div className="space-y-4 p-6 bg-muted/30 rounded-lg">
        <div>
          <h3 className="text-lg font-semibold mb-1">Work Preferences & Status</h3>
          <p className="text-sm text-muted-foreground">
            Help employers find the right match by sharing your preferences
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-card rounded-lg">
            <div>
              <Label htmlFor="comfortable_heavy_lifting" className="font-normal cursor-pointer">
                Comfortable with Heavy Lifting
              </Label>
              <p className="text-xs text-muted-foreground">Can lift {'>'} 10kg</p>
            </div>
            <Switch
              id="comfortable_heavy_lifting"
              checked={comfortableHeavyLifting}
              onCheckedChange={setComfortableHeavyLifting}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-card rounded-lg">
            <div>
              <Label htmlFor="comfortable_standing" className="font-normal cursor-pointer">
                Comfortable Standing
              </Label>
              <p className="text-xs text-muted-foreground">For long periods</p>
            </div>
            <Switch
              id="comfortable_standing"
              checked={comfortableStanding}
              onCheckedChange={setComfortableStanding}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-card rounded-lg">
            <div>
              <Label htmlFor="has_car" className="font-normal cursor-pointer">Has Car</Label>
              <p className="text-xs text-muted-foreground">Own transport available</p>
            </div>
            <Switch
              id="has_car"
              checked={hasCar}
              onCheckedChange={setHasCar}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-card rounded-lg">
            <div>
              <Label htmlFor="has_ird_number" className="font-normal cursor-pointer">
                Has IRD Number
              </Label>
              <p className="text-xs text-muted-foreground">Tax number ready</p>
            </div>
            <Switch
              id="has_ird_number"
              checked={hasIrdNumber}
              onCheckedChange={setHasIrdNumber}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
