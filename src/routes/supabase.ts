import { Hono } from 'hono';
import { migrateFromSupabase, stateManager } from '@/lib/supabase/migration';
import { migrationConfig } from '@/lib/supabase/migration.config';

const app = new Hono();

app.get('/status', async (c) => {
  const state = stateManager.getState();

  return c.json({
    ...state,
    progress: `${stateManager.getProgress()}%`,
    eta: stateManager.getETA(),
    errors: state.errors.slice(0, 10),
  });
});

app.post('/migrate', async (c) => {
  const currentState = stateManager.getState();
  if (currentState.status === 'running') {
    return c.json(
      {
        error: 'Migration already in progress',
        state: currentState,
      },
      400,
    );
  }

  migrateFromSupabase({
    batchSize: migrationConfig.batchSize,
    resumeFromId: migrationConfig.resumeFromId,
  }).catch((error) => {
    console.error('Migration failed:', error);
  });

  return c.json({
    message: 'Migration started',
    config: migrationConfig,
  });
});

export default app;
