// Canonical import path for the trust-badge primitive.
// The implementation currently lives under components/home and is re-exported
// here so future surfaces import trust badges from the shared UI layer.
export { UserTrustBadges, UserTrustBadges as TrustBadge, HomeTrustBadge } from "@/components/home/trust-badge";
export type { HomeTrustBadgeProps, HomeTrustBadgeProps as TrustBadgeProps } from "@/components/home/trust-badge";
