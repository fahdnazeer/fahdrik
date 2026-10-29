// Paste your Google OAuth "Web application" Client ID here (see setup steps).
window.GOOGLE_CLIENT_ID = "";

// Supabase. Create a project at https://supabase.com/dashboard then paste:
// Project Settings → API → Project URL and anon public key.
// Leave empty to keep data on this device only.
window.SUPABASE = {
  url: "https://onkxsuboohmmecroweia.supabase.co",
  anonKey: "sb_publishable_ZM4NL0bTSAEmVm_RrYzsXA_AVSZ-Yg_",
};
// Only these Google accounts can sync. Anyone else is signed out immediately.
window.FAHDRIK_EMAILS = [
  "fahd@fahd.no",
  "eagogstad@gmail.com",
];

// Optional alternative to OMDb: free key from themoviedb.org (Settings → API).
window.TMDB_KEY = "";

// Optional (recommended): free key from omdbapi.com/apikey.aspx. Gives IMDb titles and IMDb's own posters.
window.OMDB_KEY = "9990f3d9";

// Secret for the Google Calendar subscribe link. Same value as Edge Function secret FAHDRIK_ICS_TOKEN.
window.FAHDRIK_ICS_TOKEN = "b2da988d219d94865acd8f3dc26a9ef0";
