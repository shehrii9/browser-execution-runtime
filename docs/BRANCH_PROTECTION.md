# Protect `main` (branch protection)

GitHub prompts you to protect `main` so changes go through pull requests and CI. This repo’s workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) with two required jobs:

| Check name (job) | What it runs |
|------------------|--------------|
| **test** | typecheck, unit tests, browser smoke, build, pack check |
| **rust** | `cargo test` / build for `ber-core` |

Use those exact names when GitHub asks which status checks are required.

---

## Option A — GitHub UI (recommended)

1. Open **Settings** → **Branches** (or click **Protect this branch** on the banner).
2. Under **Branch protection rules** → **Add branch protection rule**  
   *Or* **Rules** → **Rulesets** → **New ruleset** → target branch `main`.

### Recommended settings (solo or small team)

| Setting | Value | Why |
|---------|--------|-----|
| Branch / target | `main` | |
| Require a pull request before merging | **On** | No direct pushes to `main` |
| Required approvals | **0** (or 1 if you want a second pair of eyes) | Solo maintainers do not need a reviewer |
| Require status checks to pass | **On** | CI must be green |
| Status checks | **test**, **rust** | Both CI jobs |
| Require branches to be up to date | **On** (`strict`) | Merge only after rebasing on latest `main` |
| Allow force pushes | **Off** | Keeps history predictable |
| Allow deletions | **Off** | Prevents deleting `main` |
| Allow administrators to bypass | **On** (optional) | Emergency fixes without disabling the rule |

3. Save the rule / activate the ruleset.

### If `test` / `rust` do not appear in the dropdown

Status checks are listed only after they have run at least once on a PR. Open any PR (or re-run CI on [#36](https://github.com/shehrii9/browser-execution-runtime/pull/36)) and wait for **Actions** to finish, then pick **test** and **rust**.

---

## Option B — `gh` CLI (admin token on your machine)

From a clone of this repo, with `gh auth login` as a user who **owns** the repository:

```bash
./scripts/github-protect-main.sh
```

Or paste the API call from that script if you prefer to edit checks first.

---

## After protection is enabled

- **Contributors:** branch off `main`, open a PR, wait for green CI. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **Maintainers:** merge via **Squash merge** or **Merge commit** (your choice under Settings → General).
- **Direct push to `main`** will be rejected unless you use admin bypass (if enabled).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Merge button disabled, “Required status check … is expected” | Re-run failed workflow; ensure both **test** and **rust** completed on the PR commit |
| Browser smoke flaky on CI | Re-run job; if it keeps failing, fix or adjust `test:browser` separately — do not drop all checks |
| Need hotfix on `main` | Use admin bypass, or merge a PR with a fix; avoid turning protection off permanently |
