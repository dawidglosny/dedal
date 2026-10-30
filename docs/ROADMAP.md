# Roadmap — otwarte plany i zasady rozwoju

Rzeczy niezrobione, otwarte pytania i zasady, których trzymamy się przy dalszych pracach. Dokumentacja użytkownika (jak używać paczki) jest w [`examples/next`](../examples/next) (`/docs`) i w [README](../README.md). Wcześniejsze kontrakty (cache, devtools, wydajność) są zrealizowane — ich pełna treść, z pomiarami i uzasadnieniem decyzji, jest w historii gita (`docs/CACHE.md`, `docs/DEVTOOLS.md`, `docs/PERFORMANCE.md`, do wersji 0.5.2).

## Zasady przy dalszym rozwoju

Uzupełniają „Twarde reguły” z README.

**Cache**
- Cache włącza strona (`page({ cache: { key } })`), nie paczka. Bez automatycznego cache z key zgadniętym z `ctx` — grozi wyciekiem data między użytkownikami.
- Key jest jawny i musi obejmować wszystko, od czego zależą `sections(ctx)` i `data(ctx)`.
- Rdzeń nie zna magazynu — tylko interfejs `Store`; Redis, Mongo, KV to adaptery po stronie aplikacji albo osobne paczki.
- Cache nie zmienia kształtu wyniku; błędy nie trafiają do cache; wpisy współdzielone są zamrożone; pamięć procesu ma limit (LRU).

**Devtools**
- Zero kosztu w produkcji: rdzeń i `dedal/react` nie importują devtools; bez trybu debug wynik i DOM są identyczne.
- Payload to czysty JSON (działa w układzie backend → front); część czysta (`dedal/devtools`) nie zależy od DOM ani frameworka.
- Devtools nie zmieniają wyniku i nie wymagają współpracy registry (żadnych `data-*` ani refów w komponentach).
- Build z `trace` omija cache strony; tryb debug włącza aplikacja; panel tylko czyta.

**Wydajność**
- Optymalizacje nie zmieniają semantyki (kolejność drzewa i przypisań, ID, współdzielenie poddrzew) ani formatów na drucie.
- Żaden globalny stan paczki nie rośnie bez limitu z liczbą requestów.
- Każdą zmianę weryfikujemy pomiarem przed / po: `npm run bench` (scenariusz w `bench/bench.mjs`). Punkt odniesienia z 0.5.x: strona 530 node — build + resolve ~0,8 ms; 3620 node — ~6,5 ms.

## Otwarte

### `assign`: puste kontenery (`prune`) i node powiązane (`removeWith`)

Status: propozycja, niezaimplementowane.

**Problem.** `onShortage: 'remove'` usuwa tylko node bez data (z poddrzewem). Zostają:
- **puste kontenery** — rodzic, który stracił wszystkie dzieci (grid, grupa, kolumna), zostawia na stronie odstęp, tło albo nagłówek bez treści,
- **node powiązane** — node, który ma sens tylko obok innego (divider przed kaflem, etykieta nad card), zostaje, gdy jego „partner” zniknie.

Obejścia dziś: `null` w data dla kontenera / node powiązanego (wymaga liczenia w loaderze, ile node zostanie) albo podział na osobne section (wtedy działa `onEmpty`).

**`prune`** — po usunięciu node przez `onShortage` usuwa w górę drzewa przodków, którzy zostali bez dzieci i bez slotów i pasują do selectora; powtarzane, dopóki coś się usuwa.

```ts
ui.page({ sections, data, assign: { prune: 'grid, wrapper-group' } })   // dla strony
{ card: { items: articles, prune: 'grid' } }                            // dla bindingu
```

- usuwane są tylko node, które **straciły** dzieci w tym `assign` (kontener pusty od początku zostaje),
- node z data nie jest usuwany, nawet gdy jest pusty,
- usunięcie korzenia section działa jak `onEmpty: 'remove'` (`report.removedSections`),
- `report.sections[key].pruned: string[]` — osobno od `removed`, widoczne w devtools,
- bez `prune` zachowanie się nie zmienia.

**`removeWith`** — binding wskazuje, co znika razem z node usuniętym przez `onShortage`:

```ts
{ tile: { items: songs, removeWith: { before: 'divider' } } }
```

- `before` / `after` — sąsiad w tym samym rodzicu (po rozwinięciu `repeat`) pasujący do selectora,
- `parent` — najbliższy przodek pasujący do selectora (np. `{ parent: 'wrapper-layout' }`),
- usunięte node trafiają do `report.sections[key].removed`; w trybie debug z informacją, przez który node.

