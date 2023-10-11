import { User } from "@prisma/client";
import { CustomTwitterUser } from "./types";

const MIN_FOLLOWING_WARN = 10;

const MIN_USER_ID_GREAT = 50_000;
const MIN_USER_ID_GOOD = 200_000;

const WALLET_BALANCE_GOOD = 0.2;
const WALLET_BALANCE_GREAT = 0.75;

export enum SIGNALS {
  BAD = 0,
  WARN = 1,
  GOOD = 2,
  GREAT = 3,
}

export const SIGNALS_ORDER = [
  SIGNALS.BAD,
  SIGNALS.WARN,
  SIGNALS.GOOD,
  SIGNALS.GREAT,
];
export const SIGNALS_EMOJI = {
  [SIGNALS.BAD]: "🔴",
  [SIGNALS.WARN]: "🟠",
  [SIGNALS.GOOD]: "🟢",
  [SIGNALS.GREAT]: "🟣",
};

function formatEther(value: string) {
  return `\`${parseFloat(value).toFixed(5)}Ξ\``;
}

export function getSignals(
  dbUser: User,
  user: CustomTwitterUser,
  walletBalance: string | undefined = undefined
) {
  const signals = [];
  if (user.default || !user.profileImageUrl) {
    signals.push({ type: SIGNALS.BAD, msg: "Default profile" });
  }
  if (user.followersCount < MIN_FOLLOWING_WARN) {
    signals.push({
      type: SIGNALS.WARN,
      msg: `Following less than ${MIN_FOLLOWING_WARN}`,
    });
  }
  if (dbUser.id < MIN_USER_ID_GOOD) {
    signals.push({
      type: SIGNALS.GOOD,
      msg: `Early user · FT UID < ${MIN_USER_ID_GREAT}`,
    });
  }
  if (walletBalance !== null && walletBalance !== undefined) {
    const balance = parseFloat(walletBalance);
    if (balance >= WALLET_BALANCE_GREAT) {
      signals.push({
        type: SIGNALS.GREAT,
        msg: `High wallet balance ${formatEther(String(balance))}`,
      });
    } else if (balance >= WALLET_BALANCE_GOOD) {
      signals.push({
        type: SIGNALS.GOOD,
        msg: `Moderate wallet balance ${formatEther(String(balance))}`,
      });
    }
  }
  return signals;
}
