export function isWalletRegulatoryApprovalEnabled(): boolean {
  return process.env.GWA_WALLET_REGULATORY_APPROVAL === "true"
}