**Kolejność w `assign`:** przypisanie i `onShortage` → `removeWith` → usunięcie → `prune` → `onEmpty`.

**Pytania:**
- Czy `prune` ma mieć wartość domyślną, czy zawsze jawny selector? Jawny jest bezpieczniejszy — mówi, które component są „tylko opakowaniem”.
- `prune` w contract (flaga „kontener” per component w opcjach instancji) zamiast w każdej stronie?
- Czy node ze slotami, ale bez dzieci (card z pustym slotem) jest pusty? Propozycja: nie — sloty to treść component.

### `dedal/astro`

Status: ustalenia przed implementacją. Renderer jak `dedal/react`: `ResolvedPage` → komponenty z registry; domyślnie HTML bez JavaScriptu, interaktywne tylko wyspy.

**Wyspy klienckie (`client:*`).** Dynamiczne tagi w Astro (komponent w zmiennej) nie obsługują dyrektyw hydracji, więc renderer nie może napisać `<C client:visible />`. Wniosek: hydrację deklaruje registry — interaktywny component jest w registry wrapperem `.astro` ze statyczną dyrektywą:

```astro
---
// registry/TabsIsland.astro
import Tabs from '../components/Tabs'
---
<Tabs client:visible {...Astro.props}><slot name="content" slot="content" /></Tabs>
```

- props Dedala są JSON-em, więc pasują do wysp bez zmian,
- sloty Dedala → nazwane sloty Astro (zawartość slotu jako statyczny HTML; zagnieżdżone wyspy działają),
- później: hydracja sterowana z serwera (np. prop node `hydrate: 'visible' | 'load'`) — wrapper z gałęziami, każda ze statyczną dyrektywą.

**Wyspy serwerowe (`server:defer`).** Section z `deferred: true` → wrapper z `server:defer`, który w swoim requeście robi `page.section(key, ctx)` + `resolve` + render; fallback jako `slot="fallback"`. Props wyspy = `ctx` + key section — Astro szyfruje je w URL (GET, cache'owalny); powyżej 2048 bajtów przechodzi na POST, którego przeglądarka nie cache'uje, więc `ctx` ma być mały. Wymaga adaptera (renderowanie na żądanie).

**Pytania:**
- Czy renderer sam owija section odroczone w `server:defer`, czy robi to aplikacja?
- Jak registry deklaruje wyspy w typach (`Registry<Contract>` z wrapperami `.astro`)?
- Jak przekazać instancję strony do wyspy serwerowej (import modułu strony po key?)?
- Panel devtools w Astro (ten sam payload i `mountDevtools()`; znaczniki node bez `<Render debug>`).

### Cache i query

- **Przykład adaptera zewnętrznego** (np. Redis) w dokumentacji albo `examples`, w tym `deletePrefix` i `lock`.
- **Ostrzeżenie o za wąskim key** w trybie deweloperskim (np. ten sam key, a różny wynik dla różnych `ctx`). Otwarte: jak włączać tryb deweloperski — wspólnie z devtools.
- **Śledzenie zależności** — wpis strony zapamiętuje key query użytych przy budowie; `ui.invalidate(['menu'])` unieważnia też zależne strony. Wymaga metadanych wpisu w `Store`.
- **Prefetch / rozgrzewanie** — np. `menuQuery.prefetch(params)` przy starcie serwera.
- Poza zakresem: nagłówki cache HTTP, cache `ResolvedPage`, cache samego layoutu w procesie, gotowe adaptery w tej paczce.

### Devtools

- **Diff buildów** — porównanie dwóch payloadów (np. przed / po zmianie bloku albo dla dwóch `ctx`).
- Ewentualnie rozszerzenie przeglądarki na tym samym payloadzie.
- Poza zakresem: edycja layoutu / data z panelu.

### Wydajność

- **Ścieżka w `layout()`** — kopiowanie tablicy ścieżki (`[...path, segment]`) dla `IdContext` każdego node to największy pojedynczy koszt etapu layout.
- **Jedno przejście dla wszystkich selectorów w `assign`** (dziś: jedno na binding), z zachowaniem zasady, że wcześniejszy binding zajmuje node pierwszy. Dziś ~1,5 ms na 3620 node — wracamy, jeśli pomiar na prawdziwych stronach pokaże to jako istotny koszt.
- Świadomie bez zmian (wracamy przy realnym problemie): dodatkowe przejście w `resolve` (`collectKeys`), `JSON.stringify` w `trace`, selector potomka bez memoizacji (realne bloki < 0,1 ms), rozmiar JSON przy bardzo dużych stronach (dobrze się kompresuje).
