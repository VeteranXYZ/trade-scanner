export const SCANNER_BUILD_MARKER = "Phase 1";

export function isLocalSourceEnabledInUi() {
  const deployTarget =
    process.env.NEXT_PUBLIC_DEPLOY_TARGET ?? process.env.DEPLOY_TARGET;

  if (deployTarget === "cloudflare") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}
