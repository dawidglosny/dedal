# Dedal × Next.js — Radix Themes i shadcn/ui

Ta sama strona (kontrakt, template, dane) renderowana dwiema bibliotekami komponentów. Różni się wyłącznie rejestr.

```bash
npm run dedal   # build paczki → npm pack → instalacja z vendor/ (jedna kopia Reacta, jak u konsumenta)
npm run build && npm start
```

- `/shadcn` — shadcn/ui (Tailwind v4, komponenty w `components/ui`),
- `/radix` — Radix Themes (`@radix-ui/themes`),
- `?device=desktop|mobile` — `ctx.device` (liczba kolumn, wyróżniona karta),
- `?debug=1` — panel devtools (przycisk „dedal” w prawym dolnym rogu: „pick” element strony, drzewo, sekcje, selektor na żywo) oraz widok z `inspect()` (`dedal/devtools`): sekcje i źródła danych, klucz cache'u, drzewo węzłów z sugerowanymi selektorami, pochodzenie propsów (default / template / patch / dane), przypisania; build z `trace` omija cache,
- `/api/home?device=mobile` — ta sama strona jako JSON (topologia middleware → front).
- `/docs` — dokumentacja na przykładach: każda możliwość, ostrzeżenie i błąd jako osobna strona z opisem, kodem, wynikiem i raportem devtools (zob. niżej).

## Struktura

| Plik | Rola |
|---|---|
| `ui/contract.ts` | kontrakt: słownictwo Radix/shadcn, neutralne wartości (`sm \| md \| lg`, `default \| secondary \| outline`) |
| `ui/to-props.ts` | dane z API → propsy kontraktu (nie wie nic o bibliotekach) |
| `ui/home.page.ts` | bloki i strona: sloty `media`, `actions`, `badge`, `footer`, dane do slotów selektorami, `cache` |
| `ui/registries/shadcn.tsx` | kontrakt → komponenty shadcn + klasy Tailwinda |
| `ui/registries/radix-themes.tsx` | kontrakt → komponenty Radix Themes i ich skale (`size="1".."9"`, `variant="soft"`…) |
| `ui/docs/*.cases.ts` | przypadki dokumentacji pogrupowane jak w menu (layout, data, sections, cache, rendering, errors, devtools); kod pokazany na stronie to region `// #region <slug>` z tych plików |
| `ui/docs/doc-view.tsx`, `ui/docs/run.ts` | strona przypadku: build z `trace`, `resolve`, raport devtools albo złapany wyjątek |
| `ui/page-view.tsx` | wspólny widok: `build` → `resolve` → `<Render registry={...}>` |
| `components/ui/*` | komponenty shadcn (card, badge, button, tabs, avatar, separator) — kod w projekcie, jak po `shadcn add` |
| `app/(shadcn)`, `app/(radix)` | osobne root layouty: Tailwind i style Radix Themes się nie mieszają |

Komponenty w `components/ui` zostały przepisane ręcznie według źródeł shadcn/ui (styl new-york, Tailwind v4, pakiet `radix-ui`).
Można je wygenerować oficjalnie: `npx shadcn@latest add card badge button tabs avatar separator`.

## Co pokazuje przykład

- **Jeden kontrakt, dwie biblioteki** — `satisfies Registry<Contract>` pilnuje, żeby oba rejestry miały wszystkie komponenty i zgodne propsy.
- **Tłumaczenie wartości w rejestrze** — `badge.variant: 'secondary'` to w shadcn `variant="secondary"`, a w Radix `variant="soft"`; `grid.gap: 'md'` to `gap-6` albo `gap="4"`.
- **Sloty** — hero (`media`, `actions` jako lista przycisków), karta (`badge`, `footer` z awatarem autora).
- **Dane do slotów selektorami** — `'card > :slot(badge)': categories`, `'card > :slot(footer)': authors`.
- **`remove` w sekcji** — „Więcej” usuwa stopki kart (`card > :slot(footer)`), 5 artykułów na 8 miejsc → 3 karty znikają.
- **Cache** — `ui.page({ ..., cache: { key: ctx => ['home', ctx.device] } })`: strona z pamięci (świeża 5 s), potem odświeżanie w tle (loader ma sztuczne 20 ms jak API).
- **Zapytanie** — `articlesQuery` (`ui.query`): artykuły cache'owane w instancji, wspólne dla strony i sekcji odroczonej.
- **Sekcja odroczona** — „Dla Ciebie” (`defer`): strona wychodzi od razu z zaślepką, a sekcja (wolne API, 600 ms) jest dostreamowana przez `<Suspense>` (`ui/page-view.tsx`).
- **RSC + komponenty klienckie** — renderer działa na serwerze; zakładki (Radix Tabs) są interaktywne na kliencie.

