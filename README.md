# PlexRPC API (Cloudflare Worker)

The official serverless backend service for **[PlexRPC](https://github.com/malvinarum/Plex-Rich-Presence)**.

This Cloudflare Worker acts as a secure middleware between the PlexRPC Windows client and various third-party metadata APIs (Spotify, TMDB, Google Books). It secures API keys server-side and provides a unified endpoint for rich metadata with zero latency.

## 🚀 Features

* **🎵 Music Metadata:** Authenticates with **Spotify** (Client Credentials Flow) to fetch high-res album art and track links.
* **🎬 Movie/TV Metadata:** Queries **TMDB** for movie posters and show details.
* **📖 Audiobook Metadata:** Searches **Google Books** for cover art and author info.
* **🔐 Security:** Keeps all sensitive API keys (Spotify Secret, TMDB Key, etc.) in Cloudflare's secure vault, keeping the client "configless" and secure.
* **⚙️ Dynamic Config:** Serves global configuration (like the Discord App ID) to allow client updates without re-compiling.

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

4.  **Deploy to Production:**
    ```bash
    wrangler deploy
    ```

## 📡 API Endpoints

### Metadata Lookups
* `GET /api/metadata/music?q={query}` - Returns Spotify track info & art.
* `GET /api/metadata/movie?q={query}` - Returns TMDB movie poster.
* `GET /api/metadata/tv?q={query}` - Returns TMDB TV show poster.
* `GET /api/metadata/book?q={query}` - Returns Google Books cover.

### Configuration
* `GET /api/config/discord-id` - Returns the active Discord Client ID.

## 📜 License

This project is open-source. Feel free to fork, modify, and distribute.

## Disclaimer

**PlexRPC** is a community-developed, open-source project. It is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with **Plex, Inc.**, **Discord Inc.**, or any of their subsidiaries or affiliates.

* The official Plex website can be found at [https://www.plex.tv](https://www.plex.tv).
* The official Discord website can be found at [https://discord.com](https://discord.com).

The names "Plex", "Discord", as well as related names, marks, emblems, and images are registered trademarks of their respective owners. This application is intended for personal, non-commercial use only.
