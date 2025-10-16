// Environment variable types for window.ENV
declare global {
  interface Window {
    ENV: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      API_URL: string;
    };
  }
}

export {};
