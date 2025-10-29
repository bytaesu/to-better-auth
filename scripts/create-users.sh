# Create realistic test users covering various real-world scenarios

set -e

USER_COUNT=${1:-10000}

echo "Creating $USER_COUNT realistic test users..."
echo ""

# Get Supabase DB URL
if [ -z "$FROM_DATABASE_URL" ]; then
    DB_URL=$(supabase status -o json | jq -r '.db_url')
else
    DB_URL=$FROM_DATABASE_URL
fi

echo "Target: $DB_URL"
echo ""

# Get current max user number to avoid duplicates
CURRENT_MAX=$(psql "$DB_URL" -t -c "SELECT COALESCE(MAX(CAST(SUBSTRING(email FROM 'user([0-9]+)@') AS INTEGER)), 0) FROM auth.users WHERE email LIKE 'user%@%';" 2>/dev/null | xargs)
CURRENT_MAX=${CURRENT_MAX:-0}
START_INDEX=$((CURRENT_MAX + 1))
END_INDEX=$((START_INDEX + USER_COUNT - 1))

echo "Starting from index: $START_INDEX"
echo ""

# Execute realistic bulk INSERT with various user scenarios
psql "$DB_URL" << EOF
\timing on

-- Insert diverse users with realistic scenarios
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_anonymous,
    banned_until,
    deleted_at,
    confirmation_token,
    recovery_token
)
SELECT
    gen_random_uuid() AS id,
    '00000000-0000-0000-0000-000000000000' AS instance_id,
    
    -- Email: 95% have email, 5% phone-only
    CASE 
        WHEN i % 20 = 0 THEN NULL
        ELSE CASE 
            WHEN i % 10 = 0 THEN 'admin.' || i || '@company.com'
            WHEN i % 7 = 0 THEN 'test.user' || i || '@gmail.com'
            WHEN i % 5 = 0 THEN 'john.doe' || i || '@outlook.com'
            WHEN i % 3 = 0 THEN 'user' || i || '@yahoo.com'
            ELSE 'user' || i || '@example.com'
        END
    END AS email,
    
    -- Password: 90% have password (email users), 10% OAuth-only
    CASE 
        WHEN i % 10 = 0 THEN NULL
        ELSE '\$2a\$10\$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    END AS encrypted_password,
    
    -- Email confirmed: 80% confirmed immediately, 15% within 1 week, 5% never
    CASE 
        WHEN i % 20 = 0 THEN NULL
        WHEN i % 7 = 0 THEN NOW() - (random() * interval '7 days')
        ELSE NOW() - (random() * interval '365 days')
    END AS email_confirmed_at,
    
    -- Phone: 30% have phone numbers
    CASE 
        WHEN i % 3 = 0 THEN '+1' || lpad((i % 9000000000 + 1000000000)::text, 10, '0')
        WHEN i % 5 = 0 THEN '+82' || lpad((i % 90000000 + 10000000)::text, 9, '0')
        WHEN i % 20 = 0 THEN '+44' || lpad((i % 9000000000 + 1000000000)::text, 10, '0')
        ELSE NULL
    END AS phone,
    
    -- Phone confirmed: 70% of phone users confirmed
    CASE 
        WHEN i % 3 = 0 AND i % 10 != 0 THEN NOW() - (random() * interval '180 days')
        ELSE NULL
    END AS phone_confirmed_at,
    
    -- Created: Random dates over past 2 years
    NOW() - (random() * interval '730 days') AS created_at,
    
    -- Updated: Between created and now
    NOW() - (random() * interval '30 days') AS updated_at,
    
    -- Last sign in: 70% active users, 30% inactive
    CASE 
        WHEN i % 3 = 0 THEN NULL
        WHEN i % 2 = 0 THEN NOW() - (random() * interval '7 days')
        ELSE NOW() - (random() * interval '90 days')
    END AS last_sign_in_at,
    
    'authenticated' AS aud,
    
    -- Role: 95% user, 4% moderator, 1% admin
    CASE 
        WHEN i % 100 = 0 THEN 'admin'
        WHEN i % 25 = 0 THEN 'moderator'
        ELSE 'authenticated'
    END AS role,
    
    -- App metadata
    json_build_object(
        'provider', CASE 
            WHEN i % 10 = 0 THEN 'google'
            WHEN i % 8 = 0 THEN 'github'
            WHEN i % 12 = 0 THEN 'facebook'
            ELSE 'email'
        END,
        'providers', ARRAY['email']
    ) AS raw_app_meta_data,
    
    -- User metadata with realistic variations
    json_build_object(
        'name', CASE 
            WHEN i % 7 = 0 THEN 'John Doe ' || i
            WHEN i % 5 = 0 THEN 'Jane Smith ' || i
            WHEN i % 3 = 0 THEN 'Bob Johnson ' || i
            ELSE 'User ' || i
        END,
        'username', CASE 
            WHEN i % 2 = 0 THEN 'user' || i
            ELSE 'username_' || i
        END,
        'avatar_url', CASE 
            WHEN i % 3 = 0 THEN 'https://avatars.githubusercontent.com/u/' || i
            WHEN i % 5 = 0 THEN 'https://i.pravatar.cc/150?u=' || i
            ELSE NULL
        END,
        'age', (i % 60 + 18),
        'country', CASE 
            WHEN i % 4 = 0 THEN 'US'
            WHEN i % 4 = 1 THEN 'KR'
            WHEN i % 4 = 2 THEN 'UK'
            ELSE 'JP'
        END,
        'bio', CASE 
            WHEN i % 2 = 0 THEN 'Software developer from ' || (i % 100)::text
            ELSE NULL
        END,
        'test', true
    ) AS raw_user_meta_data,
    
    -- Super admin: 0.1%
    CASE WHEN i % 1000 = 0 THEN true ELSE false END AS is_super_admin,
    
    -- Anonymous: 5%
    CASE WHEN i % 20 = 0 THEN true ELSE false END AS is_anonymous,
    
    -- Banned: 2% temporarily banned, 1% permanently
    CASE 
        WHEN i % 100 = 0 THEN NOW() + interval '999 years'
        WHEN i % 50 = 0 THEN NOW() + (random() * interval '30 days')
        ELSE NULL
    END AS banned_until,
    
    -- Deleted: 3% soft deleted
    CASE 
        WHEN i % 33 = 0 THEN NOW() - (random() * interval '90 days')
        ELSE NULL
    END AS deleted_at,
    
    -- Confirmation token: 5% pending confirmation
    CASE 
        WHEN i % 20 = 0 THEN encode(gen_random_bytes(32), 'hex')
        ELSE ''
    END AS confirmation_token,
    
    -- Recovery token: 1% in recovery process
    CASE 
        WHEN i % 100 = 0 THEN encode(gen_random_bytes(32), 'hex')
        ELSE ''
    END AS recovery_token
    
