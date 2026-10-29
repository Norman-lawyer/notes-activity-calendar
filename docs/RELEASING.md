# Release checks and provenance

## What these workflows do

Pull requests and pushes to `main` run `npm run check` and a pinned version of
Obsidian's scanner preflight. The preflight supplements, rather than replaces,
local zero-warning checks. Its `strict` option fails policy errors, but does not
turn every warning or inconclusive result into a failure. Inspect its summary.
Neither CI nor a local pass is the public community scorecard or a manual review.

A new numeric version tag runs `.github/workflows/release.yml`. It validates the
tag against both manifests, runs checks, verifies that two builds produce the
same assets in that runner, generates GitHub/Sigstore build provenance for the
exact assets, verifies that provenance, and creates a **draft** release. A failed
attestation or verification stops draft creation. It never publishes a release.

Dependencies are locked in `package-lock.json`; Node and third-party actions are
pinned. Two identical builds in one runner do not prove reproducibility across
every operating system or toolchain. Update pins deliberately and rerun checks.

Only `main.js`, `manifest.json`, and `styles.css` are attached. `LICENSE` and
`LUNAR-LICENSE` stay in the repository and their complete texts are embedded in
`main.js`; do not attach them as extra plugin release assets or remove the notices.
Attestations are stored by GitHub, not attached as unsupported extra files.

## Maintainer steps (require release authorization)

1. Review and merge the tested change through the repository's normal process.
2. Choose a **new** version, update `package.json`, `package-lock.json`, and
   `manifest.json` together, and rerun `npm ci --ignore-scripts && npm run check`.
   Do not overwrite the existing `0.1.4` release or tag.
3. Review the workflow's job-scoped `contents: write`, `id-token: write`, and
   `attestations: write` permissions before enabling it. Do not broaden repository
   or organization security settings just to bypass a failing job.
4. Push a tag exactly matching the manifest version, without a `v` prefix.
   The workflow will create a draft; inspect all logs and the scanner summary.
5. Download the draft's three assets and verify them before publishing:

   ```sh
   for asset in main.js manifest.json styles.css; do
     gh attestation verify "$asset" --repo Norman-lawyer/notes-activity-calendar \
       --signer-workflow Norman-lawyer/notes-activity-calendar/.github/workflows/release.yml \
       --source-digest FULL_RELEASE_COMMIT_SHA
   done
   ```

6. Test the draft in a disposable Obsidian vault (including mobile if continuing
   to advertise mobile support). Publish only after explicit maintainer approval.
7. Wait for the community directory to scan that new published version. Confirm
   the scorecard's version and source commit before reporting the result. If it
   remains stale or reports an inaccurate finding, use the directory's maintainer
   controls/support route; do not claim local CI changed the official verdict.

A failed or interrupted draft job is not evidence that nothing was created.
Inspect the release list and attestations before rerunning. The workflow does not
overwrite existing releases or use `--clobber`; an existing draft needs deliberate
maintainer inspection instead of a blind retry.

## Capability disclosures are not lint errors

The calendar needs to enumerate Markdown files to show vault-wide activity. Its
explicit copy-date action writes a generated date to the system clipboard and
must not read clipboard contents. These capabilities can remain informational
findings even after all fixable source and release problems are corrected.
Do not hide their API usage, disable scanner rules, or delete calendar features
solely to make a scorecard green. Explain the behavior and obtain review of any
false positives. Directory listing also does not imply manual security review.

## References

- [Obsidian workflow and scanner preflight](https://github.com/obsidianmd/obsidian-workflows)
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- [GitHub attestation verification](https://cli.github.com/manual/gh_attestation_verify)
- [Public plugin scorecard](https://community.obsidian.md/plugins/notes-activity-calendar#scorecard)

## Development dependency security note (0.1.5)

The project overrides the development-only Moment dependency to 2.31.0 to fix
[GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw).
This covers local API types, tests and lint tooling; Moment is not bundled in the
plugin, which uses Obsidian's runtime export. This does not update Obsidian itself.
The pinned upstream scanner creates a separate temporary dependency project, so
our override does not alter that project's dependency tree. Its own npm install
may still report upstream development-tool advisories even when the plugin's
full dependency audit and scanner policy checks pass. Do not hide these messages
or apply `npm audit fix --force` to bypass them.
