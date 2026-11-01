<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

interface NavItem {
  label: string
  to: string
}

// Change the paths here when the pages exist. Paths without a page yet
// simply open an empty view (the router logs a warning in dev).
const personalLinks: NavItem[] = [
  { label: 'Moje sbírka', to: '/editor' },
  { label: 'Moje třídy', to: '/classes' },
]

const browseLinks: NavItem[] = [
  { label: 'Ročník', to: '/grades' },
  { label: 'Předměty', to: '/subjects' },
  { label: 'Okruhy', to: '/topics' },
  { label: 'Listy', to: '/catalog/worksheets' },
  { label: 'Příklady', to: '/catalog/problems' },
]

const router = useRouter()
const query = ref('')

function search() {
  const text = query.value.trim()
  if (!text) return

  // TODO: create the /search page
  router.push({ path: '/search', query: { q: text } })
}
</script>

<template>
  <header class="navbar">
    <div class="navbar__top">
      <RouterLink to="/" class="navbar__logo">
        ProUčitele.com
      </RouterLink>

      <div class="navbar__right">
        <form
          class="navbar__search"
          role="search"
          @submit.prevent="search"
        >
          <input
            v-model="query"
            type="search"
            class="navbar__search-input"
            aria-label="Hledat"
          />

          <button
            type="submit"
            class="navbar__search-button"
            aria-label="Hledat"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M15 15l6 6" stroke-width="3" />
            </svg>
          </button>
        </form>

        <nav class="navbar__personal" aria-label="Můj účet">
          <RouterLink
            v-for="item in personalLinks"
            :key="item.to"
            :to="item.to"
            class="navbar__personal-link"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <RouterLink
          to="/user"
          class="navbar__avatar"
          aria-label="Uživatelský účet"
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20c0-4 3.4-6 7.5-6s7.5 2 7.5 6" />
          </svg>
        </RouterLink>
      </div>
    </div>

    <nav class="navbar__browse" aria-label="Procházení">
      <RouterLink
        v-for="item in browseLinks"
        :key="item.to"
        :to="item.to"
        class="navbar__browse-link"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
/* sticky = stays pinned at the top on every page, but takes its own space
   in the layout, so pages need no top padding and it can wrap on phones */
.navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
}

/* ---------- top bar ---------- */
.navbar__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  padding: 0.35rem clamp(1rem, 4vw, 4rem);
  background: linear-gradient(90deg, #3ec8ff 0%, #70f2ff 100%);
  color: #000;
}

.navbar__logo {
  color: inherit;
  font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
  font-size: clamp(1.6rem, 3vw, 2.6rem);
  font-style: italic;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
}

.navbar__right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  min-width: 0;
}

/* ---------- search ---------- */
.navbar__search {
  position: relative;
  flex: 1 1 14rem;
  width: min(25rem, 100%);
}

.navbar__search-input {
  width: 100%;
  min-height: 2.25rem;
  padding: 0.25rem 2.75rem 0.25rem 1rem;
  box-sizing: border-box;
  color: #000;
  background: #fff;
  border: 1px solid #000;
  border-radius: 999px;
  font: inherit;
}

.navbar__search-input:focus-visible {
  outline: 3px solid rgb(0 0 0 / 0.35);
  outline-offset: 2px;
}

.navbar__search-button {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  padding: 0;
  color: #000;
  background: transparent;
  border: 0;
  border-radius: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.navbar__search-button:hover {
  background: rgb(0 0 0 / 0.08);
}

/* ---------- personal links + avatar ---------- */
.navbar__personal {
  display: flex;
  gap: 1.25rem;
}

.navbar__personal-link {
  color: inherit;
  font-size: clamp(1rem, 1.3vw, 1.4rem);
  text-decoration: none;
}

.navbar__personal-link:hover,
.navbar__personal-link.router-link-active {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.navbar__avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  padding: 0;
  color: #000;
  background: #fff;
  border: 2px solid #000;
  border-radius: 50%;
  text-decoration: none;
  cursor: pointer;
}

.navbar__avatar svg,
.navbar__search-button svg {
  display: block;
}

.navbar__avatar:hover {
  background: #f1fcff;
}

/* ---------- second row ---------- */
.navbar__browse {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0 clamp(1rem, 5vw, 5rem);
  overflow-x: auto;
  background: #fff;
  border-bottom: 1px solid var(--color-border, #d9dee3);
}

.navbar__browse-link {
  padding: 0.45rem 0.25rem 0.35rem;
  color: #000;
  border-bottom: 2px solid transparent;
  font-size: clamp(1rem, 1.3vw, 1.4rem);
  text-decoration: none;
  white-space: nowrap;
}

.navbar__browse-link:hover {
  border-bottom-color: #9be7ff;
}

.navbar__browse-link.router-link-active {
  border-bottom-color: #00a8e8;
  font-weight: 700;
}

/* ---------- small screens ---------- */
@media (max-width: 720px) {
  .navbar__right {
    width: 100%;
  }

  .navbar__browse {
    justify-content: flex-start;
  }
}
</style>