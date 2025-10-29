# `Migrate to BETTER-AUTH.`

This repository provides a setup for migrating from other authentication systems to **Better Auth**.

The code here has been load-tested, but should be treated as an **example** implementation — feel free to adjust it to fit your workflow.

---

## Supabase -> Better Auth

All Supabase-related migration logic can be found under `/lib/supabase`.  
To minimize data loss during migration, the `admin`, `anonymous`, and `phoneNumber` plugins are preconfigured.

### 1. Configure environment variables

```dotenv
BETTER_AUTH_URL=http://localhost:7777
BETTER_AUTH_SECRET=******
FROM_DATABASE_URL=****** # Supabase database connection string
TO_DATABASE_URL=******   # Target Postgres database connection string
```

### 2. Match your Supabase social providers

Go to `/lib/supabase/auth.ts` and make sure the social providers match the ones you have enabled in your Supabase project.

```ts
  socialProviders: {
    // IMPORTANT: Add the social providers you have enabled in Supabase below.
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
```

### 3. Create the Better Auth schema in the target database

```bash
pnpm run migrate:supabase
```

### 4. Run the local server

```bash
pnpm dev
```

### 5. Start the migration and monitor its progress

Once migration begins, monitor the process and verify that all data has been safely transferred.

```bash
# Start the migration process
curl -X POST http://localhost:7777/supabase/migrate

# Check the current migration status
curl -X GET http://localhost:7777/supabase/status
```

**That’s it!**

You can now extend the auth instance in `/lib/supabase/auth.ts` to own your auth with Better Auth.

---

## Limitations

Continuous, zero-downtime migrations are not directly supported, as they depend on specific infrastructure setups. This repository serves as a **reference implementation** designed to provide a safe migration flow with minimal data loss and minimal downtime.

If you encounter any issues during the migration process or need help, please open an issue on this repository.
