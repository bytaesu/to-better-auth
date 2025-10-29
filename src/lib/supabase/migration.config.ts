/**
 * Migration configuration
 * Adjust these settings based on your requirements
 */
export const migrationConfig = {
  /**
   * Number of users to process in each batch
   * Higher values = faster migration but more memory usage
   * Recommended: 5000-10000 for most cases
   */
  batchSize: 5000,
  /**
   * Resume from a specific user ID (cursor-based pagination)
   * Useful for resuming interrupted migrations
   * Set to null to start from the beginning
   */
  resumeFromId: null as string | null,
  /**
   * Temporary email domain for phone-only users
   * Phone-only users need an email for Better Auth
   * Format: {phone_number}@{tempEmailDomain}
   * Example: "010-1234-5678" → "01012345678@temp.better-auth.com"
   *
   * After completing the migration, allow users to change their email
   */
  tempEmailDomain: 'temp.better-auth.com',
};
