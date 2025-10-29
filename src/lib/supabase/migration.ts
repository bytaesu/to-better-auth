import { generateId } from 'better-auth';
import { auth } from './auth';
import { fromDB, toDB } from './db';
import { migrationConfig } from './migration.config';
import { MigrationStateManager } from './migration.state';
import type { AccountInsertData, SupabaseUserFromDB, UserInsertData } from './types';

type MigrateBatchOptions = {
  batchSize?: number;
  resumeFromId?: string | null;
  onProgress?: (state: any) => void;
};

export const stateManager = new MigrationStateManager();

let ctxCache: {
  hasAnonymousPlugin: boolean;
  hasAdminPlugin: boolean;
  hasPhoneNumberPlugin: boolean;
  supportedProviders: string[];
} | null = null;

async function processBatch(
  users: SupabaseUserFromDB[],
  ctx: any,
): Promise<{
  success: number;
  failure: number;
  skip: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  const stats = {
    success: 0,
    failure: 0,
    skip: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  };

  if (!ctxCache) {
    ctxCache = {
      hasAdminPlugin: ctx.options.plugins?.some((p: any) => p.id === 'admin') || false,
      hasAnonymousPlugin: ctx.options.plugins?.some((p: any) => p.id === 'anonymous') || false,
      hasPhoneNumberPlugin: ctx.options.plugins?.some((p: any) => p.id === 'phone-number') || false,
      supportedProviders: Object.keys(ctx.options.socialProviders || {}),
    };
  }

  const { hasAdminPlugin, hasAnonymousPlugin, hasPhoneNumberPlugin, supportedProviders } = ctxCache;

  const validUsersData: Array<{ user: SupabaseUserFromDB; userData: UserInsertData }> = [];

  for (const user of users) {
    if (!user.email && !user.phone) {
      stats.skip++;
      continue;
    }
    if (!user.email && !hasPhoneNumberPlugin) {
      stats.skip++;
      continue;
    }
    if (user.deleted_at) {
      stats.skip++;
      continue;
    }
    if (user.banned_until && !hasAdminPlugin) {
      stats.skip++;
      continue;
    }

    const getTempEmail = (phone: string) =>
      `${phone.replace(/[^0-9]/g, '')}@${migrationConfig.tempEmailDomain}`;

    const getName = (): string => {
      // Try name fields from user metadata
      if (user.raw_user_meta_data?.name) return user.raw_user_meta_data.name;
      if (user.raw_user_meta_data?.full_name) return user.raw_user_meta_data.full_name;
      if (user.raw_user_meta_data?.username) return user.raw_user_meta_data.username;
      if (user.raw_user_meta_data?.user_name) return user.raw_user_meta_data.user_name;

      // Try name fields from identity data
      const firstId = user.identities?.[0];
      if (firstId?.identity_data?.name) return firstId.identity_data.name;
      if (firstId?.identity_data?.full_name) return firstId.identity_data.full_name;
      if (firstId?.identity_data?.username) return firstId.identity_data.username;
      if (firstId?.identity_data?.preferred_username)
        return firstId.identity_data.preferred_username;

      // Fallback to email or phone
      if (user.email) return user.email.split('@')[0]!;
      if (user.phone) return user.phone;

      return 'Unknown';
    };

    const getImage = (): string | undefined => {
      if (user.raw_user_meta_data?.avatar_url) return user.raw_user_meta_data.avatar_url;
      if (user.raw_user_meta_data?.picture) return user.raw_user_meta_data.picture;
      const firstId = user.identities?.[0];
      if (firstId?.identity_data?.avatar_url) return firstId.identity_data.avatar_url;
      if (firstId?.identity_data?.picture) return firstId.identity_data.picture;
      return undefined;
    };

    // Build user data
    const userData: UserInsertData = {
      id: user.id,
      email: user.email || (user.phone ? getTempEmail(user.phone) : null),
      emailVerified: !!user.email_confirmed_at,
      name: getName(),
      image: getImage(),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    if (hasAnonymousPlugin) userData.isAnonymous = user.is_anonymous;
    if (hasPhoneNumberPlugin && user.phone) {
      userData.phoneNumber = user.phone;
      userData.phoneNumberVerified = !!user.phone_confirmed_at;
    }

    if (hasAdminPlugin) {
      userData.role = user.is_super_admin ? 'admin' : user.role || 'user';
      if (user.banned_until) {
        const banExpires = new Date(user.banned_until);
        if (banExpires > new Date()) {
          userData.banned = true;
          userData.banExpires = banExpires;
          userData.banReason = 'Migrated from Supabase (banned)';
        } else {
          userData.banned = false;
        }
      } else {
        userData.banned = false;
      }
    }

    if (user.raw_user_meta_data && Object.keys(user.raw_user_meta_data).length > 0) {
      userData.userMetadata = user.raw_user_meta_data;
    }
    if (user.raw_app_meta_data && Object.keys(user.raw_app_meta_data).length > 0) {
      userData.appMetadata = user.raw_app_meta_data;
    }
    if (user.invited_at) userData.invitedAt = user.invited_at;
    if (user.last_sign_in_at) userData.lastSignInAt = user.last_sign_in_at;

    validUsersData.push({ user, userData });
  }

  if (validUsersData.length === 0) {
    return stats;
  }

  // Bulk INSERT in a single transaction
  // PostgreSQL has a parameter limit (~65535), so we need to chunk large batches
  try {
    await toDB.query('BEGIN');

    const allFields = new Set<string>();
    validUsersData.forEach(({ userData }) => {
      Object.keys(userData).forEach((key) => allFields.add(key));
    });
    const fields = Array.from(allFields);

    // Calculate safe chunk size: 65000 / number of fields per user
    const maxParamsPerQuery = 65000;
    const fieldsPerUser = fields.length;
    const usersPerChunk = Math.floor(maxParamsPerQuery / fieldsPerUser);

    // Process in chunks
    for (let i = 0; i < validUsersData.length; i += usersPerChunk) {
      const chunk = validUsersData.slice(i, i + usersPerChunk);

      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const { userData } of chunk) {
        const userPlaceholders = fields.map((field) => {
          values.push(userData[field] ?? null);
          return `$${paramIndex++}`;
        });
        placeholders.push(`(${userPlaceholders.join(', ')})`);
      }

      await toDB.query(
        `
        INSERT INTO "user" (${fields.map((f) => `"${f}"`).join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `,
        values,
      );
    }

    const accountsData: AccountInsertData[] = [];

    for (const { user } of validUsersData) {
      for (const identity of user.identities ?? []) {
        if (identity.provider === 'email') {
          accountsData.push({
            id: generateId(),
            userId: user.id,
            providerId: 'credential',
            accountId: user.id,
            password: user.encrypted_password || null, // null for passwordless users
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          });
        }

        if (supportedProviders.includes(identity.provider)) {
          accountsData.push({
            id: generateId(),
            userId: user.id,
            providerId: identity.provider,
            accountId: identity.identity_data?.sub || identity.provider_id,
            password: null,
            createdAt: identity.created_at ?? user.created_at,
            updatedAt: identity.updated_at ?? user.updated_at,
          });
        }
      }
    }

    if (accountsData.length > 0) {
      // Chunk accounts too (to avoid parameter limit)
      const maxParamsPerQuery = 65000;
      const fieldsPerAccount = 7;
      const accountsPerChunk = Math.floor(maxParamsPerQuery / fieldsPerAccount);

      for (let i = 0; i < accountsData.length; i += accountsPerChunk) {
        const chunk = accountsData.slice(i, i + accountsPerChunk);

        const accountPlaceholders: string[] = [];
        const accountValues: any[] = [];
        let paramIndex = 1;

        for (const acc of chunk) {
          accountPlaceholders.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
          );
          accountValues.push(
            acc.id,
            acc.userId,
            acc.providerId,
            acc.accountId,
            acc.password,
            acc.createdAt,
            acc.updatedAt,
          );
        }

        await toDB.query(
          `
          INSERT INTO "account" ("id", "userId", "providerId", "accountId", "password", "createdAt", "updatedAt")
          VALUES ${accountPlaceholders.join(', ')}
          ON CONFLICT ("id") DO NOTHING
        `,
          accountValues,
        );
      }
    }

    await toDB.query('COMMIT');
    stats.success = validUsersData.length;
  } catch (error: any) {
    await toDB.query('ROLLBACK');
    console.error('[TRANSACTION] Batch failed, rolled back:', error.message);
    stats.failure = validUsersData.length;
    if (stats.errors.length < 100) {
      stats.errors.push({ userId: 'bulk', error: error.message });
    }
  }

  return stats;
}

