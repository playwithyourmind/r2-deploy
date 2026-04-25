# r2-deploy

A GitHub Action that deploys static websites to [Cloudflare R2](https://developers.cloudflare.com/r2/).

It syncs the contents of a `./publish` directory to the root of an R2 bucket — uploading new and changed files, and deleting objects that no longer exist locally.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `bucket` | Yes | R2 bucket name (plain text) |
| `account-id` | Yes | Cloudflare account ID (plain text) |
| `access-key-id` | Yes | R2 API token access key ID (store as a GitHub secret) |
| `secret-access-key` | Yes | R2 API token secret access key (store as a GitHub secret) |

The publish directory is hardcoded to `./publish`. Your build step must output files there before this action runs.

## Usage

```yaml
name: Deploy to R2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build site
        run: npm run build  # must output to ./publish

      - uses: playwithyourmind/r2-deploy@main
        with:
          bucket: my-site-bucket
          account-id: abc123def456
          access-key-id: ${{ secrets.R2_ACCESS_KEY_ID }}
          secret-access-key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
```

## How It Works

1. Walks the `./publish` directory recursively and computes an MD5 hash for each file.
2. Lists all objects currently in the R2 bucket.
3. Compares local files against remote objects by key and ETag/MD5.
4. Uploads files that are new or changed, setting the correct `Content-Type` header.
5. Deletes remote objects that no longer exist locally.
6. Logs a summary of uploaded, deleted, and unchanged file counts.

## R2 Credentials

You need an R2 API token with read/write permissions on the target bucket. Create one in the Cloudflare dashboard under **R2 > Manage R2 API Tokens**.

Store the credentials as GitHub repository secrets:
- `R2_ACCESS_KEY_ID` — the access key ID from the token
- `R2_SECRET_ACCESS_KEY` — the secret access key from the token

## License

[MIT](LICENSE)
