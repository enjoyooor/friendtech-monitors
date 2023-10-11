import https from "https";
import { TwitterApi, UserV1 } from "twitter-api-v2";
import constants from "./constants";
import db from "./database";
import { sendNewUserToDiscord } from "./discord";
import { chunks } from "./helpers";
import logger from "./logger";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const twitterAuthToken = process.env.TWITTER_BEARER_TOKEN ?? "";
// see https://github.com/PLhery/node-twitter-api-v2/issues/455
// not idea: shouldn't have to create a new socket for each
// outgoing API request
const twitterClient = new TwitterApi(twitterAuthToken, {
  httpAgent: new https.Agent({
    keepAlive: false,
  }),
});

export function convertTwitterUser(user: UserV1) {
  if (!user) {
    return;
  }
  return {
    username: user.screen_name,
    name: user.name,
    description: user.description || "",
    followersCount: user.followers_count,
    friendsCount: user.friends_count,
    numLikes: user.favourites_count,
    numPosts: user.statuses_count,
    numLists: user.listed_count,
    createdAt: new Date(user.created_at),
    verified: user.verified,
    default: Boolean(user.default_profile && user.default_profile_image),
    profileImageUrl: user.profile_image_url_https,
  };
}

/**
 * Copy-pasta of TxParser.handleFirstBuyTxs
 * Too lazy to refactor...
 * @param ftUsers
 */
async function sendNotifsToDiscord(
  ftUsers: { id: number; twitterUsername: string }[]
) {
  for (const chunk of [
    ...chunks(ftUsers, constants.DISCORD_NOTIFICATIONS_BATCH_SIZE),
  ]) {
    const promises = chunk.map(async (user) => {
      await sendNewUserToDiscord(user.id);
    });
    await Promise.all(promises);
    await sleep(100);
  }
}

export async function fetchTwitterUsers(
  ftUsers: { id: number; twitterUsername: string }[],
  sendNotifs: boolean = false
) {
  const usernames = ftUsers.map((user) => user.twitterUsername);
  logger.info(`Fetching data for Twitter users: ${JSON.stringify(usernames)}`);

  const twitterUsers = await getUsersByTwitterUsernames(usernames);
  const usernameToApiReponse: Record<string, UserV1> = {};
  twitterUsers.forEach((user: UserV1) => {
    usernameToApiReponse[user.screen_name] = user;
  });

  const CHUNK_SIZE = 50;
  for (const chunk of [...chunks(ftUsers, CHUNK_SIZE)]) {
    logger.debug(
      `Updating ${CHUNK_SIZE} Twitter users: ${ftUsers.map(
        (u) => u.twitterUsername
      )}`
    );
    const promises = chunk.map(async (user) => {
      const twitterApiResponse = usernameToApiReponse[
        user.twitterUsername
      ] as any;
      await db.user.update({
        where: { id: user.id },
        data: {
          twitterApiUsed: true,
          twitterApiSyncedAt: new Date(),
          twitterApiResponse,
        },
      });
    });
    await Promise.all(promises);
    await sleep(100);
  }

  if (sendNotifs) {
    await sendNotifsToDiscord(ftUsers);
  }
}

export async function getUsersByTwitterUsernames(usernames: string[]) {
  try {
    return await twitterClient.v1.users({
      screen_name: usernames,
      include_entities: false,
    });
  } catch (e: any) {
    const filteredErrors = e.errors.filter(
      // 17: username does not exist (twitter deleted)
      (error: any) => error.code !== 17
    );
    if (filteredErrors.length > 0) {
      console.error(
        `Could not fetch twitter users using usernames: ${usernames}, ${e}`
      );
      throw e;
    }
    return [];
  }
}
