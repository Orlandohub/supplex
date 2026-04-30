# Repository Rulesets

This directory holds the source-of-truth definitions for the GitHub
[repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
that protect this repo's important branches.

Keeping these definitions in the repo (rather than only in GitHub
Settings) is deliberate — the policy is reviewable, diffable, and
re-creatable from scratch if it ever gets accidentally deleted from
the UI.

> **Heads-up:** these JSON files are *not* automatically applied by
> CI. They are the canonical *spec*; applying or updating a ruleset
> against `Orlandohub/supplex` requires repo-admin permissions and
> is done out-of-band via `gh api` (see below).

---

## `main.json` — `main`-branch protection

Tracks [SUP-7](https://linear.app/supplex/issue/SUP-7) sub-task 9b
(landed under [SUP-23](https://linear.app/supplex/issue/SUP-23)).

### What it enforces

| Rule | Setting | Why |
| -- | -- | -- |
| `deletion` | block | `main` cannot be deleted, ever. |
| `non_fast_forward` | block | No force-pushes to `main`. |
| `required_linear_history` | required | Match existing rebase/squash practice; keeps `git log main` readable. |
| `pull_request` | required, **0 approvals** | Force the PR workflow (no direct push), but don't require a review while the active-contributor count is one. Raise to `1` when the team grows. See [trade-off](#why-required_approving_review_count-0). |
| `required_status_checks` | `CI Status` (only) | Single umbrella check; see [design choice](#why-only-ci-status). |
| `bypass_actors` | none | Admins follow the same rules. No emergency-merge backdoor by default. See [risk](#risk-locking-ourselves-out). |

`strict_required_status_checks_policy` is `false`: PRs do **not**
have to be up-to-date with `main` before merging. Rationale: the
rebase-merge workflow already serializes onto `main`, and forcing a
re-run on every base update wastes CI minutes for no real safety
gain (PR-level CI catches anything that matters).

### Why only `CI Status`?

`.github/workflows/ci.yml` defines six leaf jobs (`Lint`,
`Type Check`, `Check Tsconfig Bar`, `Lint No TS Bypass`,
`Test Frontend`, `Test Backend`) and one umbrella job, `CI Status`,
which uses

```yaml
needs: [lint, check-tsconfig-bar, lint-no-ts-bypass, type-check, test-frontend, test-backend]
if: always()
```

plus a `contains(needs.*.result, 'failure' | 'cancelled')` guard.
That makes `CI Status` succeed **iff** every leaf job succeeds, so
requiring `CI Status` alone is functionally equivalent to requiring
all six. The advantage: when a new CI job is added, only `ci.yml`'s
`needs:` list needs updating — the ruleset stays untouched.

`integration_id: 15368` pins the check to the GitHub Actions app so
the requirement cannot be satisfied by a third-party bot reporting
its own check named `CI Status`.

### Why `required_approving_review_count: 0`?

`Orlandohub/supplex` currently has one active code contributor
(`@danilolb27`) and one repo owner (`@Orlandohub`). With
`required_approving_review_count: 1` and the default GitHub rule
that author ≠ approver, every PR by either party would block until
the other manually reviews. That kills solo-dev velocity for a
guarantee that's already covered by `CI Status` + `non_fast_forward`
\+ `required_linear_history`.

When the team adds a third regular contributor, raise this to `1`
and re-apply (see [Updating the ruleset](#updating-the-ruleset)).

### Risk: locking ourselves out

With `bypass_actors: []`, no human — including admins — can merge to
`main` without `CI Status` reporting `success`. If `ci.yml`'s
`ci-status` job ever breaks for an environmental reason (e.g.
runner outage, GitHub Actions outage), no PR can land until it's
fixed.

Mitigations:

1. The `ci-status` job is trivial bash logic (no Bun, no Postgres,
   no network) and has been stable for the entire SUP-13 → SUP-21
   sequence.
2. Admins can edit the ruleset via the GitHub UI to add a temporary
   bypass actor in genuine emergencies.

If those guarantees are insufficient for your risk tolerance, the
right move is to add `bypass_actors` for the **`Repository admin`**
role (`actor_type: "RepositoryRole"`, `actor_id: 5`,
`bypass_mode: "pull_request"`) — that lets admins still need a PR
but not the green check. Don't do it casually; document the change
in the JSON commit message.

---

## Applying the ruleset

> Requires **admin** permission on the repo. The `gh` CLI uses your
> active token; check `gh auth status` to see who's authenticated.

### First-time creation

```bash
gh api \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  /repos/Orlandohub/supplex/rulesets \
  --input .github/rulesets/main.json
```

GitHub returns the created ruleset, including its `id`. Note that
ID — you'll need it for updates.

### Verifying

```bash
gh api repos/Orlandohub/supplex/rulesets \
  --jq '.[] | {id, name, target, enforcement}'
```

You should see exactly one entry with `name: "main-branch-protection"`
and `enforcement: "active"`.

For the full applied policy:

```bash
gh api repos/Orlandohub/supplex/rulesets/<id> | jq .
```

Diff that against `.github/rulesets/main.json` to confirm the live
state matches the spec.

### Updating the ruleset

After editing `main.json`, push the live ruleset to match by `PUT`-ing
to its endpoint:

```bash
RULESET_ID=$(gh api repos/Orlandohub/supplex/rulesets \
  --jq '.[] | select(.name=="main-branch-protection") | .id')

gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/Orlandohub/supplex/rulesets/$RULESET_ID \
  --input .github/rulesets/main.json
```

Always commit the `main.json` change in the same PR (or before) the
`PUT` — the in-repo file is the source of truth, the live ruleset
is just a projection.

### Removing (only with explicit approval)

```bash
gh api -X DELETE /repos/Orlandohub/supplex/rulesets/$RULESET_ID
```

Don't do this without an issue/PR justifying it. Once gone, `main`
is unprotected and any force-push or skipped-CI merge is possible.
