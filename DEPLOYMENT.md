# PickleFinder Deployment Guide

## Environment Setup

This app uses separate databases for **development** and **production**.

### Local Files (Ignored by Git)
- `.env.development` - Development database credentials
- `.env.production` - Production database credentials (optional for local testing)

---

## Step 1: Create Two PostgreSQL Databases in Railway

1. Go to [railway.app](https://railway.app) and open your PickleFinder project
2. Create two PostgreSQL databases:
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"** (for Production)
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"** again (for Development)
3. Rename them for clarity:
   - Right-click first database → "Settings" → Name: `PostgreSQL-Production`
   - Right-click second database → "Settings" → Name: `PostgreSQL-Development`

---

## Step 2: Get Database Connection Strings

For **each** PostgreSQL database:

1. Click on the database service
2. Go to **"Connect"** tab
3. Copy the **"Postgres Connection URL"** (should look like):
   ```
   postgresql://postgres:PASSWORD@HOST.railway.app:PORT/railway
   ```

You'll need:
- **Development Database URL** from PostgreSQL-Development
- **Production Database URL** from PostgreSQL-Production

---

## Step 3: Configure Local Environment

### Update `.env.development`:

```bash
# Development Database
DATABASE_URL=postgresql://postgres:YOUR_DEV_PASSWORD@your-dev-host.railway.app:5432/railway

# Port
PORT=3000

# Environment
NODE_ENV=development
```

### Update `.env.production` (optional, only if testing production locally):

```bash
# Production Database
DATABASE_URL=postgresql://postgres:YOUR_PROD_PASSWORD@your-prod-host.railway.app:5432/railway

# Port
PORT=3000

# Environment
NODE_ENV=production
```

---

## Step 4: Configure Railway Production Environment

1. In Railway, click on your **web service** (PickleFinder app)
2. Go to **"Variables"** tab
3. Add/update these variables:
   - `DATABASE_URL` - Paste your **Production** database URL
   - `NODE_ENV` - Set to `production`
4. Railway will automatically redeploy

---

## Running the App

### Local Development (uses `.env.development`):
```bash
npm run dev
```

### Local Production Test (uses `.env.production`):
```bash
npm run prod
```

### Production on Railway:
- Railway automatically runs `npm start`
- Uses environment variables set in Railway dashboard
- No `.env` files are deployed (they're in `.gitignore`)

---

## Database Tables

Tables are created automatically on first run:

**Players Table:**
- `id` (auto-increment)
- `name` (required)
- `available` (1 or 0, default: 1)
- `created_at` (timestamp)

**Matches Table:**
- `id` (auto-increment)
- `player1_id`, `player2_id`, `player3_id`, `player4_id` (foreign keys)
- `match_group` (match session number)
- `num_courts` (number of courts for this match)
- `created_at` (timestamp)

---

## Deployment Checklist

- [ ] Create two PostgreSQL databases in Railway (Dev & Prod)
- [ ] Copy both database URLs
- [ ] Update `.env.development` with Dev database URL
- [ ] Set `DATABASE_URL` in Railway web service to Prod database URL
- [ ] Push code to GitHub
- [ ] Railway auto-deploys
- [ ] Generate domain in Railway: Settings → Networking → Generate Domain
- [ ] Visit your app URL!

---

## Troubleshooting

### "Cannot connect to database"
- Check that DATABASE_URL is correct in `.env.development`
- Verify the database is running in Railway
- Make sure you're using the **Public URL** (not `.railway.internal`)

### "Module not found"
- Run `npm install` to install all dependencies

### "Port already in use"
- Kill the process: `lsof -ti:3000 | xargs kill -9`
- Or use a different port: `PORT=3001 npm run dev`

### Railway deployment fails
- Check Railway logs for errors
- Verify `DATABASE_URL` is set in Railway variables
- Make sure you pushed latest code to GitHub