FROM generate_series($START_INDEX, $END_INDEX) AS i;

-- Create identities for OAuth users (30% of users)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    'google-oauth2|' || substr(u.id::text, 1, 20),
    'google',
    json_build_object(
        'sub', 'google-oauth2|' || substr(u.id::text, 1, 20),
        'email', u.email,
        'name', u.raw_user_meta_data->>'name',
        'avatar_url', 'https://lh3.googleusercontent.com/a/default-user',
        'email_verified', true,
        'provider', 'google'
    ),
    u.last_sign_in_at,
    u.created_at,
    u.updated_at
FROM auth.users u
WHERE u.raw_user_meta_data->>'test' = 'true'
AND ('x' || substr(md5(u.id::text), 1, 8))::bit(32)::int % 3 = 0
LIMIT GREATEST(($END_INDEX - $START_INDEX + 1) / 3, 1);

-- Create GitHub identities (15% of users)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    substr(u.id::text, 1, 20),
    'github',
    json_build_object(
        'sub', substr(u.id::text, 1, 20),
        'email', u.email,
        'name', u.raw_user_meta_data->>'name',
        'preferred_username', u.raw_user_meta_data->>'username',
        'avatar_url', 'https://avatars.githubusercontent.com/u/' || abs(hashtext(u.id::text)),
        'user_name', u.raw_user_meta_data->>'username',
        'provider', 'github'
    ),
    u.last_sign_in_at,
    u.created_at,
    u.updated_at
FROM auth.users u
WHERE u.raw_user_meta_data->>'test' = 'true'
AND ('x' || substr(md5(u.id::text), 1, 8))::bit(32)::int % 7 = 0
LIMIT GREATEST(($END_INDEX - $START_INDEX + 1) / 7, 1);

-- Create email/password identities for remaining users
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    u.id::text,
    'email',
    json_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', (u.email_confirmed_at IS NOT NULL),
        'provider', 'email'
    ),
    u.last_sign_in_at,
    u.created_at,
    u.updated_at
FROM auth.users u
WHERE u.raw_user_meta_data->>'test' = 'true'
AND u.email IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM auth.identities i 
    WHERE i.user_id = u.id
);

-- Statistics
SELECT 
    'Total users' AS metric,
    COUNT(*) AS count
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
UNION ALL
SELECT 
    'With email',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND email IS NOT NULL
UNION ALL
SELECT 
    'With phone',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND phone IS NOT NULL
UNION ALL
SELECT 
    'Email confirmed',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND email_confirmed_at IS NOT NULL
UNION ALL
SELECT 
    'Anonymous',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND is_anonymous = true
UNION ALL
SELECT 
    'Banned',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND banned_until IS NOT NULL
UNION ALL
SELECT 
    'Deleted',
    COUNT(*)
FROM auth.users
WHERE raw_user_meta_data->>'test' = 'true'
AND deleted_at IS NOT NULL
UNION ALL
SELECT 
    'Total identities',
    COUNT(*)
FROM auth.identities i
JOIN auth.users u ON i.user_id = u.id
WHERE u.raw_user_meta_data->>'test' = 'true';

\timing off
EOF

echo ""
echo "Realistic user creation completed"
echo ""
echo "User scenarios created:"
echo "  - Email users (95%) with various providers"
echo "  - Phone-only users (5%)"
echo "  - OAuth users (Google, GitHub, Facebook)"
echo "  - Active/inactive users"
echo "  - Admin, moderator, regular users"
echo "  - Confirmed/unconfirmed accounts"
echo "  - Banned users (temporary and permanent)"
echo "  - Soft-deleted users"
echo "  - Anonymous users"
echo ""
echo "Verify:"
echo "  psql \$FROM_DATABASE_URL -c 'SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>\"test\" = \"true\";'"
