# Deployment

Vercel builds the connected GitHub repository from the repository root on Node 24; `vercel.json` explicitly selects the Next.js framework. Pushes to `main` trigger Production deployments; feature branches receive preview deployments. Play at the public production domain, [test-chess-game-roy-kappa-five.vercel.app](https://test-chess-game-roy-kappa-five.vercel.app), or manage the project in its [Vercel dashboard](https://vercel.com/pramits-projects-ce654619/chess-game).

Vercel's generated deployment/team URLs are sign-in protected; share the public production domain above. The historical `chess-game-six-zeta.vercel.app` address returns `DEPLOYMENT_NOT_FOUND`.

## Environment

| Variable                              | Required         | Purpose                                                                             |
| ------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `MONGODB_URI`                         | Online play      | Match storage. Local and computer games need no database.                           |
| `CHESS_AUTH_SECRET`                   | Yes (production) | Signs guest cookies. Long, random and stable across releases.                       |
| `CHESS_AUTH_SECRET_PREVIOUS`          | During rotation  | Verify-only previous secret.                                                        |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | No               | Database timeouts (default 5000).                                                   |
| `MONGODB_DNS_SERVERS`                 | No               | DNS servers for `mongodb+srv://` lookups; development defaults to public resolvers. |

For local online games, copy `.env.example` to `.env.local`. Never commit that file.

Keep the signing secret stable so existing guest sessions retain access. To rotate it, move the old value to `CHESS_AUTH_SECRET_PREVIOUS` and set a new `CHESS_AUTH_SECRET`; guests are re-signed on their next request, and the previous secret can be removed after 30 days.

Existing unversioned matches continue through the legacy adapter; new matches use the current rules. No destructive database migration is required.

## Rate limiting

The app caps each guest at 20 unjoined invites per day, but a new cookie gets around that. For real abuse protection, add Vercel Firewall rate-limit rules, for example:

- `POST /api/matches`: 10 requests per minute per IP.
- `POST /api/matches/*`: 120 requests per minute per IP (moves, joins and retries).

Whether these rules are configured in production is not recorded in the repository. Check the project's Firewall settings.

## Release check

After a production push:

1. Confirm the Vercel deployment for that exact commit is **Ready**.
2. `GET /api/health` on the production domain returns `{"ok":true}` (the database is reachable).
3. Smoke-test without signing in to Vercel: a local move and Undo, a computer reply, and an online invite between two independent browser profiles (Black orientation, moves in both directions, reconnect, Leave).

Local tests use isolated databases; they do not certify the production database configuration.
