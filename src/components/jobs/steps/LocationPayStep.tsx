import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NZ_REGIONS, getCitiesByRegion, getSuburbsByCity } from "@/data/nzRegions";
import { MapPin } from "lucide-react";

interface LocationPayStepProps {
  formData: {
    location_region: string;
    location_city: string;
    location_suburb: string;
    hourly_rate: string;
  };
  onChange: (data: Partial<LocationPayStepProps["formData"]>) => void;
}

export function LocationPayStep({ formData, onChange }: LocationPayStepProps) {
  const availableCities = formData.location_region ? getCitiesByRegion(formData.location_region) : [];
  const availableSuburbs = formData.location_region && formData.location_city 
    ? getSuburbsByCity(formData.location_region, formData.location_city) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Location & Pay</h3>
      </div>

      <div className="space-y-2">
        <Label>Region *</Label>
        <Select 
          value={formData.location_region} 
          onValueChange={(v) => onChange({ location_region: v, location_city: "", location_suburb: "" })}
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
        <Label>City *</Label>
        <Select 
          value={formData.location_city} 
          onValueChange={(v) => onChange({ location_city: v, location_suburb: "" })} 
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
          onValueChange={(v) => onChange({ location_suburb: v })} 
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

      <div className="space-y-2">
        <Label>Hourly Rate ($/hr) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={formData.hourly_rate}
          onChange={(e) => onChange({ hourly_rate: e.target.value })}
          placeholder="e.g., 25.00"
          required
        />
      </div>
    </div>
  );
}
