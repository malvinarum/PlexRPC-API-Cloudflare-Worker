// --- 🚦 RATE LIMIT CONFIGURATION ---
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5;             // Max requests per window
const BAN_DURATION = 5 * 60 * 1000;  // 5 minutes ban if limit exceeded

// Global state for rate limiting & caching (Persists per-worker instance)
const clients = new Map();
const apiCache = new Map(); // Edge Memory Cache

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.searchParams.get('q');

    // --- ⚙️ CONFIGURATION ---
    const SECURITY_MODE = env.SECURITY_MODE || "LOG_ONLY"; 
    const LATEST_VERSION = env.LATEST_CLIENT_VERSION || "2.3.0";
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

    // --- 🔒 SECURITY & RATE LIMITING (STRICT MODE ONLY) ---
    if (SECURITY_MODE === "STRICT") {
      if (clientUuid === "UNKNOWN" && !isConfigRoute) {
         return json({
           found: true,
           title: `Update to v${LATEST_VERSION}`,
           line1: "⚠️ Update Required",
           line2: `Please install v${LATEST_VERSION}`,
           image: "https://raw.githubusercontent.com/malvinarum/Plex-Rich-Presence/refs/heads/main/assets/icon.png", 
           url: UPDATE_URL
         });
      }

      if (!isConfigRoute && clientUuid !== "UNKNOWN") {
        const now = Date.now();
        let client = clients.get(clientUuid) || { count: 0, windowStart: now, bannedUntil: 0 };

        if (client.bannedUntil > now) {
          const remainingSeconds = Math.ceil((client.bannedUntil - now) / 1000);
          console.warn(`[BLOCKED] UUID: ${clientUuid} is banned for ${remainingSeconds}s`);
          return json({ error: `Too many requests. You are banned for ${remainingSeconds} seconds.` }, 429);
        }

        if (now - client.windowStart > RATE_LIMIT_WINDOW) {
          client.count = 1;
          client.windowStart = now;
          client.bannedUntil = 0;
        } else {
          client.count++;
        }

        if (client.count > MAX_REQUESTS) {
          client.bannedUntil = now + BAN_DURATION;
          console.warn(`[BANNING] UUID: ${clientUuid} exceeded limit (${MAX_REQUESTS}/min)`);
          clients.set(clientUuid, client);
          return json({ error: "Rate limit exceeded. You are banned for 5 minutes." }, 429);
        }
        clients.set(clientUuid, client);
      }

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
      // --- 🧠 EDGE SHIELD CACHE (Intercept Before Upstream) ---
      const cacheKey = url.pathname + url.search;
      if (path.startsWith('/api/metadata/') && apiCache.has(cacheKey)) {
          const cached = apiCache.get(cacheKey);
          if (Date.now() < cached.expires) {
              return json(cached.data);
          }
          apiCache.delete(cacheKey); // Expired, clear it out
      }

      // --- ROUTE: MUSIC (iTunes) ---
      if (path === '/api/metadata/music') {
        if (!query) return json({ error: "No query provided" }, 400);
        
        const targetAlbum = url.searchParams.get('album') || "";

        try {
          const searchParams = new URLSearchParams({ 
            term: query, 
            entity: 'song', 
            limit: '50' 
          });
          
          const itunesRes = await fetch(`https://itunes.apple.com/search?${searchParams}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          });
          
          if (!itunesRes.ok) {
            console.error(`iTunes API Blocked Request: ${itunesRes.status}`);
            if (itunesRes.status === 429) {
                // Apple is furious. Cache a graceful fallback for 5 minutes to soak up the client spam.
                const fallback = { found: false };
                apiCache.set(cacheKey, { data: fallback, expires: Date.now() + (5 * 60 * 1000) });
                return json(fallback);
            }
            return json({ error: "Upstream metadata service unavailable" }, 502); 
          }

          const data = await itunesRes.json();
          
          if (!data.results || data.results.length === 0) {
              const notFound = { found: false };
              apiCache.set(cacheKey, { data: notFound, expires: Date.now() + (60 * 60 * 1000) }); // Cache missing tracks for 1 hr
              return json(notFound);
          }

          let bestMatch = data.results[0];

          if (targetAlbum) {
             const targetLower = targetAlbum.toLowerCase();
             for (const track of data.results) {
                 if (track.collectionName && track.collectionName.toLowerCase().includes(targetLower)) {
                     bestMatch = track;
                     break; 
                 }
             }
          }

          const payload = {
            found: true,
            title: bestMatch.trackName,
            artist: bestMatch.artistName,
            album: bestMatch.collectionName,
            image: bestMatch.artworkUrl100?.replace('100x100bb', '600x600bb'),
            url: bestMatch.trackViewUrl
          };

          apiCache.set(cacheKey, { data: payload, expires: Date.now() + (24 * 60 * 60 * 1000) }); // Cache success for 24 hrs
          return json(payload);

        } catch (error) {
          return json({ error: "Service unavailable" }, 500);
        }
      }

      // --- ROUTE: MOVIES (TMDB) ---
      if (path === '/api/metadata/movie') {
        if (!query) return json({ found: false });
        
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
        const data = await tmdbRes.json();
        const result = data.results?.[0];

        if (result && result.poster_path) {
          const payload = {
            found: true,
            title: result.title,
            image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
            url: `https://www.themoviedb.org/movie/${result.id}`
          };
          apiCache.set(cacheKey, { data: payload, expires: Date.now() + (24 * 60 * 60 * 1000) });
          return json(payload);
        }
        
        const notFound = { found: false };
        apiCache.set(cacheKey, { data: notFound, expires: Date.now() + (60 * 60 * 1000) });
        return json(notFound);
      }

      // --- ROUTE: TV SHOWS (TMDB) ---
      if (path === '/api/metadata/tv') {
        if (!query) return json({ found: false });

        const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
        const data = await tmdbRes.json();
        const result = data.results?.[0];

        if (result && result.poster_path) {
          const payload = {
            found: true,
            title: result.name,
            image: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
            url: `https://www.themoviedb.org/tv/${result.id}`
          };
          apiCache.set(cacheKey, { data: payload, expires: Date.now() + (24 * 60 * 60 * 1000) });
          return json(payload);
        }

        const notFound = { found: false };
        apiCache.set(cacheKey, { data: notFound, expires: Date.now() + (60 * 60 * 1000) });
        return json(notFound);
      }

      // --- ROUTE: BOOKS (Google Books) ---
      if (path === '/api/metadata/book') {
        if (!query) return json({ found: false });

        const booksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${env.GOOGLE_BOOKS_API_KEY}&maxResults=1`);
        const data = await booksRes.json();
        const result = data.items?.[0]?.volumeInfo;

        if (result && result.imageLinks?.thumbnail) {
          const payload = {
            found: true,
            title: result.title,
            image: result.imageLinks.thumbnail.replace('http://', 'https://'),
            url: result.infoLink
          };
          apiCache.set(cacheKey, { data: payload, expires: Date.now() + (24 * 60 * 60 * 1000) });
          return json(payload);
        }

        const notFound = { found: false };
        apiCache.set(cacheKey, { data: notFound, expires: Date.now() + (60 * 60 * 1000) });
        return json(notFound);
      }

      // --- ROUTE: CONFIG ---
      if (path === '/api/config/discord-id') {
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
