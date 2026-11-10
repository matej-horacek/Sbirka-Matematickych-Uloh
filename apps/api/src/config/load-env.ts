// Loads apps/api/.env (DATA_SOURCE, DATABASE_URL, PORT) before any module reads the environment.
// Must be the first import of main.ts: AppModule picks the repositories when it is imported.
try {
  process.loadEnvFile();
} catch {
  // no .env file: the real environment is all there is
}
