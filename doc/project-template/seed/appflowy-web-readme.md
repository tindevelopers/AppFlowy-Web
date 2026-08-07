<!-- BEGIN GENERATED:main -->
# AppFlowy Web

**The Open Source Notion Alternative — use AppFlowy right in your browser.**

Bring projects, wikis, and teams together with AI.

## Use cases
- Build and maintain a knowledge base for your team
- Create and publish documentation for your customers and audience
- Write, publish, and manage content with AI
- Manage tasks and projects for yourself and your team

## Features
- Write beautiful documents with rich content types
- Create custom Grid & Kanban Board-view databases to manage and digest data
- Add a Quick Note to jot down lists, ideas, or to-dos
- Invite members to your workspace for seamless collaboration
- Create multiple public and private spaces to better organize your content

## Built with
- React, TypeScript, Bun, Nginx, Docker

## Development
- `pnpm install` — install dependencies
- `pnpm dev` — local dev server
- `pnpm build` — production build
- `pnpm test` / `pnpm test:e2e` — tests
- `pnpm type-check` / `pnpm lint` — checks

## Deployment
Frontend deploys to Vercel (trunk-based: merge to `main`). Backend is AppFlowy Cloud
(Rust/actix-web) deployed to a Hetzner VPS via GHCR + Watchtower.

## Documentation
- Project family guide: doc/APPFLOWY_PROJECTS.md
- Project template & policy: doc/project-template/
- Deployment guide: doc/DEPLOYMENT.md

## License
Distributed under the AGPLv3 License.
<!-- END GENERATED:main -->
