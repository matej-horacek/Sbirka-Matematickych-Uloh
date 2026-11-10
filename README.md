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

## Rychlý start (po naklonování)

Všechno z kořene repa, v tomto pořadí. Docker Desktop musí běžet.

```powershell
# 1) závislosti – celé monorepo včetně webu
corepack enable
pnpm install

# 2) generovaný kód – kontrakt (typy + Zod schémata) a Prisma klient
pnpm --filter @matematika/contracts build
pnpm --filter @matematika/api db:generate

# 3) lokální konfigurace (jen poprvé; .env nejsou v gitu)
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env

# 4) databáze (host port 5434)
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @matematika/api exec prisma migrate deploy
pnpm --filter @matematika/api db:seed                # volitelné, ukázková data jen do prázdné DB

# 5) spuštění – každé v samostatném terminálu
pnpm dev:api                                         # http://localhost:3000/api/v1
pnpm dev:web                                         # http://localhost:5173
```

**Po `git pull`:** zopakujte kroky 1 a 2. Pokud přibyla migrace, i `prisma migrate deploy`.

`pnpm dev` spustí API, web i sledování kontraktu najednou v jednom terminálu.

- Dokumentace API (Scalar): `http://localhost:3000/docs`
- Ukázkové požadavky: `apps/api/requests.http` (JetBrains HTTP klient, nebo stejné URL v Postmanu)
- Prohlížeč databáze: `pnpm --filter @matematika/api exec prisma studio`

`apps/api/.env` (vzor `apps/api/.env.example`):

```
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATA_SOURCE=prisma
DATABASE_URL=postgresql://app:app@localhost:5434/sbirka
```

Volitelné proměnné jsou v `.env.example` zakomentované a mají výchozí hodnoty:

| Proměnná | Výchozí | Význam |
|---|---|---|
| `JWT_SECRET` | vestavěný dev klíč | podpis access tokenu; **povinný** při `NODE_ENV=production` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` (15 min) | platnost access tokenu |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | platnost refresh tokenu |
| `COOKIE_SECURE` | `true` jen v produkci | `Secure` cookie (vyžaduje https) |
| `SQIDS_ALPHABET` | výchozí abeceda Sqids | v produkci nastavit; změna změní všechna ID |

Nenechávejte klíč s prázdnou hodnotou (`JWT_SECRET=`). Prázdný `JWT_SECRET` se bere jako chybějící
a API nenaběhne. Buď hodnotu vyplňte, nebo řádek zakomentujte.

`apps/web/.env` obsahuje jen adresu API: `VITE_API_URL=http://localhost:3000/api/v1`.
CORS API povoluje `http://localhost:5173` (změna: `CORS_ORIGIN` v `apps/api/.env`).

Databáze běží na portu **5434**, protože 5432 často obsazuje lokálně nainstalovaný PostgreSQL.
Kontrola: `docker ps` musí ukázat `0.0.0.0:5434->5432/tcp`.

**Vyprázdnit databázi a nasadit seed znovu** (smaže všechna data v dev databázi):

```powershell
pnpm --filter @matematika/api exec prisma migrate reset --force
```

### Mock režim (bez databáze)

Data jsou jen v paměti a po restartu se vrátí do výchozího stavu. Docker není potřeba.

```powershell
# v apps/api/.env: DATA_SOURCE=mock (nebo řádek smazat)
pnpm dev:api
```

### Přihlášení a ID

Přihlášení přes cookie (JWT) na přihlašovací stránce webu nebo `POST /auth/login`.
Uživatelé ze seedu, heslo `password123`: `jan@example.test` (důvěryhodný učitel),
`eva@example.test` (ověřený), `petr@example.test` (registrovaný). Registrace vytvoří nového.
Bez přihlášení API vrací `401` (kromě `register`, `login`, `refresh`, `logout`).

API vystavuje ID jako Sqids, ne jako čísla (`/problems/1` nefunguje). Seed (a mock) mají tyto úlohy:

| Sqid | Úloha |
|---|---|
| `UkLWZ` | Řešte rovnice (sada, děti `gbHJd` a `EfhxL`) |
| `VqXmZ` | Obsah kruhu (publikovaná) |
| `uw2YK` | Pythagorova věta (publikovaná, Eva) |
| `OIJLh` | Soustava rovnic (soukromá, Eva) |
| `AXs1i` | Úloha z učebnice (cizí licence) |

## Frontend

Spouští se z kořene (`pnpm dev:web`, viz výše), API musí běžet.

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
| `apps/api/src/modules/` | moduly: `auth`, `problems`, `publication`, `chapters`, `tags`, `licenses`, `users` |
| `apps/api/src/common/` | chyby (RFC 9457), filtr, Sqids, validace, guardy (JWT, CSRF) |
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

- Hotové Prisma repozitáře: licence, štítky, kapitoly, uživatelé a úlohy. Mock režim funguje celý.
  Podrobnosti: `docs/DB_SLICE.md`.
- Přihlášení: JWT v cookie s rotací refresh tokenů a CSRF hlavičkou.
