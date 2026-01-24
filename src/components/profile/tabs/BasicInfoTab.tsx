import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NZ_REGIONS, getCitiesByRegion, getSuburbsByCity } from "@/data/nzRegions";

interface BasicInfoTabProps {
  formData: any;
  setFormData: (data: any) => void;
  dateOfBirth: Date | undefined;
  setDateOfBirth: (date: Date | undefined) => void;
}

export function BasicInfoTab({ formData, setFormData, dateOfBirth, setDateOfBirth }: BasicInfoTabProps) {
  const availableCities = formData.location_region ? getCitiesByRegion(formData.location_region) : [];
  const availableSuburbs = formData.location_region && formData.location_city 
    ? getSuburbsByCity(formData.location_region, formData.location_city) : [];

  return (
    <div className="space-y-6">
      {/* Availability Toggle */}
      <Card className="p-4 sm:p-6 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label htmlFor="is_available" className="text-base font-semibold">
              Available for Work
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Show your profile to contractors looking for workers
            </p>
          </div>
          <Switch
            id="is_available"
            checked={formData.is_available}
            onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
          />
        </div>
      </Card>

      {/* Personal Information */}
      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="e.g., John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="e.g., Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date of Birth *</Label>
            <DatePicker
              value={dateOfBirth}
              onChange={setDateOfBirth}
              placeholder="Select your date of birth"
              disabledDates={(date) => date > new Date() || date < new Date("1940-01-01")}
            />
          </div>

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
        </div>
      </Card>

      {/* Location */}
      <Card className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Location</h3>
        
        <div className="space-y-4">
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
      </Card>
    </div>
  );
}
