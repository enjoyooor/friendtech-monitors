# Friend.Tech Monitors

Everyone's been making Friend Tech (FT) monitors from scratch, so I made one too. I decided to open-source the core of what I think is a reasonably robust system to bootstrap your FT tooling development. I use this on-and-off when I am active, and the pings are as fast as, if not milliseconds faster, the next FT monitor.

I spent a lot of time fine-tuning and coming up with a reliable way to backfill all users. I believe people can create (and have been creating) cool monitors or ecosystem tooling if they have access to more signals, such as their public Twitter data, balances/tx history of funding wallets, etc.

### Summary

- Uses `/users/by-id/:id` FT API to incrementally get new users
- Leverages Twitter API v1.1 to bulk fetch user data
- Optionally sends new sign-up and first-key buy notifications via Discord webhooks

### Important Files

- `users.ts`: Uses FT API to incrementally get new sign-ups.
- `twitter-sync.ts`: Uses Twitter API to bulk fetch Twitter data for FT users.
- `parser.ts`: Base chain transaction parser to scan transactions for first-key buys. This is what you'll need to update if you want to alert on other tx types, e.g. deposits or high volume for a specific key.

## Run locally

```bash
# Add env vars
cp .env.sample .env && vim .env

# Update additional config
# This file is heavily documented and is worth reading in
# its entirety before you move further
vim src/utils/constants.ts

# Install dependencies
pnpm install

# Run locally
pnpm run build && pnpm run start
```

### Dependencies

- Setup [PostgreSQL](https://www.postgresql.org/) for persistence
- Setup [Redis](https://redis.io/) for caching
- Create a [Twitter Developer App](https://developer.twitter.com/en)

```bash
# After setting up your PostgreSQL db
npx prisma migrate dev

# Push to production
npx prisma db push
```

### Screenshots
Here's an example Discord notification.

<img width="300" alt="Screenshot 2023-10-10 at 9 28 34 PM" src="https://github.com/bholuhacks/friendtech-monitors/assets/147568088/3851224c-6d38-4b1d-84c9-e2bb347abe51">

---

### Credits

I'm very much a beginner at all things TypeScript/Blockchain. [Anish Agnihotri's friendmex](https://github.com/Anish-Agnihotri/friendmex) was a good starting point for another project I had worked on before this one. I gained invaluable experience to start creating more complicated systems.

Also thanks to [@\_GvAll](https://twitter.com/_GvAll) and [@DukeOfWapping](https://twitter.com/DukeOfWapping) for bouncing ideas.

### Author

`bholu.eth` - easy to find 🫡
