# PlexRPC API (Cloudflare Worker)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/malvinarum/PlexRPC-API-Cloudflare-Worker/blob/main/LICENSE)
[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa)](https://github.com/sponsors/malvinarum)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow)](https://www.buymeacoffee.com/malvinarum)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/malvinarum/PlexRPC-API-Cloudflare-Worker)

The official serverless backend service for **[PlexRPC](https://github.com/malvinarum/Plex-Rich-Presence)**.

This Cloudflare Worker acts as a secure middleware between the PlexRPC Windows client and various third-party metadata APIs (Deezer, TMDB, Google Books). It secures API keys server-side, provides a unified endpoint for rich metadata, and enforces client versioning.

## 🚀 Features

- **🎵 Music Metadata:** Queries **Deezer** to fetch high-res album art and track links.
- **🎬 Movie/TV Metadata:** Queries **TMDB** for movie and show posters.
- **📖 Audiobook Metadata:** Searches **Google Books** for cover art and author info.
- **🛡️ Active Defense:** Includes in-memory **Rate Limiting** and **Auto-Banning** to protect API quotas from abusive clients.
- **🔐 Security:** Keeps all sensitive API keys (TMDB Key, Google Books Key, etc.) in Cloudflare's secure vault.
- **📲 Version Enforcement:** Can "soft-block" obsolete clients by remotely injecting an "Update Required" notification into their Rich Presence.

## 🛠️ Prerequisites

- **Node.js** & **NPM** (Required to install Wrangler)
- **Cloudflare Account** (Free tier is sufficient)
- API Keys for:
  * [The Movie Database (TMDB)](https://www.themoviedb.org/documentation/api)
  * [Google Books API](https://developers.google.com/books)

## 📥 Deployment

1. **Install Wrangler (Cloudflare CLI):**

```
npm install -g wrangler
```

2. **Login to Cloudflare:**

```
wrangler login
```

3. **Configure Secrets:** You must set the following secrets in your Cloudflare Dashboard (under **Settings -> Variables**) or via the CLI:

  - `TMDB_API_KEY`
  - `GOOGLE_BOOKS_API_KEY`
  - `DISCORD_CLIENT_ID`

    *To set them via CLI:*

```
wrangler secret put TMDB_API_KEY
# (Repeat for all keys)
```

4. **Configure Environment Variables:** Edit `wrangler.toml` to set your public configuration:

```
[vars]
SECURITY_MODE = "LOG_ONLY"      # Options: "LOG_ONLY" (Passive) or "STRICT" (Enforce rules)
LATEST_CLIENT_VERSION = "2.1.0" # The version required to pass strict checks
```

5. **Deploy to Production:**

```
wrangler deploy
```

## ⚙️ Configuration & Security Modes

You can control the behavior of the API without redeploying code by changing the `SECURITY_MODE` variable in the Cloudflare Dashboard.

| Mode           | Description                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`LOG_ONLY`** | **Default.** Logs Client UUIDs and Versions for analytics but allows all traffic. Rate limiting is disabled. Use this for testing/rollouts. |
| **`STRICT`**   | **Active Defense.** Enforces UUID checks, enables Rate Limiting (5 req/min per client), and blocks old versions.                            |

### Passive Update Notification System

When in `STRICT` mode, if an outdated client (older than `LATEST_CLIENT_VERSION`) requests metadata, the Worker will **not** fetch real data. Instead, it returns a placeholder metadata payload containing an "Update Required" image and text. This naturally prompts the user to update by displaying the notification directly in their Rich Presence status.

## 📡 API Endpoints

### Metadata Lookups

- `GET /api/metadata/music?q={query}&album={album}` - Returns Deezer track info & art. `album` is optional and used to disambiguate re-releases/compilations.
- `GET /api/metadata/movie?q={query}` - Returns TMDB movie poster.
- `GET /api/metadata/tv?q={query}` - Returns TMDB TV show poster.
- `GET /api/metadata/book?q={query}` - Returns Google Books cover.

**Headers Required (Strict Mode):**

- `x-client-uuid`: A unique UUID v4 string.
- `x-app-version`: The semantic version of the client (e.g., "2.1.0").

### Configuration

- `GET /api/config/discord-id`
  * Returns: `{ "client_id": "...", "latest_version": "2.3.0" }`
  * Used by the client to initialize Discord RPC and check for updates.

## 📜 License

This project is open-source. Feel free to fork, modify, and distribute.

## Disclaimer

**PlexRPC** is a community-developed, open-source project. It is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with **Plex, Inc.**, **Discord Inc.**, or any of their subsidiaries or affiliates.

- The official Plex website can be found at <https://www.plex.tv>.
- The official Discord website can be found at <https://discord.com>.
