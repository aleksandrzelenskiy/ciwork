# Architecture Notes

## Goals
- Keep server-only logic out of client bundles.
- Keep route handlers thin; push business logic into server modules.
- Organize UI by feature domain; keep routing in src/app.
- Standardize config and error handling.

## Current Structure (Snapshot)
- Routes: src/app (Next.js App Router), legacy API in src/pages/api
- Server actions: src/server-actions
- Config: src/config
- Utils/types: src/utils, src/types

## Boundaries
- Server-only modules: src/server/**, src/config/**, src/server-actions/**
- UI modules: src/app/**, src/features/**
- Shared types and pure helpers: src/types/**, src/utils/**

## Planned Refactor Steps (Safe Order)
1. Document boundaries and keep a running map of moved modules.
2. Introduce src/server/** and start relocating models + infra.
3. Add env validation in src/config/env.ts.
4. Move business logic from route handlers to services.
5. Standardize API responses.
6. Reorganize UI by feature modules in src/features/**.

