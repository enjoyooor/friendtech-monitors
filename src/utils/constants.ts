// a namespace to distingush Redis keys in case
// you have similar projects using the same cache
const REDIS_KEY_NAMESPACE = "ft_sniper";

export default {
  // friend.tech contract deploy block
  CONTRACT_DEPLOY_BLOCK: 2430440,
  // @0xRacerAlt friend.tech UID
  RACER_USER_ID: 11,
  // Contract address
  CONTRACT_ADDRESS: "0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4",
  // Function signatures
  SIGNATURES: {
    BUY: "0x6945b123",
    SELL: "0xb51d0534",
  },
  // Total fees per trade determined by the
  // contract
  TOTAL_TRADE_FEE: 0.1,
  // Backend API endpoint
  API: "https://prod-api.kosetto.com",
  // The next friend.tech UID we need to backfill
  LATEST_USER_ID_CACHE_KEY: `${REDIS_KEY_NAMESPACE}_latest_user_id`,
  //
  BLOCK_NUMBER_CACHE_KEY: `${REDIS_KEY_NAMESPACE}_latest_block_number`,
  // At the time of writing, FT has over 350k users
  // When backfilling users, sometimes I noticed
  // "Address/User not found" while incrementally
  // fetching users. We don't really need to retry
  // the API call because we can safely assume that
  // FT API is not lagging. For newer users, however,
  // we cannot be sure if "Address/User not found"
  // means
  // a) FT API is lagging OR
  // b) UID in fact does not exist yet
  // You can get around this by implementing a binary
  // search at the start of your backfill process to
  // find the highest FT UID, I couldn't be bothered
  // to implement it...
  MAX_BACKFILL_USER_ID: 350000,
  DATETIME_FORMAT: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  },
  // todo: update this according to your needs
  WEBHOOKS: {
    FIRST_BUY: "https://discord.com/",
    SIGNUP: "https://discord.com/",
  },
  // to avoid hammering webhooks/getting ratelimited
  // when scanning a large numnber of users (either
  // during a backfill or during periods of high
  // user sign-ups)
  DISCORD_NOTIFICATIONS_BATCH_SIZE: 5,
  // todo: update this to your discord UID
  // OR you can create unique roles
  ADMIN_DISCORD_ID: "",
};
