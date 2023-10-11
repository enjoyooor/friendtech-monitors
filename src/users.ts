import axios, { type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getLatestUserId, setLatestUserId } from "./utils/cache";
import constants from "./utils/constants";
import db from "./utils/database";
import logger from "./utils/logger";
import { fetchTwitterUsers } from "./utils/twitter";

/**
 * Sleep for period of time
 * @param {number} ms milliseconds to sleep
 * @returns {Promise} resolves when sleep period finished
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REQUEST_TIMEOUT = 5000;

export default class User {
  // Kosetto API client
  private ftClient: AxiosInstance;
  private latestUserId: number | undefined;

  constructor() {
    const PROXY_URL = process.env.PROXY_URL;
    const baseAxiosConfig = {
      baseURL: constants.API,
    };
    if (!PROXY_URL) {
      this.ftClient = axios.create(baseAxiosConfig);
    } else {
      const proxyAgent = new HttpsProxyAgent(PROXY_URL);
      this.ftClient = axios.create({
        ...baseAxiosConfig,
        httpsAgent: proxyAgent,
      });
    }

    axiosRetry(this.ftClient, {
      retries: 3,
      retryDelay: (retryCount: number) => {
        console.log(`Retry attempt: ${retryCount}`);
        return retryCount * 1000;
      },
      onRetry(retryCount, error, requestConfig) {
        logger.error(`Retry error: ${error}\nConfig: ${requestConfig}`);
        return;
      },
    });
  }

  async getSyncedUserId(): Promise<number> {
    if (!this.latestUserId) {
      this.latestUserId = await getLatestUserId();
    }
    return this.latestUserId;
  }

  async forceTwitterUserSync(userId: number, twitterUsername: string) {
    // force for every 5th, so we don't exhaust ratelimit during
    // periods of high sign-up
    if (userId % 5 !== 0) return;

    const count = await db.user.count({
      where: {
        twitterApiUsed: false,
      },
    });

    // only force-sync if we're past backfill, otherwise
    // the twitter-sync job is going to take care of
    // fetching twitter data in bulk
    if (count < 50) {
      logger.info(`Force-fetching recent user: @${twitterUsername}`);
      fetchTwitterUsers([{ id: userId, twitterUsername }], true);
    }
  }

  async getUser(userId: number): Promise<boolean> {
    try {
      const {
        data: { address, twitterUsername, twitterPfpUrl },
      }: {
        data: {
          address: string;
          twitterUsername: string;
          twitterPfpUrl: string;
        };
      } = await this.ftClient.get(`/users/by-id/${userId}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        timeout: REQUEST_TIMEOUT,
      });

      const user = {
        id: userId,
        twitterUsername,
        twitterPfpUrl,
        address,
      };
      await db.user.upsert({
        where: {
          // sometimes different ids have the same twitter
          // username (e.g. 330761/333164)
          id: userId,
        },
        create: user,
        update: user,
      });

      // non-blocking force sync
      this.forceTwitterUserSync(userId, twitterUsername);

      logger.info(`Synced ID ${userId}: @${twitterUsername}`);
      return true;
    } catch (e: any) {
      if (
        e.response &&
        e.response.status == 404 &&
        e.response.data &&
        e.response.data.message === "Address/User not found."
      ) {
        // less than the backup userId threshold, we can safely
        // assume that "User not found" is ✅ (API is not lagging)
        return Boolean(userId < constants.MAX_BACKFILL_USER_ID);
      }

      // only log certain exceptions
      if (!["ERR_CANCELED", "ERR_BAD_REQUEST"].includes(e.code)) {
        logger.error(`======= Error for UID ${userId} ===========`);
        this.logAxiosError(e);
      }

      return false;
    }
  }

  logAxiosError(error: any) {
    logger.error(error.code);
    logger.error(error.stack);
  }

  async shouldRunBackfill() {
    const latestUserId = await this.getSyncedUserId();
    return Boolean(latestUserId < constants.MAX_BACKFILL_USER_ID);
  }

  async getUserWithRetryHelper(userId: number, maxRetries: number = 3) {
    const delayMs = 1000;
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        const isSuccess = await this.getUser(userId);
        if (isSuccess) {
          return;
        }
      } catch (e: any) {
        if (retry < maxRetries) {
          logger.error(
            `Retry ${retry} failed for user: ${userId}. Retrying in ${
              delayMs / 1000
            } seconds.`
          );
          await sleep(delayMs);
        } else {
          logger.error(`Max retries reached. Unable to fetch user: ${userId}`);
          return;
        }
      }
    }
  }

  async runBackfill(batchSize: number = 50) {
    this.latestUserId = await this.getSyncedUserId();

    while (this.latestUserId < constants.MAX_BACKFILL_USER_ID) {
      logger.info(
        `Backfill (batch size: ${batchSize}) starting UID ${this.latestUserId}`
      );

      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        const userId = this.latestUserId + i;
        promises.push(this.getUserWithRetryHelper(userId));
      }
      await Promise.all(promises);

      // Update latestUserId after processing a batch
      this.latestUserId += batchSize;
      await setLatestUserId(this.latestUserId);

      logger.info(
        `Backfilled until UID ${this.latestUserId - 1}, sleeping for 2s`
      );
      await sleep(1000 * 2);
    }
  }

  async getManyUsers(startUserId: number, batchSize: number) {
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const userId = startUserId + i;
      promises.push(this.getUser(userId));
    }
    await Promise.all(promises);
  }

  async getUsersInBatch(batchSize: number = 25) {
    let latestUserId = await this.getSyncedUserId();

    // loop indefinitely
    while (true) {
      await this.getManyUsers(latestUserId, batchSize);

      // Update latestUserId after processing a batch
      latestUserId += batchSize;
      await setLatestUserId(latestUserId);

      logger.info(`Synced users until ${latestUserId - 1}, sleeping for 5s`);
      await sleep(1000 * 5);
    }
  }

  async getUsers() {
    if (await this.shouldRunBackfill()) {
      await this.runBackfill();
    }

    this.latestUserId = await this.getSyncedUserId();
    logger.warn(
      `Should NOT see until ${this.latestUserId} >= ${constants.MAX_BACKFILL_USER_ID}`
    );

    // loop indefinitely
    while (true) {
      const isSuccess = await this.getUser(this.latestUserId);
      if (isSuccess) {
        this.latestUserId++;
        await setLatestUserId(this.latestUserId);

        if (this.latestUserId % 250 === 0) {
          logger.info(`Sleeping for 2s to continue fetching new users`);
          await sleep(1000 * 2);
        }
      } else {
        // when no user is found, take a longer break
        await sleep(1000);
      }
    }
  }

  async sync() {
    await this.getUsers();
  }
}
