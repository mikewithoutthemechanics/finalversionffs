#!/bin/bash
# Apply Supabase schema using your access token
# Run with: bash apply-schema.sh
#
# Required environment variables:
#   SUPABASE_ACCESS_TOKEN - Your Supabase access token (from https://supabase.com/dashboard/account/tokens)
#   SUPABASE_PROJECT_REF  - Your Supabase project reference

# Check if environment variables are set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
    echo "   Get your token from: https://supabase.com/dashboard/account/tokens"
    echo "   Example: export SUPABASE_ACCESS_TOKEN='your_token'"
    exit 1
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ Error: SUPABASE_PROJECT_REF environment variable is not set"
    echo "   Example: export SUPABASE_PROJECT_REF='your_project_ref'"
    exit 1
fi

echo "🔄 Installing Supabase CLI if needed..."
npm install -g supabase

echo "🔄 Logging in with access token..."
echo "$SUPABASE_ACCESS_TOKEN" | supabase login

echo "🔄 Linking to project $SUPABASE_PROJECT_REF..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "🔄 Pushing schema..."
supabase db push

echo "✅ Done! Run 'node test-supabase-connection.js' to verify."
