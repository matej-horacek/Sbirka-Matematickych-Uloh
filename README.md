# Komunitní sbírka úloh z matematiky

Webová aplikace, kde učitelé matematiky vytvářejí, třídí a sdílejí úlohy (včetně sad úloh,
kapitol, štítků a licencí). Úlohu lze zkopírovat, upravit a publikovat pod licencí.

Monorepo (pnpm workspaces):

- `apps/api` – NestJS API (REST, kontrakt v OpenAPI), data v PostgreSQL přes Prisma
- `apps/web` – Vue 3 + Vite frontend
- `packages/shared/contracts` – sdílený API kontrakt (`openapi.yaml`) a z něj generované typy

## Požadavky

- Node.js `^22.18` nebo `>=24.12`
- pnpm (přes Corepack: `corepack enable`)
- Docker Desktop (databáze v kontejneru)

## Rychlý start (API s databází)

Všechno z kořene repa.

```powershell
corepack enable
pnpm install                                         # po každém git pull, když se změnil lockfile
pnpm --filter @matematika/contracts build            # sdílené typy (kontrakt)
pnpm --filter @matematika/api db:generate            # Prisma klient (po změně schématu)

copy apps\api\.env.example apps\api\.env             # jen poprvé; zkontrolujte DATABASE_URL

docker compose -f docker-compose.dev.yml up -d       # databáze, host port 5434
docker ps                                            # musí ukázat 0.0.0.0:5434->5432/tcp

pnpm --filter @matematika/api exec prisma migrate deploy   # schéma, jen poprvé / po nové migraci
pnpm --filter @matematika/api db:seed                      # ukázková data, jen do prázdné DB

pnpm --filter @matematika/api dev                    # API s automatickým restartem
```

- API: `http://localhost:3000/api/v1`
- Dokumentace (Scalar): `http://localhost:3000/docs`
- Ukázkové požadavky: `apps/api/requests.http` (JetBrains HTTP klient, nebo stejné URL v Postmanu)
- Prohlížeč databáze: `pnpm --filter @matematika/api exec prisma studio`

`apps/api/.env`:

```
PORT=3000
DATA_SOURCE=prisma / mock (prisma runs against the db)
DATABASE_URL=postgresql://app:app@localhost:5434/sbirka
```

Databáze běží na portu **5434**, protože 5432 často obsazuje lokálně nainstalovaný PostgreSQL.

**Vyprázdnit databázi a nasadit seed znovu** (smaže všechna data v dev databázi):

```powershell
pnpm --filter @matematika/api exec prisma migrate reset --force
```

### Mock režim (bez databáze)

Data jsou jen v paměti a po restartu se vrátí do výchozího stavu. Docker není potřeba.

```powershell
# v apps/api/.env: DATA_SOURCE=mock (nebo řádek smazat)
pnpm --filter @matematika/api dev
```

### Přihlášení a ID

Zatím mockované přihlášení: hlavička `Authorization: Bearer jan` (důvěryhodný učitel),
`eva` (ověřený) nebo `petr` (registrovaný). Bez hlavičky API vrací `401`.

API vystavuje ID jako Sqids, ne jako čísla (`/problems/1` nefunguje). Seed (a mock) mají tyto úlohy:

| Sqid | Úloha |
|---|---|
| `UkLWZ` | Řešte rovnice (sada, děti `gbHJd` a `EfhxL`) |
| `VqXmZ` | Obsah kruhu (publikovaná) |
| `uw2YK` | Pythagorova věta (publikovaná, Eva) |
| `OIJLh` | Soustava rovnic (soukromá, Eva) |
| `AXs1i` | Úloha z učebnice (cizí licence) |

## Frontend

```powershell
cd apps\web
pnpm dev                                             # http://localhost:5173
```

API musí běžet (viz výše). Adresa API a demo uživatel jsou v `apps/web/.env`
(vzor `apps/web/.env.example`):

```
VITE_API_URL=http://localhost:3000/api/v1
VITE_DEMO_USER=jan
```

CORS API povoluje `http://localhost:5173` (změna: `CORS_ORIGIN` v `apps/api/.env`).

Další příkazy ve `apps/web`: `pnpm type-check`, `pnpm lint`, `pnpm test:unit`, `pnpm build`, `pnpm format`.

## Kontroly a testy

```powershell
pnpm typecheck               # TypeScript ve všech balíčcích
pnpm lint                    # ESLint (API a skripty; web má vlastní lint)
pnpm format:check            # Prettier (formátování: pnpm format)
pnpm test                    # testy API nad mockem
pnpm test:prisma             # e2e testy nad Prisma databází (dočasná DB na portu 5433, vyžaduje Docker)
pnpm verify                  # celá kontrola před commitem
```

Formátování: Prettier v kořeni (`.prettierrc.json`) platí pro API a sdílené balíčky.
`apps/web` má vlastní konfiguraci.

## Co kde je

| Cesta | Obsah |
|---|---|
| `packages/shared/contracts/openapi.yaml` | **API kontrakt – jediný zdroj pravdy** |
| `packages/shared/contracts/src/generated/` | typy a Zod schémata generovaná ze specifikace (`pnpm generate`, needitovat ručně) |
| `packages/shared/contracts/src/error-codes.ts` | kódy chyb (ručně, musí odpovídat popisu v `openapi.yaml`) |
| `apps/api/src/modules/` | moduly: `problems`, `publication`, `chapters`, `tags`, `licenses`, `users` |
| `apps/api/src/common/` | chyby (RFC 9457), filtr, Sqids, validace, mock přihlášení |
| `apps/api/src/database/` | `MockDatabase` (data v paměti) a `PrismaService` |
| `apps/api/prisma/` | `schema.prisma`, migrace a `seed.ts` |
| `tooling/typescript/` | sdílené tsconfig presety |

Každý modul má stejné vrstvy: `controllers/` → `services/` (fasáda) → `repositories/`,
čistá pravidla v `domain/`, převod na odpověď API v `mappers/`. Repozitář má dvě
implementace (`Mock…Repository`, `Prisma…Repository`); `DATA_SOURCE` vybírá, která se použije.
Služby o tom nevědí, takže pravidla se píšou jen jednou.

## Změna kontraktu

1. Upravit `packages/shared/contracts/openapi.yaml` (zvýšit verzi, řádek do changelogu).
2. `pnpm --filter @matematika/contracts build` – přegeneruje typy i Zod schémata.
3. TypeScript v API ukáže, co je potřeba upravit.

## Stav

- Hotové Prisma repozitáře: licence, štítky, kapitoly, uživatelé a čtení úlohy (`findById`).
- Zbývá dopsat v `prisma-problems.repository.ts`: `findChildren`, `countChildren`, `findMany`,
  `insert`, `update`, `softDelete`. Dokud nejsou, vrací odpovídající endpointy `501`.
  Mock režim funguje celý. Podrobnosti: `docs/DB_SLICE.md`.
- Přihlášení je zatím mockované (`MockAuthGuard`); nahradí ho JWT.
