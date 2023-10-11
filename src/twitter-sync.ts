import db from "./utils/database";
import logger from "./utils/logger";
import { fetchTwitterUsers } from "./utils/twitter";

export default class TwitterSync {
  constructor() {}

  async syncUsers() {
    const uncheckedUsers = await db.user.findMany({
      where: {
        twitterApiUsed: false,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        twitterUsername: true,
      },
      take: 100,
    });

    const count = uncheckedUsers.length;
    if (count === 0) return 0;

    if (count < 20) {
      // send notifications for new users being checked
      // assumption: if only a handful of users need
      // to have their twitter data fetched, chances are
      // we're done with the backfill and so, we are
      // dealing with NEW users => send notifications
      await fetchTwitterUsers(uncheckedUsers, true);
    } else {
      await fetchTwitterUsers(uncheckedUsers, false);
    }
    return count;
  }

  async sync() {
    const count = await this.syncUsers();

    // quite hacky and should be adjusted based on
    // your product needs/ratelimits
    if (count < 20) {
      logger.info("Sleeping Twitter sync for 10s");
      setTimeout(() => this.sync(), 1000 * 10);
    } else {
      logger.info("Sleeping Twitter sync for 5s");
      // ratelimit for Twitter users get_many API:
      // 300 requests/15 mins
      // max users: 300 * 100 = 30k/15mins =>
      // backfill should take approx 2-3 hrs (w/o
      // accounting for delay and db writes)
      setTimeout(() => this.sync(), 1000 * 5);
    }
  }
}
