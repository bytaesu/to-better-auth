/**
 * Migration status
 */
type MigrationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Migration state
 */
type MigrationState = {
  status: MigrationStatus;
  totalUsers: number;
  processedUsers: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  currentBatch: number;
  totalBatches: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastProcessedId: string | null;
  errors: Array<{ userId: string; error: string }>;
};

/**
 * Migration state management
 * Track progress and support resume for large-scale migrations
 */
export class MigrationStateManager {
  private state: MigrationState = {
    status: 'idle',
    totalUsers: 0,
    processedUsers: 0,
    successCount: 0,
    failureCount: 0,
    skipCount: 0,
    currentBatch: 0,
    totalBatches: 0,
    startedAt: null,
    completedAt: null,
    lastProcessedId: null,
    errors: [],
  };

  start(totalUsers: number, batchSize: number) {
    this.state = {
      status: 'running',
      totalUsers,
      processedUsers: 0,
      successCount: 0,
      failureCount: 0,
      skipCount: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(totalUsers / batchSize),
      startedAt: new Date(),
      completedAt: null,
      lastProcessedId: null,
      errors: [],
    };
  }

  updateProgress(
    processed: number,
    success: number,
    failure: number,
    skip: number,
    lastId: string | null,
  ) {
    this.state.processedUsers += processed;
    this.state.successCount += success;
    this.state.failureCount += failure;
    this.state.skipCount += skip;
    this.state.currentBatch++;
    if (lastId) {
      this.state.lastProcessedId = lastId;
    }
  }

  addError(userId: string, error: string) {
    // Keep max 100 errors in memory
    if (this.state.errors.length < 100) {
      this.state.errors.push({ userId, error });
    }
  }

  complete() {
    this.state.status = 'completed';
    this.state.completedAt = new Date();
  }

  fail() {
    this.state.status = 'failed';
    this.state.completedAt = new Date();
  }

  pause() {
    this.state.status = 'paused';
  }

  getState(): MigrationState {
    return { ...this.state };
  }

  getProgress(): number {
    if (this.state.totalUsers === 0) return 0;
    return Math.round((this.state.processedUsers / this.state.totalUsers) * 100);
  }

  getETA(): string | null {
    if (!this.state.startedAt || this.state.processedUsers === 0) {
      return null;
    }

    const elapsed = Date.now() - this.state.startedAt.getTime();
    const avgTimePerUser = elapsed / this.state.processedUsers;
    const remainingUsers = this.state.totalUsers - this.state.processedUsers;
    const remainingMs = avgTimePerUser * remainingUsers;

    const seconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
