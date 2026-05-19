/** Optional read-only maker address from injected wallet. */
export async function connectMakerAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const eth = (
    window as Window & {
      ethereum?: { request: (args: { method: string }) => Promise<string[]> };
    }
  ).ethereum;
  if (!eth) return null;
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}
