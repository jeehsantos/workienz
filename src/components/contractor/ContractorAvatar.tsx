import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractorAvatarProps {
  avatarUrl?: string | null;
  companyName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function ContractorAvatar({
  avatarUrl,
  companyName,
  size = "md",
  className,
}: ContractorAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={cn("rounded-lg border border-border", sizeClasses[size], className)}>
      <AvatarImage
        src={avatarUrl || undefined}
        alt={companyName ? `${companyName} logo` : "Company logo"}
        className="object-cover"
      />
      <AvatarFallback className="rounded-lg bg-muted font-medium">
        {companyName ? (
          getInitials(companyName)
        ) : (
          <Building2 className={iconSizes[size]} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
