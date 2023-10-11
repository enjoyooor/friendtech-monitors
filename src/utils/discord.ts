import { User } from "@prisma/client";
import axios, { type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { Transaction } from "ethers";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getWalletBalance } from "./blockchain";
import constants from "./constants";
import db from "./database";
import { SIGNALS, SIGNALS_EMOJI, SIGNALS_ORDER, getSignals } from "./filters";
import { convertTwitterUser } from "./twitter";

const PROXY_URL = process.env.PROXY_URL;
let axiosClient: AxiosInstance;
if (!PROXY_URL) {
  axiosClient = axios.create();
} else {
  const proxyAgent = new HttpsProxyAgent(PROXY_URL);
  axiosClient = axios.create({
    httpsAgent: proxyAgent,
  });
}

axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    const retryAfterHeader = error.response?.headers["retry-after"];
    const delayInMilliseconds = retryAfterHeader
      ? parseFloat(retryAfterHeader)
      : 1000;

    const delay = Math.pow(2, retryCount) * delayInMilliseconds;
    return delay;
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkError(error) ||
      error.response?.status === 429 ||
      error.message.includes(
        "Proxy connection ended before receiving CONNECT response"
      )
    );
  },
});

function formatEther(value: string) {
  return `\`${parseFloat(value).toFixed(5)}Ξ\``;
}

async function getEmbedData(user: User, addWalletBalance: boolean = true) {
  const {
    id: userId,
    address,
    twitterUsername,
    twitterPfpUrl,
    twitterApiResponse,
  } = user;
  const response = convertTwitterUser(twitterApiResponse as any);

  const ftUrl = `https://friend.tech/rooms/${address}`;
  const twitterUrl = `https://twitter.com/${twitterUsername}`;
  const explorerUrl = `https://basescan.org/address/${address}`;

  const title = response?.name ? response.name : `@${twitterUsername}`;
  const description = response?.description;
  const fields = [
    {
      name: "Username",
      value: `[${twitterUsername}](${twitterUrl})`,
      inline: true,
    },
  ];

  // add Twitter signals
  if (response) {
    fields.push(
      {
        name: "Followers",
        value: String(response.followersCount),
        inline: true,
      },
      {
        name: "Lists",
        value:
          response.numLists > 50
            ? `${response.numLists} \`POTENTIAL ALPHA\``
            : response.numLists.toString(),
        inline: true,
      },
      {
        name: "Twitter Created",
        value: `<t:${Math.floor(response.createdAt.getTime() / 1000)}:R>`,
        inline: true,
      }
    );
  }

  fields.push({
    name: "Address",
    value: `[${address}](${explorerUrl})`,
    inline: false,
  });
  let walletBalance;
  if (addWalletBalance) {
    walletBalance = await getWalletBalance(address);
    fields.push({
      name: "Wallet Balance",
      value: formatEther(walletBalance),
      inline: true,
    });
  }

  // add signals
  let signals;
  if (response) {
    signals = getSignals(user, response, walletBalance);
    const sortedSignals = signals.sort((a, b) => {
      return SIGNALS_ORDER.indexOf(a.type) - SIGNALS_ORDER.indexOf(b.type);
    });
    const formattedSignals = sortedSignals.map((signal) => {
      const emoji = SIGNALS_EMOJI[signal.type];
      return `${emoji} ${signal.msg}`;
    });
    if (signals) {
      fields.push({
        name: "Signals",
        value: formattedSignals.join("\n"),
        inline: false,
      });
    }
  }

  // add links at the bottom
  fields.push({
    name: "Links",
    value: `[FT Room](${ftUrl}) | [Twitter](${twitterUrl}) | [BaseScan](${explorerUrl})`,
    inline: false,
  });

  const data = {
    content: "",
    embeds: [
      {
        title,
        ...(description ? { description } : {}),
        thumbnail: { url: response?.profileImageUrl || twitterPfpUrl },
        fields,
        footer: {
          text: `FT UID ${userId} · Posted on ${new Date().toUTCString()}`,
        },
      },
    ],
  };

  const positiveSignalsCount = signals
    ? signals.filter((s) => s.type === SIGNALS.GOOD || s.type === SIGNALS.GREAT)
        .length
    : 0;
  if (positiveSignalsCount >= 2) {
    data[
      "content"
    ] = `||${positiveSignalsCount} +ve signals <@${constants.ADMIN_DISCORD_ID}>||`;
  }

  return { data, twitterResponse: response, signals };
}

export async function sendNewUserToDiscord(userId: number) {
  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) return;

  const { data } = await getEmbedData(user, false);
  data.embeds[0].title = `\`${user.twitterUsername}\` signed up`;

  try {
    await axiosClient.post(constants.WEBHOOKS.SIGNUP, data);
  } catch (err: any) {
    console.error(`Error posting new sign up ${userId}`, err.stack);
  }
}

export async function sendFirstBuyToDiscord(tx: Transaction) {
  if (!tx?.from || !tx?.hash) return;

  const { hash, from } = tx;
  const user = await db.user.findFirst({
    where: {
      address: from,
    },
  });
  if (!user) return;

  const { data } = await getEmbedData(user);
  data.embeds[0].title = `\`${user.twitterUsername}\` bought their first key`;

  try {
    await axiosClient.post(constants.WEBHOOKS.FIRST_BUY, data);
  } catch (err: any) {
    console.error(`Error posting first buy ${user.id}`, err.stack);
  }
}
