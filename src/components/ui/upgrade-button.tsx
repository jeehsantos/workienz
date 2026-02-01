import { Link } from "react-router-dom";
import { Button, ButtonProps } from "@/components/ui/button";
import { useUpgradeButtonVisibility } from "@/hooks/useUpgradeButtonVisibility";
import { Crown } from "lucide-react";

interface UpgradeButtonProps extends Omit<ButtonProps, "asChild"> {
  /** Custom text to display (overrides default based on user role) */
  children?: React.ReactNode;
  /** Whether to show the crown icon */
  showIcon?: boolean;
  /** Custom class names */
  className?: string;
}

/**
 * Reusable upgrade button component that respects the platform's
 * hide_upgrade_buttons setting and user role.
 * 
 * - Returns null if button should be hidden (employees when setting is enabled)
 * - Shows "Become a Partner" linking to /contact for contractors when setting is enabled
 * - Shows normal upgrade text/link when setting is disabled
 */
export function UpgradeButton({
  children,
  showIcon = false,
  className,
  ...props
}: UpgradeButtonProps) {
  const { showUpgrade, upgradeText, upgradeLink, isLoading } = useUpgradeButtonVisibility();

  // Don't render anything if button should be hidden or still loading
  if (!showUpgrade || isLoading) {
    return null;
  }

  return (
    <Button asChild className={className} {...props}>
      <Link to={upgradeLink}>
        {showIcon && <Crown className="w-4 h-4 mr-2" />}
        {children || upgradeText}
      </Link>
    </Button>
  );
}
