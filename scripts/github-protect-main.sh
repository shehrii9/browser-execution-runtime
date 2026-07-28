#!/usr/bin/env bash
# Apply branch protection to main (requires repo admin: gh auth login).
# Status check names must match CI job names in .github/workflows/ci.yml
set -euo pipefail

OWNER="${GITHUB_OWNER:-shehrii9}"
REPO="${GITHUB_REPO:-browser-execution-runtime}"
BRANCH="${GITHUB_BRANCH:-main}"

echo "Protecting ${OWNER}/${REPO} branch ${BRANCH} (requires admin)..."
echo "Required checks: test, rust"
echo

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test", "rust"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

echo
echo "Done. Verify: gh api repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
