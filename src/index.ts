import dotenv from "dotenv";
import TxParser from "./parser";
import TwitterSync from "./twitter-sync";
import User from "./users";
import db from "./utils/database";

dotenv.config();

process.on("warning", (e) => console.warn(e.stack));

async function execute(): Promise<void> {
  // Collect env vars
  const RPC_URL: string | undefined = process.env.RPC_URL;

  // Ensure env vars exist
  if (!RPC_URL) throw new Error("Missing env vars");

  const parser = new TxParser(RPC_URL);
  const users = new User();
  const twitterSync = new TwitterSync();
  try {
    await Promise.all([parser.sync(), users.sync(), twitterSync.sync()]);
  } catch {
    await db.$disconnect();
  }
}

(async () => {
  try {
    // Run execution lifecycle
    await execute();
  } catch (err: unknown) {
    console.error(err);
    process.exit(1);
  }
})();