## Dokumentacja na przykładach (`/docs`)

Tutorial krok po kroku, a potem każda możliwość paczki, każde ostrzeżenie i każdy błąd jako osobna strona — pogrupowane w menu po lewej:

| Grupa | Przypadki |
|---|---|
| Tutorial | 12 kroków: strona główna serwisu od contract, przez data, sloty, section wspólne, warianty, patch, braki data, streaming, query i cache, po render i devtools; krok 13 — ćwiczenie z debugowania (5 ukrytych pomyłek, zadania z rozwiązaniami) |
| Layout | bloki i `repeat`, sloty, aliasy, `patch` i selektory, patch bez trafień, `remove`, usunięcie korzenia section, warianty `ctx` |
| Data | bindings, `toProps` i `defaults`, items `null`, braki (`onShortage: 'remove'` / `'keep'`), nadmiar, binding bez trafień, kolejność bindingów, dropped |
| Sections | loader section vs `data` strony, `optional` i `onSectionError`, `onEmpty` (`remove` / `keep` / blok), `required`, `defer` (streaming), `unknownData`, loader bez `return` |
| Cache & queries | cache strony, key `undefined`, statusy query (`miss` / `hit` / `stale` / `bypass`), `invalidate` |
| Rendering | brak component w registry, data nie-obiekt, wyjątek w `toProps`, `toProps` zwraca nie-obiekt, data bez node, `onIssue: 'throw'` |
| Errors (thrown) | każdy wyjątek przerywający build albo `resolve` — z treścią komunikatu |
| Devtools | panel, timing, build bez `trace` |

Każda grupa ma stronę wprowadzającą (`/docs/layout`, `/docs/data`…): po co ta część istnieje, jak działa, dlaczego tak zaprojektowana, jak używać i na co uważać — a `/docs` (Introduction) to punkt startu dla kogoś nowego: czym jest server-driven UI i jaki problem rozwiązuje, co robi Dedal, podział ról serwer / front, jak płyną data, przykład od definicji strony po JSON (`PageResult`, `ResolvedPage`) i render, słownik pojęć, typowe zadania (np. dodanie nowego component). Treść: `ui/docs/intros.ts`. Strony czyta się po kolei (link „next” na dole: wprowadzenie grupy, potem jej przypadki).

Strona przypadku: opis (co to jest, kiedy się pojawia, co zrobić), ramka „Zobacz na żywo” — co otworzyć w panelu devtools i czego tam szukać (`ui/docs/live.ts`; przy przypadkach z wyjątkiem — dlaczego panel jest pusty), kod (region z `ui/docs/*.cases.ts` — ten sam, który się wykonuje), wynik (Radix Themes), raport devtools (to samo co „copy report” w panelu) albo złapany wyjątek. Kropka przy przypadku w menu: zielona — działa, żółta — ostrzeżenie w devtools, czerwona — błąd w devtools, fioletowa — build rzuca wyjątek. Panel devtools jest włączony na każdej stronie.

## Znane różnice między bibliotekami

- Radix Themes renderuje fallback awatara (inicjały) dopiero po hydracji — w HTML z serwera `rt-AvatarFallback` jest pusty. shadcn renderuje inicjały już na serwerze.
