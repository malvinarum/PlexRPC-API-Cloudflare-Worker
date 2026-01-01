// --- 🚦 RATE LIMIT CONFIGURATION ---
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;             // Max requests per window
const BAN_DURATION = 5 * 60 * 1000;  // 5 minutes ban if limit exceeded

// Global state for rate limiting (Persists per-worker instance)
const clients = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.searchParams.get('q');

    // --- ⚙️ CONFIGURATION ---
    // Set these in Cloudflare Dashboard -> Settings -> Variables
    const SECURITY_MODE = env.SECURITY_MODE || "LOG_ONLY"; 
    const LATEST_VERSION = env.LATEST_CLIENT_VERSION || "2.1.0";
    const UPDATE_URL = "https://github.com/malvinarum/Plex-Rich-Presence/releases";

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    const json = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: corsHeaders });

    // --- 🔍 INSPECT HEADERS ---
    const clientVersion = request.headers.get('x-app-version') || "UNKNOWN";
    const clientUuid = request.headers.get('x-client-uuid') || "UNKNOWN";
    const isConfigRoute = path.startsWith('/api/config/');

    // Analytics Log
    console.log(`[${SECURITY_MODE}] Path: ${path} | Ver: ${clientVersion} | UUID: ${clientUuid}`);

    // --- 🔒 SECURITY & RATE LIMITING (STRICT MODE ONLY) ---
    if (SECURITY_MODE === "STRICT") {
      
      // 1. HANDLE OLD CLIENTS (Missing UUID)
      // Instead of blocking with 401, we send the "Update Required" payload.
      if (clientUuid === "UNKNOWN" && !isConfigRoute) {
         return json({
           found: true,
           title: `Update to v${LATEST_VERSION}`,
           line1: "⚠️ Update Required",
           line2: `Please install v${LATEST_VERSION}`,
           image: "https://malvinarum.com/plexrpc_update.png", 
           url: UPDATE_URL
         });
      }

      // 2. Rate Limiting (Only runs if we have a valid UUID)
      if (!isConfigRoute && clientUuid !== "UNKNOWN") {
        const now = Date.now();
        let client = clients.get(clientUuid) || { count: 0, windowStart: now, bannedUntil: 0 };

        // A. Check Ban Status
        if (client.bannedUntil > now) {
          const remainingSeconds = Math.ceil((client.bannedUntil - now) / 1000);
          console.warn(`[BLOCKED] UUID: ${clientUuid} is banned for ${remainingSeconds}s`);
          return json({ error: `Too many requests. You are banned for ${remainingSeconds} seconds.` }, 429);
        }

        // B. Reset Window
        if (now - client.windowStart > RATE_LIMIT_WINDOW) {
          client.count = 1;
          client.windowStart = now;
          client.bannedUntil = 0;
        } else {
          client.count++;
        }

        // C. Trigger Ban
        if (client.count > MAX_REQUESTS) {
          client.bannedUntil = now + BAN_DURATION;
          console.warn(`[BANNING] UUID: ${clientUuid} exceeded limit (${MAX_REQUESTS}/min)`);
          clients.set(clientUuid, client);
          return json({ error: "Rate limit exceeded. You are banned for 5 minutes." }, 429);
        }
        clients.set(clientUuid, client);
      }

      // 3. Enforce Version (For clients that HAVE a UUID but are outdated)
      if (clientVersion !== "UNKNOWN" && 
          clientVersion.localeCompare(LATEST_VERSION, undefined, { numeric: true, sensitivity: 'base' }) < 0 && 
          !isConfigRoute) {
         
         return json({
           found: true,
           title: `Update to v${LATEST_VERSION}`,
           line1: "⚠️ Update Required",
           line2: `Please install v${LATEST_VERSION}`,
           image: "https://raw.githubusercontent.com/malvinarum/Plex-Rich-Presence/refs/heads/main/assets/icon.png", 
           url: UPDATE_URL
         });
      }
    }

    try {
      // --- ROUTE: MUSIC (Spotify) ---
      if (path === '/api/metadata/music') {
        if (!query) return json({ error: "No query provided" }, 400);

        const token = await getSpotifyToken(env);
        if (!token) return json({ error: "Service unavailable" }, 500);

        const searchParams = new URLSearchParams({ q: query, type: 'track', limit: '1' });
        
        const spotifyRes = await fetch(`https://api.spotify.com/v1/search?${searchParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await spotifyRes.json();
        const track = data.tracks?.items?.[0];

        if (track) {
          return json({
            found: true,
            title: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            image: track.album.images[0]?.url,
            url: track.external_urls.spotify
          });
        }
        return json({ found: false });
      }

      // --- ROUTE: MOVIES (TMDB) ---
      if (path === '/api/metadata/movie') {
        if (!query) return json({ found: false });
        
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
        const data = await tmdbRes.json();
        const result = data.results?.[0];

        if (result && result.poster_path) {
          return json({
            found: true,
            title: result.title,
            image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
            url: `https://www.themoviedb.org/movie/${result.id}`
          });
        }
        return json({ found: false });
      }

      // --- ROUTE: TV SHOWS (TMDB) ---
      if (path === '/api/metadata/tv') {
        if (!query) return json({ found: false });

        const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
        const data = await tmdbRes.json();
        const result = data.results?.[0];

        if (result && result.poster_path) {
          return json({
            found: true,
            title: result.name,
            image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
            url: `https://www.themoviedb.org/tv/${result.id}`
          });
        }
        return json({ found: false });
      }

      // --- ROUTE: BOOKS (Google Books) ---
      if (path === '/api/metadata/book') {
        if (!query) return json({ found: false });

        const booksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${env.GOOGLE_BOOKS_API_KEY}&maxResults=1`);
        const data = await booksRes.json();
        const result = data.items?.[0]?.volumeInfo;

        if (result && result.imageLinks?.thumbnail) {
          return json({
            found: true,
            title: result.title,
            image: result.imageLinks.thumbnail.replace('http://', 'https://'),
            url: result.infoLink
          });
        }
        return json({ found: false });
      }

      // --- ROUTE: CONFIG ---
      if (path === '/api/config/discord-id') {
        // Send Client ID AND Latest Version so client can notify user of updates
        return json({ 
            client_id: env.DISCORD_CLIENT_ID || "MISSING_ID",
            latest_version: LATEST_VERSION
        });
      }

      return json({ error: "Not Found" }, 404);

    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};

// --- SPOTIFY TOKEN LOGIC ---
let cachedToken = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(env) {
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  try {
    const auth = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) throw new Error('Failed to fetch token');

    const data = await tokenRes.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return cachedToken;
  } catch (error) {
    console.error("Spotify Auth Failed:", error);
    return null;
  }
}
