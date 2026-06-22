# OpenConsole

[![CI](https://github.com/Jongsic/openconsole/actions/workflows/ci.yml/badge.svg)](https://github.com/Jongsic/openconsole/actions/workflows/ci.yml)
[![Deploy](https://github.com/Jongsic/openconsole/actions/workflows/deploy.yml/badge.svg)](https://github.com/Jongsic/openconsole/actions/workflows/deploy.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://github.com/Jongsic/openconsole/blob/main/LICENSE)

A **browser-only** console for **LocalStack, Floci, moto, MinIO, or real AWS**.
There is no server: the browser talks to your endpoint directly using the AWS SDK. Connection
settings live in your browser's `localStorage`.

![OpenConsole](https://raw.githubusercontent.com/Jongsic/openconsole/main/preview.gif)

**Live:** [https://jongsic.github.io/openconsole/](https://jongsic.github.io/openconsole/) &nbsp;·&nbsp;
**Source:** [github.com/Jongsic/openconsole](https://github.com/Jongsic/openconsole)

> A fully functional app — **free, no sign-up, no account.** It is a static site that runs
> entirely in your browser; it sends **no data to any server of ours** and performs **no tracking
> or analytics.** Your endpoint and credentials never leave your browser.

- 🌐 UI in English / Korean (auto-detected from browser locale, switchable)
- 🔌 Connect to any endpoint from the settings dialog
- 🔎 Auto-detects the backend (LocalStack / Floci / moto / MinIO / AWS) and gates features accordingly
- 🪣 **S3** — buckets (list / create / delete with force); objects: prefix browsing, upload
  (drag & drop), folders, text edit, download, delete; bucket properties: versioning, tags,
  encryption, static website, CORS, bucket policy, ARN
- 🖥️ **Compute** — an AWS-style section with a left sub-nav:
  - **EC2 instances** — list, detail (details / security / networking / storage / tags), launch
    (key pair, security groups, subnet pickers), start / stop / reboot / terminate, edit
    (tags, instance type, security groups, termination & stop protection), IMDSv2 / user data view
  - **Security groups** — list + detail page, create / delete, inbound/outbound rule add / remove
  - **Volumes** (EBS), **Key pairs** (create / import / delete), **Launch templates** (create / delete)
  - **Load balancers** (ALB/NLB) — detail page with attributes, tags, listeners (create / delete),
    and per-listener rules (priority / path / host conditions)
  - **Target groups** — create / delete, register / deregister targets, health-check + stickiness
    + algorithm editing, tags
  - **Auto Scaling groups** — create / delete, capacity edit, scaling policies & scheduled actions
- 🌐 **VPC** — VPCs, subnets, route tables (+ routes), internet gateways (attach / detach), NAT
  gateways (public / private), and Elastic IPs — list / create / delete with a tags + attributes
  detail panel on each
- 🗄️ **DB/Cache** — RDS DB clusters & instances and ElastiCache cache clusters & nodes
  (Memcached / Redis / Valkey) — list / create / delete with a tags + properties detail panel
- 🧩 **Function** — Lambda functions (create from inline-zipped code, detail page with config /
  code / env) and layers
- 🔑 **IAM** — roles (detail with attached & inline policies, trust policy), instance profiles,
  and policies (managed + customer, searchable, with policy-document view)
- 🛟 Graceful degradation — anything a backend doesn't implement shows a calm "not supported"
  state instead of an error; permission/CORS errors are surfaced, not hidden

## Architecture: why browser-only

Because requests are made **from the visitor's browser**, the app can be hosted on a public domain
and still reach each visitor's own `localhost` backend — something a server-side app cannot do
(its "localhost" would be the server). The trade-off is that the **target backend must allow CORS**
from the app's origin (see below).

| Deploy | How | Notes |
| --- | --- | --- |
| Local run | `pnpm dev` or a static image on `localhost:PORT` | No mixed-content / PNA issues (all HTTP loopback). CORS still needed. |
| Public domain | Host `dist/` on any static host | Visitor configures their backend CORS. HTTPS→localhost may hit browser Private Network Access limits. |

## Backend support

OpenConsole talks to any AWS-compatible endpoint via the AWS SDK. A small registry decides which
**top-level sections** (S3, Compute, VPC, DB/Cache, Function, IAM) to open per backend; anything a
backend can't actually do is handled gracefully at runtime (shown as a quiet "not supported" state)
rather than enumerated up front.

| Backend | Detected by | Sections opened | Notes |
| --- | --- | --- | --- |
| Real AWS | empty / `*.amazonaws.com` endpoint | all | Use a least-privilege IAM key |
| LocalStack | `/_localstack/health` (:4566) | all | Community can't do ELB/ASG → those show "not supported"; Pro does |
| Floci | `/_floci/health` (:4566) | all | [Drop-in LocalStack replacement](https://github.com/floci-io/floci) that really does run EC2/ELB/ASG. Shares LocalStack's port/health, so it's detected by its native `/_floci/health` (checked before LocalStack) |
| moto | `/moto-api/` (:5000) | all | `moto_server` standalone mode |
| MinIO | `/minio/health/live` (:9000) | S3 only | Static website hosting / per-bucket CORS aren't in MinIO's S3 API |
| Unknown / generic S3 | — | S3 only | Safe default for any other S3-compatible endpoint |

### Adding / changing a backend

Backends live in [`src/config/backends.json`](src/config/backends.json) — no code change needed for
detection or section gating:

```jsonc
"mybackend": {
  "label": "My Backend",
  "detect": { "healthPath": "/health", "ports": [1234], "jsonKey": "optionalRequiredKey" },
  "sections": ["s3", "compute", "vpc", "db", "function", "iam"]
}
```

- `detect` is optional (omit for AWS). `jsonKey`, if set, requires that key in the health JSON to match.
- `sections` lists which nav areas to open. Don't try to enumerate per-service support — within an
  open section, unsupported services are detected at call time and shown as "not supported", so
  e.g. LocalStack Community and Pro share one entry.

## ⚠️ CORS is required (read this)

Browser requests are subject to CORS. By default backends do **not** allow this app's origin.

**LocalStack** — add your app origin to the container, then restart:

```bash
# docker run / compose env
EXTRA_CORS_ALLOWED_ORIGINS=http://localhost:3939
# or, for local dev convenience:
DISABLE_CORS_CHECKS=1
```

**Floci** — set the canonical key (the `EXTRA_CORS_ALLOWED_ORIGINS` alias is not bound):

```bash
FLOCI_SECURITY_EXTRA_CORS_ALLOWED_ORIGINS=http://localhost:3939
```

**MinIO** — configure CORS / allowed origins on the server.

**Real AWS** — put a CORS configuration on the target bucket allowing this origin.

If the connection dialog shows a connection error, this is almost always the cause — the dialog
shows the exact env var to set.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3939
```

Build a static bundle for hosting:

```bash
pnpm build      # outputs dist/
pnpm preview    # serve dist/ locally
```

Set a sub-path base when hosting under one (GitHub Pages project sites):

```bash
VITE_BASE=/your-repo/ pnpm build
```

## Deploy to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and deploys on every **signed release
tag** (`v*`), so the live site only updates from verified releases:

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Register your signing key (see [Signed releases](#signed-releases) below).
4. Push a signed tag (or run the workflow manually). The app is served at
   `https://<user>.github.io/<repo>/`.

The workflow auto-computes the base path from the repo name and emits a `404.html`
SPA fallback so client-side routes work on refresh.

## Docker

A prebuilt image (nginx serving the static bundle) is published on each release — just pull
and run it, no build needed:

```bash
docker run -p 3939:80 jongsic/openconsole          # Docker Hub
# or
docker run -p 3939:80 ghcr.io/jongsic/openconsole:latest   # GitHub Container Registry
# → http://localhost:3939
```

- Docker Hub: [hub.docker.com/r/jongsic/openconsole](https://hub.docker.com/r/jongsic/openconsole)
- Tags: `latest` and each release version (e.g. `0.1.0`).

Or build it yourself: `docker build -t openconsole . && docker run -p 3939:80 openconsole`.

## Releases

Tagging `v*` triggers `.github/workflows/release.yml`, which:

- publishes a GitHub Release with auto-generated notes,
- attaches the prebuilt static bundle (`*-static.zip`) and `SHA256SUMS.txt` — serve these with
  any static web server (opening `index.html` via `file://` will not work),
- pushes the Docker image to GHCR (and to Docker Hub if `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`
  secrets are set).

```bash
# bump the version in package.json, then:
git tag -s v0.1.0 -m v0.1.0 && git push origin v0.1.0
```

### Signed releases

Both the **release** and **Pages deploy** workflows are gated by a `verify-tag` job: the
triggering tag must carry a valid GPG signature from a trusted key. Tags that are unsigned
or signed by an unknown key are rejected before anything is published or deployed.

Create signed tags (`git tag -s ...`); set `git config --global commit.gpgSign true` and
`tag.gpgSign true` to sign by default.

### GitHub Actions configuration

Set these under **Settings → Secrets and variables → Actions**. Only `SIGNING_PUBLIC_KEY`
is required; the rest are optional or provided automatically.

| Name | Kind | Required | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `SIGNING_PUBLIC_KEY` | Variable | **Yes** | release, deploy | Armored **public** GPG key the `verify-tag` gate trusts. Export with `gpg --armor --export <your-key-id>` and paste the whole block. |
| `DOCKERHUB_USERNAME` | Secret | No | release | Docker Hub user. Set (with the token) to also push the image to Docker Hub; omit to publish to GHCR only. |
| `DOCKERHUB_TOKEN` | Secret | No | release | Docker Hub access token paired with the username above. |
| `GITHUB_TOKEN` | — | Automatic | release, deploy | Provided by GitHub Actions; no setup. Used to create the Release, push to GHCR, and deploy Pages. |

No secrets are needed for **CI** (`ci.yml`) — it only lints, type-checks, tests, and builds.

## Settings (in-app, stored in localStorage)

| Field | Default | Notes |
| --- | --- | --- |
| Endpoint | `http://localhost:4566` | Empty = real AWS |
| Region | `us-east-1` | |
| Access key / Secret | `test` / `test` | Stored in plaintext in the browser — use limited keys |
| Force path-style | on | Recommended for LocalStack/MinIO |
| Static website host | `s3-website.localhost.localstack.cloud:4566` | Host that serves website hosting; backend-specific |

## Stack

React 18 + Vite, TypeScript (strict), Tailwind CSS, TanStack Query, Zustand, Zod,
react-router, react-i18next, Biome, and the AWS SDK v3 clients (`s3`, `ec2`,
`elastic-load-balancing-v2`, `auto-scaling`, `iam`, `rds`, `elasticache`, `lambda`).
Tested with Vitest, CI via GitHub Actions.

## Disclaimer

This software is released into the public domain under [The Unlicense](https://github.com/Jongsic/openconsole/blob/main/LICENSE) and is provided
**"AS IS", without warranty of any kind**. Your credentials are stored in your browser's
`localStorage` in plain text and all requests are made directly from your browser to the endpoint
you configure. To the maximum extent permitted by law, the authors are **not liable** for any
damages, credential exposure, data loss, or cloud-provider charges arising from its use — **you
use it entirely at your own risk** and are solely responsible for securing your credentials, data,
and infrastructure. See [SECURITY.md](https://github.com/Jongsic/openconsole/blob/main/SECURITY.md) for details.

## License

[The Unlicense](https://github.com/Jongsic/openconsole/blob/main/LICENSE) — public domain. Do anything you want; no attribution required.

## Contributing

See [CONTRIBUTING.md](https://github.com/Jongsic/openconsole/blob/main/CONTRIBUTING.md).
