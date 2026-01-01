# PlexRPC API (Cloudflare Worker)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](LICENSE) \
<a href="https://github.com/sponsors/malvinarum">
  <img src="https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=flat-square&logo=github&logoColor=white" alt="Sponsor on GitHub" />
</a>
<a href="https://www.patreon.com/malvinarum">
  <img src="https://img.shields.io/badge/Patreon-Support-f96854?style=flat-square&logo=patreon&logoColor=white" alt="Support on Patreon" />
</a>
<a href="https://www.buymeacoffee.com/malvinarum">
  <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-Donate-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black" alt="Buy Me A Coffee" />
</a> \
<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/malvinarum/PlexRPC-API-Cloudflare-Worker">
  <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" />
</a>
---

The official serverless backend service for **[PlexRPC](https://github.com/malvinarum/Plex-Rich-Presence)**.

This Cloudflare Worker acts as a secure middleware between the PlexRPC Windows client and various third-party metadata APIs (Spotify, TMDB, Google Books). It secures API keys server-side, provides a unified endpoint for rich metadata, and enforces client versioning.

## 🚀 Features

* **🎵 Music Metadata:** Authenticates with **Spotify** (Client Credentials Flow) to fetch high-res album art and track links.
* **🎬 Movie/TV Metadata:** Queries **TMDB** for movie posters and show details.
* **📖 Audiobook Metadata:** Searches **Google Books** for cover art and author info.
* **🛡️ Active Defense:** Includes in-memory **Rate Limiting** and **Auto-Banning** to protect API quotas from abusive clients.
* **🔐 Security:** Keeps all sensitive API keys (Spotify Secret, TMDB Key, etc.) in Cloudflare's secure vault.
* **📲 Version Enforcement:** Can "soft-block" obsolete clients by remotely injecting an "Update Required" notification into their Rich Presence.

## 🛠️ Prerequisites

* **Node.js** & **NPM** (Required to install Wrangler)
* **Cloudflare Account** (Free tier is sufficient)
* API Keys for:
    * [Spotify for Developers](https://developer.spotify.com/dashboard)
    * [The Movie Database (TMDB)](https://www.themoviedb.org/documentation/api)
    * [Google Books API](https://developers.google.com/books)

## 📥 Deployment

1.  **Install Wrangler (Cloudflare CLI):**
    ```bash
    npm install -g wrangler
    ```

2.  **Login to Cloudflare:**
    ```bash
    wrangler login
    ```

3.  **Configure Secrets:**
    You must set the following secrets in your Cloudflare Dashboard (under **Settings -> Variables**) or via the CLI:
    * `SPOTIFY_CLIENT_ID`
    * `SPOTIFY_CLIENT_SECRET`
    * `TMDB_API_KEY`
    * `GOOGLE_BOOKS_API_KEY`
    * `DISCORD_CLIENT_ID`

    *To set them via CLI:*
    ```bash
    wrangler secret put SPOTIFY_CLIENT_ID
    # (Repeat for all keys)
    ```

4.  **Configure Environment Variables:**
    Edit `wrangler.toml` to set your public configuration:
    ```toml
    [vars]
    SECURITY_MODE = "LOG_ONLY"      # Options: "LOG_ONLY" (Passive) or "STRICT" (Enforce rules)
    LATEST_CLIENT_VERSION = "2.1.0" # The version required to pass strict checks
    ```

5.  **Deploy to Production:**
    ```bash
    wrangler deploy
    ```

## ⚙️ Configuration & Security Modes

You can control the behavior of the API without redeploying code by changing the `SECURITY_MODE` variable in the Cloudflare Dashboard.

| Mode | Description |
| :--- | :--- |
| **`LOG_ONLY`** | **Default.** Logs Client UUIDs and Versions for analytics but allows all traffic. Rate limiting is disabled. Use this for testing/rollouts. |
| **`STRICT`** | **Active Defense.** Enforces UUID checks, enables Rate Limiting (30 req/min), and blocks old versions. |

### Passive Update Notification System
When in `STRICT` mode, if an outdated client (older than `LATEST_CLIENT_VERSION`) requests metadata, the Worker will **not** fetch real data. Instead, it returns a placeholder metadata payload containing an "Update Required" image and text. This naturally prompts the user to update by displaying the notification directly in their Rich Presence status.

## 📡 API Endpoints

### Metadata Lookups
* `GET /api/metadata/music?q={query}` - Returns Spotify track info & art.
* `GET /api/metadata/movie?q={query}` - Returns TMDB movie poster.
* `GET /api/metadata/tv?q={query}` - Returns TMDB TV show poster.
* `GET /api/metadata/book?q={query}` - Returns Google Books cover.

**Headers Required (Strict Mode):**
* `x-client-uuid`: A unique UUID v4 string.
* `x-app-version`: The semantic version of the client (e.g., "2.1.0").

### Configuration
* `GET /api/config/discord-id` 
  * Returns: `{ "client_id": "...", "latest_version": "2.1.0" }`
  * Used by the client to initialize Discord RPC and check for updates.

## 📜 License

This project is open-source. Feel free to fork, modify, and distribute.

## Disclaimer

**PlexRPC** is a community-developed, open-source project. It is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with **Plex, Inc.**, **Discord Inc.**, or any of their subsidiaries or affiliates.

* The official Plex website can be found at [https://www.plex.tv](https://www.plex.tv).
* The official Discord website can be found at [https://discord.com](https://discord.com).
