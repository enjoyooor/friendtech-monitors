import dotenv from "dotenv";
import Redis from "ioredis";
import constants from "./constants";

dotenv.config();

const REDIS_URL: string = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

let redis: Redis;
if (REDIS_URL.includes("127.0.0.1") || REDIS_URL === "") {
  redis = new Redis("redis://127.0.0.1:6379");
} else {
  redis = new Redis(REDIS_URL, {
    // https://github.com/redis/ioredis/issues/1203
    // warn: something to look into if Redis is hosted
    // externally
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function getLatestUserId(): Promise<number> {
  const value: string | null = await redis.get(
    constants.LATEST_USER_ID_CACHE_KEY
  );
  return value ? Number(value) : constants.RACER_USER_ID;
}

export async function setLatestUserId(userId: number) {
  const ok = await redis.set(constants.LATEST_USER_ID_CACHE_KEY, userId);
  if (!ok) {
    console.error("Error storing latest_user_id in cache");
    throw new Error("Could not store latest_user_id in Redis");
  }
}

export async function getSyncedBlock(): Promise<number> {
  const value: string | null = await redis.get(
    constants.BLOCK_NUMBER_CACHE_KEY
  );
  return value ? Number(value) : constants.CONTRACT_DEPLOY_BLOCK - 1;
}

export async function setSyncedBlock(blockNumber: number) {
  const ok = await redis.set(constants.BLOCK_NUMBER_CACHE_KEY, blockNumber);
  if (!ok) {
    console.error("Error storing latest_block_number in cache");
    throw new Error("Could not store latest_block_number in Redis");
  }
}