/**
 * Optimized batch migration with bulk inserts
 */
export async function migrateFromSupabase(options: MigrateBatchOptions = {}) {
  const { batchSize = 5000, resumeFromId = null, onProgress } = options;

  console.log('[MIGRATION] Function called with options:', options);

  const ctx = await auth.$context;

  console.log('[MIGRATION] Auth context loaded');

  try {
    console.log('[MIGRATION] Querying total user count...');

    // Get total user count
    const countResult = await fromDB.query<{ count: string }>(
      `
      SELECT COUNT(*) as count FROM auth.users
      ${resumeFromId ? 'WHERE id > $1' : ''}
    `,
      resumeFromId ? [resumeFromId] : [],
    );

    console.log('[MIGRATION] Query result:', countResult.rows);

    const totalUsers = parseInt(countResult.rows[0]?.count || '0', 10);

    console.log(
      `[MIGRATION] Starting OPTIMIZED migration for ${totalUsers.toLocaleString()} users`,
    );
    console.log(`[MIGRATION] Batch size: ${batchSize} (using bulk inserts)\n`);

    stateManager.start(totalUsers, batchSize);

    console.log(
      '[MIGRATION] State manager started, current status:',
      stateManager.getState().status,
    );

    let lastProcessedId: string | null = resumeFromId;
    let hasMore = true;
    let batchNumber = 0;

    while (hasMore) {
      batchNumber++;
      const batchStart = Date.now();

      // Fetch batch (cursor-based pagination)
      const result = await fromDB.query<SupabaseUserFromDB>(
        `
        SELECT 
          u.*,
          COALESCE(
            json_agg(
              i.* ORDER BY i.id
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as identities
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
        ${lastProcessedId ? 'WHERE u.id > $1' : ''}
        GROUP BY u.id
        ORDER BY u.id ASC
        LIMIT $${lastProcessedId ? '2' : '1'}
      `,
        lastProcessedId ? [lastProcessedId, batchSize] : [batchSize],
      );

      const batch = result.rows;
      hasMore = batch.length === batchSize;

      if (batch.length === 0) break;

      console.log(
        `\nBatch ${batchNumber}/${Math.ceil(totalUsers / batchSize)} (${batch.length} users)`,
      );

      // Process batch with bulk operations
      const stats = await processBatch(batch, ctx);

      lastProcessedId = batch[batch.length - 1]!.id;
      stateManager.updateProgress(
        batch.length,
        stats.success,
        stats.failure,
        stats.skip,
        lastProcessedId,
      );

      stats.errors.forEach((err) => stateManager.addError(err.userId, err.error));

      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);
      const usersPerSec = (batch.length / parseFloat(batchTime)).toFixed(0);

      const state = stateManager.getState();
      console.log(`Success: ${stats.success} | Skip: ${stats.skip} | Failure: ${stats.failure}`);
      console.log(
        `Progress: ${stateManager.getProgress()}% (${state.processedUsers.toLocaleString()}/${state.totalUsers.toLocaleString()})`,
      );
      console.log(`Speed: ${usersPerSec} users/sec (${batchTime}s for this batch)`);

      const eta = stateManager.getETA();
      if (eta) {
        console.log(`ETA: ${eta}`);
      }

      if (onProgress) {
        onProgress(state);
      }
    }

    stateManager.complete();
    const finalState = stateManager.getState();

    console.log('\nMigration completed');
    console.log(`Success: ${finalState.successCount.toLocaleString()}`);
    console.log(`Skipped: ${finalState.skipCount.toLocaleString()}`);
    console.log(`Failed: ${finalState.failureCount.toLocaleString()}`);

    const totalTime =
      finalState.completedAt && finalState.startedAt
        ? ((finalState.completedAt.getTime() - finalState.startedAt.getTime()) / 1000 / 60).toFixed(
            1,
          )
        : '0';
    console.log(`Total time: ${totalTime} minutes`);

    if (finalState.errors.length > 0) {
      console.log(`\nFirst ${Math.min(10, finalState.errors.length)} errors:`);
      finalState.errors.slice(0, 10).forEach((err) => {
        console.log(`  - User ${err.userId}: ${err.error}`);
      });
    }

    return finalState;
  } catch (error) {
    console.error('[MIGRATION] Error occurred:', error);
    stateManager.fail();
    console.error('\nMigration failed:', error);
    throw error;
  } finally {
    console.log('[MIGRATION] Cleaning up database connections...');
    await fromDB.end();
    await toDB.end();
    console.log('[MIGRATION] Cleanup completed');
  }
}
