# GymPro

[![Test](https://github.com/faisalghafoor155/gym-app/actions/workflows/test.yml/badge.svg)](https://github.com/faisalghafoor155/gym-app/actions/workflows/test.yml)

Gym management for a single gym: members, attendance, fees, workout and diet
plans, and supplement stock — with owner / staff / member accounts.

React 19 + Vite on the front, Express 5 + Prisma 7 on the back, PostgreSQL
underneath. Sessions are a JWT in an httpOnly cookie.

## Quick start

```sh
cd docker
cp .env.example .env      # fill in the values
docker compose up -d --build
```

Then open <http://localhost:8080>.

## Documentation

**[DOCS.md](DOCS.md)** covers everything: configuration, the full API
reference, how members, memberships and payments fit together, security notes,
email and Google sign-in setup, tests and CI, and the known gaps.

For the container setup specifically, see [docker/README.md](docker/README.md).
