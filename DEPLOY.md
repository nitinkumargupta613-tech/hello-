# Deploying CivicSense

The application has three parts, and they live on three different services:

| Part | Where it goes | Why |
| --- | --- | --- |
| React web app | **Vercel** | A static build, which is exactly what Vercel serves best |
| FastAPI service | **Render / Railway / Fly.io** | Vercel cannot run a long-lived Python server |
| PostgreSQL + PostGIS | **Neon / Aiven / Supabase** | A managed database with the PostGIS extension |

> **Can the backend live on Vercel too?**
> Not as a server. Vercel runs stateless functions with a short execution
> limit, and this API keeps a database pool, loads a sentence-transformer
> model into memory and holds open HTTP connections. Wrapping it in a
> serverless function would mean rewriting the service, slowing it down
> and losing the model cache. Put the API on a Python host and keep Vercel
> for the web app, which is the arrangement this guide follows.

---

## 0. What you need before you start

- A GitHub repository with this project pushed
- A Vercel account (free tier is enough)
- A Neon account for the database (free tier is enough)
- A Render or Railway account for the API (free tier is enough)

Push the project first:

```powershell
cd D:\hakathon
git remote add origin https://github.com/<your-user>/civicsense.git
git push -u origin main
```

---

## 1. The database (Neon, with PostGIS)

Neon gives you a PostgreSQL database with the PostGIS extension.

1. Go to <https://console.neon.tech> → **Create a project**
2. Name it `civicsense`, pick the region closest to your users
   (`Azure India - West` or `AWS Asia Pacific` for Mumbai)
3. Neon asks for a plan → choose **Free**
4. Open the project → **Extensions** → add **postgis** → enable it
   (or run `CREATE EXTENSION IF NOT EXISTS postgis;` in the SQL editor)
5. Open **Connection string** → copy the **direct** (not the pooled) URI
   and swap the scheme for this project:

```
postgresql+psycopg://<user>:<password>@<host>/<database>?sslmode=require
```

> Use the **direct** connection string. The pooled one runs through
> PgBouncer, which breaks the prepared statements SQLAlchemy uses.
> For a demo with one or two API instances the direct URL is fine.

Keep this URL, you need it in step 2 and step 3.

---

## 2. The API (Render)

1. Go to <https://render.com> → **New** → **Web Service** → connect the
   GitHub repository
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Health Check Path**: `/health`
   - **Instance Type**: Free
3. **Environment variables**:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | the direct Neon URL from step 1 |
   | `CIVICSENSE_CORS_ORIGINS` | `http://localhost:5173` for now, your Vercel domain in step 4 |
   | `CIVICSENSE_CLIP_ENABLED` | `0` (leave the photo classifier off, see below) |

4. **Create Web Service** → the first build pulls the base image and
   installs the requirements, which takes a few minutes
5. When it is green, Render gives you a URL like
   `https://civicsense-api.onrender.com`
6. Check it: open `https://civicsense-api.onrender.com/health`

```json
{"status": "ok", "database": "ok", "model_version": "minilm-l6-v2@2026-10"}
```

`"database": "ok"` proves the API reached Neon. If it says `unavailable`,
the connection string is wrong.

### Load the schema and the sample data

Run this once against the production database, from your machine:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://<user>:<password>@<host>/<database>?sslmode=require"
cd D:\hakathon\backend
..\.venv\Scripts\python scripts\init_db.py
..\.venv\Scripts\python scripts\seed.py --reset
```

`init_db.py` creates the tables, enables PostGIS and writes the three
accounts. `seed.py --reset` loads 60 sample reports so the dashboard has
something to show.

### Turning the photo classifier on (optional)

CLIP makes the Docker image about 2 GB larger and the first request slower,
because the weights load on demand. To enable it, build the image with the
build argument:

```dockerfile
ARG INSTALL_CLIP=1
```

On Render, set the environment variable `INSTALL_CLIP=1` and add it to the
Docker build arguments, then set `CIVICSENSE_CLIP_ENABLED=1` and
`CIVICSENSE_CLIP_MODEL=openai/clip-vit-base-patch32` in the service
settings.

---

## 3. The web app (Vercel)

1. Go to <https://vercel.com> → **Add New** → **Project** → **Import** the
   repository
2. Project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. **Environment variables** → add:

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://civicsense-api.onrender.com` (your API URL) |

   This is the address the browser calls. Without it the app would look for
   `/api` on the Vercel domain and find nothing.
4. **Deploy** → Vercel builds and gives you `https://civicsense.vercel.app`

The `frontend/vercel.json` in the repository already handles the client
side routing, so `/dashboard`, `/login` and `/ticket` load the app instead
of returning a 404.

---

## 4. Let the two talk to each other

The browser calls the API from the Vercel domain, so the API has to allow
it.

1. Copy your Vercel URL, for example `https://civicsense.vercel.app`
2. In Render, open the service → **Environment** → set:

   ```
   CIVICSENSE_CORS_ORIGINS = http://localhost:5173,https://civicsense.vercel.app
   ```

3. **Save and restart** the service
4. Open the Vercel URL, sign in with `admin` / `1234` and check that the
   dashboard loads

If you add a custom domain later, add that domain to the same variable and
restart the API again.

---

## 5. Check the deployment

```powershell
# the API is alive and can reach the database
curl https://civicsense-api.onrender.com/health

# the admin login works against the production API
curl -X POST https://civicsense-api.onrender.com/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"admin\",\"password\":\"1234\"}'

# the queue comes back with a token
curl https://civicsense-api.onrender.com/complaints?limit=3 `
  -H "Authorization: Bearer <token from the step above>"
```

The acceptance suite can run against the live API as well:

```powershell
cd D:\hakathon\backend
..\.venv\Scripts\python scripts\verify.py
```

It expects the API on `http://127.0.0.1:8000`; change the `API` constant at
the top of the script to point at the deployed URL first.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Blank page, `GET /api/...` fails in the console | `VITE_API_URL` is missing or wrong on Vercel. Settings → Environment Variables → redeploy. |
| "Wrong username or password" but the credentials are right | The browser is calling a different API than the one you seeded. Check `VITE_API_URL`. |
| `CORS` error in the console | The Vercel domain is missing from `CIVICSENSE_CORS_ORIGINS` on the API. Add it and restart the API. |
| `/dashboard` returns 404 | The SPA rewrite is missing. `frontend/vercel.json` must be committed and the Root Directory must be `frontend`. |
| `/health` says `"database": "unavailable"` | The `DATABASE_URL` is wrong, or PostGIS is not enabled on the Neon project. |
| The first request takes 30 seconds | The sentence-transformer model loads on first use. It is cached in memory afterwards. |
| The API sleeps after 15 minutes | The Render free tier sleeps idle instances. The first request after a sleep takes a few seconds. |
| `relation "location_label" does not exist` | `init_db.py` has not been run against the production database. Run it from step 2. |

---

## Keeping costs down

- Vercel free: 100 GB bandwidth a month, more than a demo needs
- Neon free: 0.5 GB of storage, the seeded corpus is a few megabytes
- Render free: one instance that sleeps when idle, enough for a demo

If the API sleeps too often, upgrade that one service; the web app and the
database stay on the free tier.

---

## What is live after the three steps

| | |
| --- | --- |
| Web app | `https://civicsense.vercel.app` |
| API | `https://civicsense-api.onrender.com` |
| API docs | `https://civicsense-api.onrender.com/docs` |
| Admin | `admin` / `1234` |
| Database | Neon, PostgreSQL 16 with PostGIS |
