import { ethers, JsonRpcProvider } from "ethers";

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("Missing env vars");
}

const provider = new JsonRpcProvider(RPC_URL);

export async function getWalletBalance(address: string) {
  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balanceWei);
    return balanceEther;
  } catch {
    return "0";
  }
}
