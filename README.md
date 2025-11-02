# Islam Media Kids Site

Modern, lightweight static site with interactive Quran & Hadith of the Day, Prayer Times, mini Radio player, Kids Zone promo, News/Blog feed, and Netlify Functions for server-side features.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/huzaifahp1989/islam-mediakids2)
[![CI](https://github.com/huzaifahp1989/islam-mediakids2/actions/workflows/ci.yml/badge.svg)](https://github.com/huzaifahp1989/islam-mediakids2/actions/workflows/ci.yml)

## Project Structure

- Static pages and assets in the repository root (index.html, styles.css, scripts/main.js, assets/)
- Netlify Functions in `netlify/functions/` (e.g., `feed.js` for WordPress RSS)
- Optional Express backend in `backend/` for local development and extended APIs (auth, content, upload)

## Features

- Quran & Hadith of the Day widget with audio, copy, and share
- Prayer Times widget with geolocation and next prayer countdown
- Floating mini radio player (lazy-stream initialization, safe play/pause)
- Kids Zone promo + sections for Learn, Games, Stories
- News/Blog feed via Netlify Function (`/api/feed/latest`)
- Theme and language toggles
- Newsletter modal and WhatsApp button
- Performance and accessibility oriented (lazy actions, ARIA labels, semantic HTML)

## Local Development

1) Serve static files (choose one):
- `npx http-server -p 3002 -c-1` (or any static server)
- `npx serve -l 3002`

2) Optional: Run the Express backend for local APIs (port 3001):
- `cd backend`
- `npm install`
- `npm start`

3) Open the site:
- http://localhost:3002/

The homepage will call `http://localhost:3001/api` in local dev for the feed. If the backend is not running, the site will fall back to parsing RSS via a CORS proxy (AllOrigins) for preview convenience.

## Deployment (Netlify)

This project is designed to deploy as a static site with serverless functions.

1) Push to GitHub
- Initialize repo and push to a GitHub remote (example):
```
git init
git add .
git commit -m "Deploy: redesigned UI, radio, feed function"
git branch -M main
git remote add origin https://github.com/<your-username>/islam-mediakids2.git
git push -u origin main
```

2) Deploy via Netlify
- Netlify Dashboard > Add new site > Import from Git > pick this repo
- Build settings:
  - Base directory: (empty)
  - Build command: (empty)
  - Publish directory: `.`
  - Functions directory: `netlify/functions` (also in netlify.toml)

3) Verify
- Open your Netlify site URL (e.g., https://<your-site>.netlify.app)
- Check `/api/feed/latest?limit=4` returns JSON with `success: true` and `items: []`

4) Custom domain (optional)
- Add `imediackids.com` in Netlify > Domain management
- Point DNS to Netlify per instructions
- `netlify.toml` includes HTTPS and canonical redirects for production

## Netlify Functions

- `netlify/functions/feed.js`: Fetches latest articles from WordPress RSS and returns simplified JSON for the homepage.
- Endpoint mapping:
  - Browser calls `/api/feed/latest?limit=4`
  - Netlify redirects `/api/*` to `/.netlify/functions/:splat` per `netlify.toml`
  - The extra path segment (latest) is accepted by the function; handler returns items regardless of the segment.

## Backend (Optional)

`backend/` contains an Express server with routes for auth, content, users, upload, and a feed proxy. It is not used in Netlify deployments, but useful during local development or if deploying a full API on a separate host.

### Environment Variables

- `backend/.env.example` shows typical variables. Avoid committing `.env` files.
- CORS configuration in `backend/server.js` allows any localhost/127.* origin in development and whitelisted production domains.

## Contributing / Maintenance

- Keep features light and performant for mobile users
- Use semantic HTML and ARIA where applicable
- Prefer serverless functions for small backend features (e.g., RSS parsing)
- If you add new endpoints, consider porting them to Netlify Functions or deploying the Express app on a service like Render/Railway

### Continuous Integration (GitHub Actions)

Basic CI is configured in `.github/workflows/ci.yml` to ensure key files exist and serverless code loads without syntax errors on every push and pull request.

## Roadmap

- Learn & Explore carousel and section transitions
- Enhanced blog cards with filters and Load More
- App promotion section with “Coming Soon” countdown
- Upgraded radio/podcast player with episode feed support
- Performance: lazy-load images, reduce JS footprint, responsive polish
