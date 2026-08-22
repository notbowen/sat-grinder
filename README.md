# SAT Grinder

A private, multi-user SAT practice app for medium and hard Reading & Writing and Math questions. It tracks mastery per user, immediately grades each response, and keeps missed questions in rotation until they are solved correctly on the first attempt of a later quiz.

## What it includes

- Dashboard totals for mastered, remaining, and review questions, plus progress by topic.
- Random practice from the entire eligible pool and topic practice across one or more domains or skills.
- Multiple-choice and student-produced numeric responses, including equivalent decimal/fraction grading.
- Unlimited retries within a quiz. A missed question never repeats in that same quiz, but returns in a future quiz.
- Admin-managed accounts. Public sign-up is disabled and temporary-password users must change their password.
- An admin-triggered College Board Educator Question Bank sync for authorized installations. Medium/hard questions are imported; questions identified by the source as live test items are retained only as excluded records and are never eligible for practice.
- SQLite, imported assets, and user progress stored together on one Fly Volume.

## Run locally

Requirements: Node.js 24+ and pnpm 11.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm admin:create -- --username admin --password 'replace-with-a-long-password' --name 'Administrator'
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Generate a real `BETTER_AUTH_SECRET` before using the app beyond local development:

```bash
openssl rand -base64 48
```

Administrators can create and disable users, reset temporary passwords, and start question-bank syncs from the application. Set `COLLEGE_BOARD_EQB_AUTHORIZED=true` only where you have written authorization to fetch and store the content. A CLI sync is also available:

```bash
pnpm question-bank:sync
```

## Data and mastery rules

`DATABASE_PATH` defaults to `.data/sat-grinder.sqlite`; imported images are written below `DATA_DIR/question-assets`. On Fly, both paths point at `/data` on the single attached volume.

- A correct first response in a quiz marks the question mastered and removes it from future practice.
- A wrong first response marks the question for review. The learner retries immediately until correct, but it stays in review.
- Solving that review question correctly on the first response of a future quiz marks it mastered.
- Sampling is uniform across all eligible unseen and review questions. A database uniqueness constraint prevents duplicates within one quiz.

Database migrations run automatically every time the production process starts. Manual commands are also available through `pnpm db:migrate` and `pnpm db:generate`.

## Tests and production build

```bash
pnpm lint
pnpm test
pnpm build
docker build -t sat-grinder .
```

The health check is available at `/api/health` and verifies SQLite access.

## Deploy manually behind Cloudflare Tunnel

The included `fly.toml` has no public Fly HTTP service. Instead, the production image runs Next.js and `cloudflared` together on the same machine, and the remotely managed tunnel connects to the app over loopback. This keeps the Fly origin off the public internet without adding a second machine that would conflict with the single-attached SQLite volume.

First, create the Cloudflare side of the tunnel. These are dashboard changes; they do not deploy the Fly app.

1. In **Cloudflare → Networking → Tunnels**, create a remotely managed tunnel named `sat-grinder`.
2. Choose the Docker connector instructions and copy only the `eyJ...` tunnel token. Do not commit it or put it in `fly.toml`.
3. Add a published application route for the production hostname, such as `sat.example.com`, with the service URL `http://localhost:3000`. The origin connection is local to the machine, so it does not need HTTPS or the **No TLS Verify** option.

The Fly app still deliberately uses one machine and one volume in Singapore. Change the app name and `primary_region` if needed, keeping the machine and volume in the same region. For a new app, create those resources once:

```bash
fly apps create sat-grinder
fly volumes create sat_grinder_data --region sin --size 1
```

Stage the production secrets without restarting or deploying the app. `BETTER_AUTH_URL` must exactly match the Cloudflare hostname, and the tunnel token must remain a Fly secret:

```bash
fly secrets set --stage \
  BETTER_AUTH_SECRET="$(openssl rand -base64 48)" \
  BETTER_AUTH_URL="https://sat.example.com" \
  TUNNEL_TOKEN="<paste-the-eyJ...-token>" \
  COLLEGE_BOARD_EQB_AUTHORIZED=true
```

When you are ready to perform the cutover, review the staged changes and deploy manually:

```bash
fly secrets list
fly deploy
fly scale count 1
```

After confirming that the Cloudflare hostname and `/api/health` work, `https://sat-grinder.fly.dev` should no longer serve the app because there is no Fly service configured. An existing app can also release its now-unused Fly addresses after listing and checking each exact address:

```bash
fly ips list
fly ips release <unused-address>
```

Create the first administrator after deployment. The script accepts command arguments or `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME` environment variables:

```bash
fly ssh console
ADMIN_USERNAME=admin ADMIN_PASSWORD='replace-with-a-long-password' pnpm admin:create
```

Then sign in and run the first sync from **Admin → Question bank**. The sync stages a complete replacement and leaves the currently usable bank untouched if any download or validation step fails.

This architecture intentionally supports exactly one application machine. SQLite is on a single-attached Fly Volume and must not be scaled horizontally. The one `cloudflared` process maintains multiple connections to Cloudflare, but it is not a second application replica. Fly Volumes are local to one host and are not automatically replicated, so configure volume snapshots/backups for data recovery.

## Main environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file path; `/data/sat-grinder.sqlite` on Fly |
| `DATA_DIR` | Root for imported question assets; `/data` on Fly |
| `BETTER_AUTH_URL` | Canonical origin, including `https://` in production |
| `BETTER_AUTH_SECRET` | Random authentication signing secret; required in production |
| `CLOUDFLARE_TUNNEL_ENABLED` | Starts `cloudflared` with the app; set to `true` by `fly.toml` |
| `TUNNEL_TOKEN` | Remotely managed Cloudflare Tunnel token; store only as a Fly secret |
| `COLLEGE_BOARD_EQB_AUTHORIZED` | Must equal `true` before a bank sync is allowed |
