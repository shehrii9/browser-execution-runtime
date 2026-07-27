# Protect `main` (branch protection)

GitHub prompts you to protect `main` so changes go through pull requests and CI. Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Which status check to require

Prefer **one** required check (simplest in the UI):

| Check name | Meaning |
|------------|---------|
| **`all`** | Both **test** and **rust** must succeed (aggregate job) |

You can instead require **test** and **rust** separately if they appear in the list.

---

## Checks missing from the dropdown?

GitHub only lists checks that have **run recently** on this repo (often on `main` or an open PR). Try in order:

### 1. Run CI on `main` manually

1. **Actions** → workflow **CI** → **Run workflow** → branch **`main`** → **Run workflow**.
2. Wait until the run finishes (green is best, but checks still register if red).
3. Open branch protection again and search for **`all`**.

(`workflow_dispatch` is enabled in `ci.yml` for this.)

### 2. Search the right label

In **Rulesets** or **Branch protection**, use the search box and type:

- `all` (recommended)
- or `test`, `rust`

Some UIs group under the workflow name **CI** — expand **CI** and tick jobs there.

### 3. Type the name manually (Rulesets)

**Settings → Rules → Rulesets →** your `main` rule → **Require status checks** → **Add check** → type **`all`** even if autocomplete is empty → **Add**.

### 4. Use classic rules if Rulesets are empty

**Settings → Branches → Branch protection rules → Add rule** (classic), not only Rulesets. Classic UI often populates checks after step 1.

### 5. Confirm Actions are on

**Settings → Actions → General** → allow Actions for this repository.

---

## Recommended settings (solo or small team)

| Setting | Value |
|---------|--------|
| Branch / target | `main` |
| Require a pull request before merging | **On** |
| Required approvals | **0** (solo) or **1** |
| Require status checks to pass | **On** |
| Status checks | **`all`** (or **test** + **rust**) |
| Require branches to be up to date | **On** |
| Allow force pushes | **Off** |
| Allow administrators to bypass | **On** (optional) |

---

## After protection is enabled

- Branch off `main`, open a PR, wait for green **`all`** (or **test** + **rust**). See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Direct push to `main` is blocked unless admin bypass is enabled.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No checks in list at all | Run **CI** on `main` (step 1 above); enable Actions |
| Only `rust` appears, not `test` | Require **`all`** instead of individual jobs |
| Merge blocked, check “Expected” | Re-run failed jobs on the PR commit |
| `test` fails on browser smoke | Re-run; CI runs browser tests in a single fork to reduce flakes |
