// The mobile bottom navigation now lives in the global member shell
// (components/shell/mobile-bottom-nav). This shim preserves the previous
// import path for backward compatibility; new code should import
// MobileBottomNav from the shell directly.
export { MobileBottomNav as HomeBottomNav } from "@/components/shell/mobile-bottom-nav";
