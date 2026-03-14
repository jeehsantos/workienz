import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Legacy redirect — verification has moved into /settings?section=verification
 */
export default function VerifyWorkRights() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/settings?section=verification", { replace: true });
  }, [navigate]);

  return null;
}

