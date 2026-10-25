# Komunitní sbírka úloh z matematiky

Monorepo (pnpm workspaces): NestJS API, Vue web (zakládá John) a sdílené balíčky.
Struktura odpovídá dokumentu *Struktura repozitáře – Komunitní sbírka úloh*.

## Spuštění

```bash
corepack enable
pnpm install
pnpm --filter @matematika/api... build    # nejdřív contracts, pak API
pnpm --filter @matematika/api start       # http://localhost:3000
```

- API: `http://localhost:3000/api/v1`
- Dokumentace (Scalar): `http://localhost:3000/docs`
- Vývoj s automatickým restartem: `pnpm --filter @matematika/api dev`
- Ukázkové požadavky: `apps/api/requests.http` (HTTP klient v JetBrains IDE)

**Přihlášení v mocku:** hlavička `Authorization: Bearer jan` (důvěryhodný učitel),
`eva` (ověřený) nebo `petr` (registrovaný). Bez hlavičky API vrací `401`.

## Co kde je

| Cesta | Obsah |
|---|---|
| `packages/shared/contracts/openapi.yaml` | **API kontrakt – jediný zdroj pravdy** |
| `packages/shared/contracts/src/generated/` | typy a Zod schémata generovaná ze specifikace (`pnpm generate`, needitovat ručně) |
| `packages/shared/contracts/src/error-codes.ts` | kódy chyb (ručně, musí odpovídat popisu v `openapi.yaml`) |
| `apps/api/src/modules/` | moduly: `problems`, `publication`, `chapters`, `tags`, `licenses`, `users` |
| `apps/api/src/common/` | chyby (RFC 9457), filtr, Sqids, validace, mock přihlášení |
| `apps/api/src/database/` | `MockDatabase` – data v paměti místo Prismy |
| `tooling/typescript/` | sdílené tsconfig presety |

Každý modul má stejné vrstvy: `controllers/` → `services/` (fasáda) → `repositories/`,
čistá pravidla v `domain/`, převod na odpověď API v `mappers/`.

## Změna kontraktu

1. Upravit `packages/shared/contracts/openapi.yaml` (zvýšit verzi, řádek do changelogu).
2. `pnpm --filter @matematika/contracts build` – přegeneruje typy i Zod schémata.
3. TypeScript v API ukáže, co je potřeba upravit.

## Stav

Backend je **mock**: data jsou jen v paměti a po restartu se vrátí do výchozího stavu.
Fáze B nahradí `MockDatabase` Prismou a `MockAuthGuard` skutečným JWT; zbytek kódu
(kontrolery, služby, pravidla, mappery) zůstává. Místa k doplnění jsou označená `TODO Phase B`.
