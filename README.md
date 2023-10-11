# Friend.Tech Monitors

Everyone's been making Friend Tech (FT) monitors from scratch, so I made one too. I decided to open-source the core of what I think is a reasonably robust system to bootstrap your FT tooling development. I use this on-and-off when I am active, and the pings are

### Summary

- Uses `/users/by-id/:id` FT API to store all existing users
- Leverages Twitter API v1.1 to bulk fetch user data
- Sends new sign-up and first-key buy notifications via Discord webhooks

### Important Files

- `users.ts`: Uses FT API to incrementally get new sign-ups.
- `twitter-sync.ts`: Uses Twitter API to bulk fetch Twitter data for FT users.
- `parser.ts`: Base chain transaction parser to scan transactions for first-key buys. This is what you'll need to update if you want to alert on other tx types, e.g. deposits or high volume for a specific key.

## Run locally

```bash
# Add env vars
cp .env.sample .env && vim .env

# Update additional config
vim src/utils/constants.ts

# Install dependencies
pnpm install

# Run locally
pnpm run build && pnpm run start
```

## Dependencies

- Setup [PostgreSQL](https://www.postgresql.org/) for persistence
- Setup [Redis](https://redis.io/) for caching
- Create a [Twitter Developer App](https://developer.twitter.com/en)

```bash
# After setting up your PostgreSQL db
npx prisma migrate dev

# Push to production
npx prisma db push
```

## Credits

I'm very much a beginner at all things TypeScript/Blockchain dev. [Anish Agnihotri's friendmex](https://github.com/Anish-Agnihotri/friendmex) was a starting point for another project I worked on before this one, which gave me enough experience to start adding more complicated features.
