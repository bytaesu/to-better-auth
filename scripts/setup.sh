# Full test environment setup

set -e

echo "Better Auth Migration - Test Setup"
echo "=================================="
echo ""

# Start Supabase local
echo "[1/5] Starting Supabase local..."
if ! command -v supabase &> /dev/null; then
    echo "ERROR: Supabase CLI not installed"
    echo "Install: brew install supabase/tap/supabase"
    exit 1
fi

supabase start

echo ""
echo "Supabase started"
echo ""

# Extract service keys from status output
STATUS_OUTPUT=$(supabase status)

# Parse the output directly
DB_URL=$(echo "$STATUS_OUTPUT" | grep "DB URL:" | awk '{print $3}')
API_URL=$(echo "$STATUS_OUTPUT" | grep "API URL:" | awk '{print $3}')
ANON_KEY=$(echo "$STATUS_OUTPUT" | grep "anon key:" | awk '{print $3}')
SERVICE_KEY=$(echo "$STATUS_OUTPUT" | grep "service_role key:" | awk '{print $3}')

if [ -z "$DB_URL" ]; then
    echo "ERROR: Failed to get Supabase connection info"
    echo "Status output:"
    echo "$STATUS_OUTPUT"
    exit 1
fi

echo "Supabase Info:"
echo "  API URL: $API_URL"
echo "  DB URL: $DB_URL"
echo ""

# Start Better Auth database (empty Postgres)
echo "[2/5] Starting Better Auth database..."

if docker ps -a | grep -q better-auth-db; then
    echo "  Removing existing container..."
    docker rm -f better-auth-db
fi

docker run -d \
  --name better-auth-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=better_auth \
  -p 5433:5432 \
  postgres:15

echo "  Waiting for database..."
sleep 3

echo "Better Auth DB started"
echo "(Schema will be auto-created by Better Auth)"
echo ""

# Check/create .env
echo "[3/5] Checking .env..."

# Always create/update .env with current values
echo "  Creating/updating .env..."
cat > .env << EOF
FROM_DATABASE_URL=$DB_URL
TO_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/better_auth
BETTER_AUTH_URL=http://localhost:7777
BETTER_AUTH_SECRET=test-secret-key-change-in-production
SUPABASE_URL=$API_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
SUPABASE_ANON_KEY=$ANON_KEY
KAKAO_CLIENT_ID=dummy
KAKAO_CLIENT_SECRET=dummy
GOOGLE_CLIENT_ID=dummy
GOOGLE_CLIENT_SECRET=dummy
GITHUB_CLIENT_ID=dummy
GITHUB_CLIENT_SECRET=dummy
FACEBOOK_CLIENT_ID=dummy
FACEBOOK_CLIENT_SECRET=dummy
EOF
echo "  Environment file updated"
echo ""

# Load and export environment variables
set -a
source .env
set +a

# Create test users
echo "[4/5] Creating test users..."

# Re-export FROM_DATABASE_URL to be sure
export FROM_DATABASE_URL="$DB_URL"

CURRENT_COUNT=$(psql "$FROM_DATABASE_URL" -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | xargs)
echo "  Current users: ${CURRENT_COUNT:-0}"

read -p "  How many users to create? (default: 10000, 0 to skip): " USER_COUNT
USER_COUNT=${USER_COUNT:-10000}

if [ "$USER_COUNT" -gt 0 ]; then
    echo "  Using realistic user generation..."
    ./scripts/create-users.sh $USER_COUNT
else
    echo "  Skipping user creation"
fi

echo ""

# Verify user count
echo "[5/5] Verifying users..."
CREATED_COUNT=$(psql "$FROM_DATABASE_URL" -t -c "SELECT COUNT(*) FROM auth.users;")
echo "  Total users: $CREATED_COUNT"
echo ""

# Next steps
echo "Setup completed"
echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo ""
echo "1. Start migration server (new terminal):"
echo "   pnpm dev"
echo ""
echo "2. Start migration:"
echo "   curl -X POST http://localhost:7777/supabase/migrate \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"batchSize\": 5000}'"
echo ""
echo "3. Monitor progress:"
echo "   ./scripts/monitor.sh"
echo ""
echo "========================================"
