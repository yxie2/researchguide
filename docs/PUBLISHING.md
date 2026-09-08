# Publishing the source to GitHub

Intended destination: **yxie2/researchguide**. Do not substitute a different account.

The `yxie2` account is a personal user, so repository creation requires authentication with that account. Never put a token into repository files or chat.

After authenticating as `yxie2` using GitHub CLI's interactive login, verify the active identity:

```bash
gh api user --jq .login
```

It must print `yxie2`. Then inspect the local changes and run:

```bash
npm run check
npm test
git status --short
```

Create the repository with the visibility the owner chooses. For a public release, from this directory:

```bash
gh repo create yxie2/researchguide --public --source=. --remote=origin --push
```

For a private release, substitute `--private`. If the repository or remote already exists, inspect it and push to the verified destination rather than overwriting it.

Publishing the repository shares source code and synthetic screenshots only; it does not host the app. Review `.gitignore` and `git ls-files` before publishing. Keep proposals, unconfirmed team details, secrets, and local project data out of the release.
