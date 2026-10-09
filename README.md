# FlockGPScameras

**A GPS-enabled camera fleet management prototype.**

[Project homepage](https://brandonducar.github.io/BrandonDucar/projects/FlockGPScameras/) | [Source](https://github.com/BrandonDucar/FlockGPScameras)

This monorepo groups web, API, and mobile applications with shared packages.
Repository availability is not evidence of a deployed camera network, working
device integration, or a production-ready tracking service.

## Repository Map

- `apps/`: application workspaces.
- `packages/`: shared code, including the database workspace.
- `package.json`: workspace development and verification commands.
- `.env.example`: configuration template; do not commit real credentials.

## Local Development

Requires Node.js 20+ and pnpm 9+.

```bash
git clone https://github.com/BrandonDucar/FlockGPScameras.git
cd FlockGPScameras
pnpm install
pnpm dev:web
```

In separate terminals, use `pnpm dev:api` or `pnpm dev:mobile` for the relevant
workspace. Inspect its configuration before starting it. Root verification
commands include `pnpm lint`, `pnpm typecheck`, `pnpm build:web`, and
`pnpm build:api`. Available commands are not a claim that all checks pass.

Database commands `db:generate`, `db:migrate`, and `db:seed` exist but should
run only against an explicitly selected development database. Do not apply
them to an unknown or shared production database.

## Privacy And Readiness

Use synthetic or consented device data. Do not publish real location histories,
camera feeds, credentials, or identifying footage in issues or examples.
Authentication, retention, access control, and device behavior need independent
verification before operational deployment.

No hosted application is asserted here; the homepage is a project overview.

## License

Original DreamNet project contributions are licensed under [Apache-2.0](LICENSE).
The six workspace package manifests declare that license. [LICENSE_SCOPE.md](LICENSE_SCOPE.md)
and [NOTICE](NOTICE) preserve scaffold attribution and distinguish dependency, map/data,
and media rights. Third-party packages and services retain their applicable terms.
