# Dedal

Silnik server-driven UI niezależny od frameworka i biblioteki komponentów. Template'y opisują strukturę, dane przypisywane są selektorami, a renderer (React, Astro, Vue, …) dostaje drzewo gotowe do wyrenderowania dowolną biblioteką komponentów (własny design system, MUI, Radix, …).

Nazwa od Dedala, mitycznego architekta: serwer projektuje stronę, front ją buduje.

## Instalacja

```bash
npm i github:dawidglosny/dedal#v0.6.0
```

Aktualna wersja: **0.6.0**. Wymaga Node 20.9+; React 18+ tylko dla `dedal/react` (opcjonalny `peerDependency`). Paczka buduje się przy instalacji (`prepare`).

Wejścia: `dedal` (rdzeń), `dedal/react` (renderer), `dedal/devtools` (`inspect`, raport), `dedal/devtools/panel` (panel poza Reactem), `dedal/react/devtools` (komponent `<Devtools />`).

Nowy w server-driven UI? Zacznij od dokumentacji na przykładach w [`examples/next`](examples/next) (`/docs`): wprowadzenie do idei SDUI, tutorial krok po kroku i każda możliwość, ostrzeżenie i błąd jako osobna strona.

## Pipeline

```
ctx ─► layout ─► load (IO) ─► assign ─► resolve ─► render
         │                       │          │
     LayoutNode               DataMap  ResolvedNode     ← formaty JSON, granice, na których można postawić sieć
```

Ta sama paczka obsługuje projekt fullstack (wszystko w jednym procesie) i układ backend → middleware → front (cięcie pipeline'u w dowolnym miejscu).

## Twarde reguły

1. **Formaty między etapami są czystym JSON-em** — żadnych funkcji, klas, `Symbol`, `Map`, `Date`, `undefined` jako znaczącej wartości. Pilnują tego testy round-trip `JSON.parse(JSON.stringify(x))`.
2. **Wersjonowana koperta na drucie** — `{ dedal: 1, ... }`; nieznany komponent trafia do `fallback` renderera, zamiast wywracać stronę.
3. **`page()` rozdziela `block` (czysty) od `data` (IO)** — layout da się zbudować bez danych (cache, osobny endpoint), loadery działają tylko tam, gdzie jest dostęp do danych.
4. **`toProps` to czysty moduł przy kontrakcie, bez IO** — `resolve` może działać po każdej stronie sieci.
5. **`ctx` jest serializowalny** — middleware może go przekazać dalej albo użyć w kluczu cache'a.
6. **`build()` to tylko złożenie eksportowanych etapów** — `load`, `layout`, `assign`, `resolve` są dostępne osobno.
7. **Rdzeń nie zna transportu ani frameworka** — zero zależności, ESM, działa w Node, na edge i w przeglądarce. Bindingi frameworków są w osobnych wejściach (`dedal/react`; `dedal/astro` w planach).
8. **Funkcje są czyste** — nic nie mutuje wejścia, niezmienione poddrzewa są współdzielone.
9. **Propsy przy nodzie, przed slotami i children** — `node(component, { props, slots, children })`.

## Kontrakt komponentów

Jedno źródło prawdy: nazwa komponentu → propsy. Sloty (nody w propsach) oznacza się typem `Slot` / `Slot[]`:

```ts
import type { Slot } from 'dedal'

type Contract = {
  grid: { columns?: 1 | 2 | 3 | 4 }
  card: { title?: string; href?: string; size?: 'sm' | 'md' | 'lg' }
  hero: { title?: string; media?: Slot }
  tabs: { labels?: string[]; content?: Slot[] }
}
```

Kontrakt to wyłącznie typy — używa go serwer i każdy front. Rejestr frontu (`nazwa → komponent`) spełnia kontrakt przez `satisfies Registry<Contract>`.

## API (stan obecny)

```ts
const ui = createDedal<Contract>({ defaults: { card: { size: 'md' } } })
const { node, repeat, clone } = ui

const root = ui.layout(
  node('grid', {
    props: { columns: 3 },
    children: [
      node('hero', { slots: { media: node('card') } }),
      repeat(node('card'), 6),
    ],
  }),
  'news'
)

ui.patch(root, { 'grid > card:nth-child(odd)': { size: 'lg' }, 'hero > :slot(media)': { size: 'sm' } })
ui.remove(root, 'card:nth-child(n+5)')
ui.select(root, '#featured card')

const { layout, data, report } = ui.assign(root, {
  '#hero': [hero],                                      // szczegółowe selektory przed ogólnymi
  card: articles,                                       // dane po kolei do pasujących węzłów
  'profile': { items: profiles, onShortage: 'keep' } // zasada dla pojedynczego selektora
})
```

### Strona (`page`, `section`)

```ts
const categoryPage = ui.page<{ device: 'desktop' | 'mobile'; page: number }>({
  sections: ({ device }) => [
    section('breadcrumbs', breadcrumbsBlock),
    section('pageHeader', titleBlock, { patch: { 'page-title': { headerTag: 'h1' } } }),
    device === 'desktop'
      ? section('mainContent', cardGrid9, { patch: { card: { loading: 'eager' } } })
      : section('mainContent', cardListMobile, { remove: 'divider', patch: { card: { size: 'small' } } }),
    section('about', aboutBlock),
  ],
  data: async ctx => {
    const { articles, category } = await fetchCategory(ctx)
    return {
      pageHeader: { 'page-title': [{ title: category.name }] },
      mainContent: { card: articles },
    }
  },
})

const result = await categoryPage.build({ device: 'mobile', page: 1 })
// { dedal: 1, sections: [{ key, layout }], data: { 'mainContent.0.0': ... }, report }
```

- Klucz sekcji = prefiks ID jej węzłów (`mainContent.0.2`) i klucz jej danych — ID sekcji nie zależą od sekcji nad nią.
- Sekcja: `layout` → `remove` → `patch` → `assign` (z `policies` sekcji nad zasadami instancji).
- Etapy osobno: `page.layout(ctx)` (bez IO, do cache'owania), `page.load(ctx)`, `page.assign(sections, data, ctx)`; `build` je składa.
- `report`: raport `assign` per sekcja, `unknownData` (dane bez sekcji), `removedSections`, `failedSections`, `emptySections`.
- Sekcja pusta: sekcja, która dostała bindingi (z loadera sekcji albo z `data` strony), ale po przypisaniu żaden węzeł nie ma danych — `onEmpty: 'remove'` (domyślnie, znika) | `'keep'` | `'error'` | blok (stan pusty, np. „Brak wyników”). `required: 'card'` — pusta, gdy żaden węzeł pasujący do selektora nie dostał danych (np. nagłówek dostaje je zawsze). Nie podlegają: sekcje statyczne (bez danych) i sekcje, dla których loader albo `data` strony zwróciły `undefined` — zostają z samym layoutem (devtools ostrzegają).
- Klucze sekcji muszą być unikalne na stronie, a ID węzłów — na całej stronie (dane to jedna mapa `ID → dane`); duplikat = wyjątek.

### Zapytania i loadery sekcji (`ui.query`, `section({ data })`)

```ts
// zapytanie: cache'owane źródło danych, wspólne dla stron i sekcji
const menuQuery = ui.query({
  key: ({ service }: { service: string }) => ['menu', service],
  fn: ({ service }) => api.menu(service),
  staleTime: 10 * 60_000,
})

// wspólna sekcja z własnym loaderem — dołączana do stron bez dopisywania danych w każdej
export const header = section('header', headerBlock, {
  data: async (ctx: Ctx) => ({ 'menu-item': (await menuQuery({ service: ctx.service })).items }),
})

// sekcja odroczona: w wyniku strony zaślepka, treść z page.section() w osobnym requeście (Suspense, server islands)
const forYou = section('forYou', recommendedBlock, {
  defer: { fallback: skeletonBlock },
  optional: true,                       // błąd loadera usuwa sekcję (report.failedSections) zamiast wywracać stronę
  data: async ctx => ({ card: await api.forUser(ctx.userId) }),
})

const home = ui.page<Ctx>({ sections: [header, main, forYou], data: async ctx => ({ main: { card: await api.news() } }) })
await home.section('forYou', ctx)       // sama sekcja → resolve → <Render>
```

- `page.load` uruchamia równolegle `data` strony i loadery sekcji — tylko dla sekcji obecnych w wariancie i nieusuniętych; dane sekcji z własnym loaderem zwrócone przez `data` strony = błąd.
- `ui.query` jest opcjonalny — `data` strony i loadery sekcji to zwykłe funkcje `async`; można w nich wołać dowolne źródło (`fetch`, klient API, cache, który aplikacja już ma). `ui.query` dokłada cache serwerowy instancji: deduplikację równoległych wywołań, stale-while-revalidate (`staleTime` domyślnie 5 s, `maxAge` 5 min), `ui.invalidate(prefix)` wspólne z cache'em stron i magazyn do podmiany (np. Redis).
- Wynik zapytania jest współdzielony między requestami i użytkownikami: dane zależne od użytkownika — użytkownik w kluczu albo bez `ui.query`.
- Cache żyje tyle co instancja: twórz ją raz (na poziomie modułu), nie w każdym requeście.
- Wyniki zapytań i stron z cache'u są zamrożone (tylko do odczytu): `[...items].sort()` zamiast `items.sort()`.
- `<Render deferred={({ sectionKey, fallback }) => <Suspense fallback={fallback}>…</Suspense>}>` — streaming sekcji odroczonych w Next.

### Debug (`trace`, `dedal/devtools`)

```ts
import { inspect } from 'dedal/devtools'

const result = await home.build(ctx, { trace: true })   // omija cache strony
const resolved = ui.resolve(result, { ctx, trace: true })
const payload = inspect(result, resolved)               // JSON: sekcje, węzły, selektory, pochodzenie propsów
```

- `trace`: pochodzenie każdego propsa (`default`, `template`, `patch` z selektorem i sekcją, `data`) i `report.trace` (źródło danych sekcji, klucz cache'u).
- `report.trace.timing`: czasy `layout` / `load` / `assign`, loadery (`page data` i section) i wywołania `ui.query` ze statusem cache (`hit` / `stale` / `miss` / `bypass` / `error`), przypisane do loadera. Przypisanie zapytań wymaga `AsyncLocalStorage` — globalnego w Next.js i środowiskach edge; gdzie indziej `createDedal({ AsyncLocalStorage })` z `node:async_hooks`.
- `inspect()`: indeks węzłów z sugerowanym selektorem (najkrótszy trafiający tylko w ten węzeł), danymi i selektorem, który je przypisał, oraz problemami. Diagnoza rozjazdów: bindingi bez trafień (z podpowiedzią poprawionego selektora — także nazwy slotu, np. `:slot(badges)` → `:slot(badge)`), bindingi „zajęte” przez wcześniejszy selektor, selektory `patch` / `remove` bez efektu, dane bez miejsca, usunięte węzły i porzucone dane.
- Funkcje do testów i logów: `reportText(payload)` (raport tekstowy), `pageMessages(payload)` (komunikaty `{ level, subject, text }`), `searchNodes(payload, query)` (wyszukiwanie po selektorze, ID, sekcji i danych).
- Panel w przeglądarce: `<Render debug>` (znaczniki węzłów w DOM), `<DevtoolsData payload={payload} />` (payload na stronie; payloady dostreamowanych sekcji są łączone), `<Devtools />` z `dedal/react/devtools`. Panel (Shadow DOM) ma zakładki *node* (wskaż element: ID, selektor, dane, pochodzenie propsów), *tree* (wyszukiwanie: selektor, ID, sekcja, tekst w danych), *sections* (komunikaty i bindingi), *timing* (oś czasu loaderów i zapytań) oraz `copy report`; `Alt+Shift+S` otwiera / zamyka, `⇤` / `⇥` przenosi na drugą stronę, stan jest pamiętany w karcie. Poza Reactem: `mountDevtools()` z `dedal/devtools/panel`.
- Tryb debug włącza aplikacja — payload ujawnia strukturę i dane strony. Przykład: `examples/next`, `?debug=1`.

Przewodnik (włączanie, bezpieczne włączanie na produkcji, inne środowiska, panel, typowe problemy): strona *Devtools* w dokumentacji [`examples/next`](examples/next) (`/docs/devtools`).

### Renderowalne drzewo (`resolve`)

```ts
// contract/to-props.ts — czysty moduł przy kontrakcie, importowany tam, gdzie działa resolve
export const toProps: ToProps<Contract> = {
  card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
    data ? { ...props, title: data.headline, href: data.url } : props,
}

const ui = createDedal<Contract>({ toProps })
const resolved = ui.resolve(await page.build(ctx), { ctx, trace: isDev })
// { dedal: 1, sections: [{ key, tree: ResolvedNode }], issues: [] }
```

```ts
type ResolvedNode = { key; component; props; slots?; children?; trace? }
```

- Propsy węzła: `toProps[component]({ props, data, node, ctx })`; bez mapowania — głębokie złączenie propsów layoutu z danymi (dane wygrywają). Mapowanie wywoływane jest także dla węzłów bez danych.
- Wynik mapowania jest sprawdzany kontraktem; typ `data` można zawęzić w implementacji (`ToPropsInput<C, 'card', Article>`).
- Problemy nie wywracają renderu: dane nie-obiektowe bez mapowania, wyjątek w mapowaniu, dane bez węzła (np. rozjazd cache layoutu z danymi) trafiają do `issues`, a węzeł dostaje propsy z layoutu. `onIssue: 'throw'` zamienia to na wyjątek.
- `trace: true` — przy każdym węźle `trace: { prop: PropSource }`, gdzie `PropSource` to `{ from: 'default' | 'template' | 'patch' | 'layout' | 'data' }` (`patch` z `selector` i `section`; `layout`, gdy layout zbudowano bez `trace`).
- Wejście jest sprawdzane pod kątem wersji koperty; `resolve` działa po każdej stronie sieci (wejście po `JSON.parse` daje ten sam wynik).

### Renderer React (`dedal/react`)

```tsx
import { Render, type Registry } from 'dedal/react'

export const registry = {
  card: ({ title, href }) => <a href={href}>{title}</a>,
  hero: ({ title, media }) => <header>{media}<h1>{title}</h1></header>,   // slot jako prop (ReactNode)
  tabs: ({ labels, content }) => ...,                                      // slot-lista jako ReactNode[]
  // ...
} satisfies Registry<Contract>   // brak komponentu albo złe propsy = błąd kompilacji

<Render tree={resolved} registry={registry} fallback={Missing} />
```

- Bez hooków i stanu — działa w React Server Components, przy SSR i na kliencie; komponenty z rejestru mogą być klienckie.
- Sloty trafiają do propsów o nazwie slotu, dzieci layoutu do `children` (prop `children` z kontraktu zostaje, gdy węzeł nie ma dzieci).
- Nieznany komponent → `fallback` (domyślnie nic).
- React to opcjonalny `peerDependency`; rdzeń `dedal` go nie importuje.

Przykład: [`examples/next`](examples/next) — ta sama strona na Radix Themes i shadcn/ui (jeden kontrakt, dwa rejestry), przełączanie `ctx`, tryb debug, endpoint JSON. Dokumentacja na przykładach: `/docs` w tym przykładzie — wprowadzenie do server-driven UI dla nowych osób w zespole, tutorial w 13 krokach (z ćwiczeniem z debugowania) i każda możliwość, ostrzeżenie i błąd jako osobna strona z opisem, kodem, wynikiem i raportem devtools.

Przykład: [`examples/custom-ds`](examples/custom-ds) — strona na własnym design systemie, bez renderera: zapytania, sekcje wspólne z loaderami, warianty desktop / mobile, sloty (karuzela, CTA), bindingi per komponent, sekcja zależna od danych.

### Cache stron (`page({ cache })`)

```ts
const ui = createDedal<Contract>({ toProps, cache: { staleTime: 5_000 } })   // opcjonalnie: magazyn i czasy

const home = ui.page<Ctx>({ sections, data, cache: { key: ctx => ['home', ctx.device] } })
await home.build(ctx)          // z cache'u
await ui.invalidate(['home'])  // np. po publikacji
```

- Instancja trzyma wspólny magazyn i czasy, strona podaje klucz — `key` (tablica; wszystko, od czego zależą sekcje i dane; `undefined` = bez cache'u), `staleTime` (domyślnie 5 s), `maxAge` (domyślnie 5 min), `invalidate(prefix)`.
- Stale-while-revalidate: wpis od razu, odświeżanie w tle (`waitUntil` na edge); starszy niż `maxAge` — request czeka na `build`.
- Równoległe requesty o ten sam klucz czekają na jeden `build`; błędy nie trafiają do cache'u.
- Magazyn: domyślnie `memoryStore({ max })` (LRU, zamrożone kopie wpisów); Redis / Mongo / KV przez interfejs `Store`.
- Strona bez `cache` nie jest cache'owana. Dane spersonalizowane: klucz musi obejmować użytkownika albo strona nie ma `cache`.

Więcej (wdrożenia, magazyn, query, debug): strona *Cache & queries* w dokumentacji [`examples/next`](examples/next) (`/docs/cache`).

### Przypisanie danych (`assign`)

- Elementy danych trafiają po kolei do węzłów pasujących do selektora, w kolejności drzewa.
- Selektory przetwarzane są w kolejności wpisów; węzeł zajęty przez wcześniejszy selektor (nawet bez danych) jest pomijany przez kolejne.
- `null` / `undefined` w danych = brak danych dla węzła.
- `onShortage` — węzeł bez danych: `'remove'` (domyślnie) | `'keep'` | `'error'`.
- `onSurplus` — dane bez węzła: `'ignore'` (domyślnie) | `'error'`.
- Zasady (od najsłabszej): domyślne paczki → `createDedal({ assign })` → `policies` sekcji albo wywołanie `assign(..., policies)` → `{ items, onShortage }` dla selektora.
- Usunięcie węzła usuwa jego poddrzewo; dane potomków trafiają do `report.dropped`.
- Wynik (`layout`, `data`, `report`) jest czystym JSON-em; `data` to płaska mapa `ID → dane`.

### ID

Pozycyjne, nieprzezroczyste — służą tylko do kluczowania (dane, `key` w rendererze). Domyślnie:

| węzeł | ID |
|---|---|
| korzeń | `news` |
| dziecko | `news.0`, `news.0.2` |
| slot pojedynczy | `news.0:media` |
| slot-lista | `news.1:content.0` |

Generator można podmienić opcją `id` (`createDedal({ id })`). Własny generator musi dawać ID unikalne na całej stronie — najprościej z prefiksem (kluczem sekcji), jak domyślny; duplikat w sekcji albo między sekcjami rzuca wyjątek.

### Selektory (składnia CSS)

| Selektor | Znaczenie |
|---|---|
| `card`, `*` | komponent / dowolny |
| `#hero` | alias |
| `[size]`, `[size=small]`, `[style.height="100%"]` | prop istnieje / ma wartość |
| `:first-child`, `:last-child`, `:nth-child(an+b \| odd \| even)`, `:nth-last-child(...)` | pozycja wśród rodzeństwa (od 1), w slocie-liście — w obrębie slotu |
| `:slot`, `:slot(media)` | węzeł w dowolnym / konkretnym slocie rodzica |
| `:root` | korzeń drzewa (sekcji) |
| `a b`, `a > b`, `a, b` | potomek (także przez sloty), dziecko lub zawartość slotu, lista |

Kolejność w drzewie: najpierw sloty (w kolejności kluczy), potem children. Przy kilku patchach na ten sam węzeł wygrywa późniejszy wpis; selektory dopasowywane są do drzewa wejściowego (jak CSS do DOM).

## Stan

Wersja **0.6.0**. Ostatnie zmiany:
- **0.6.0** — nowa nazwa: **Dedal** (wcześniej ssduie). Zmiany łamiące: paczka i importy `dedal`, `dedal/react`, `dedal/devtools`…; `createDedal`, `DedalOptions`, `Dedal`; koperta na drucie `{ dedal: 1, … }` (zamiast `ssduie`); znaczniki devtools `<dedal-node data-dedal-key>`, `data-dedal-devtools`, `#dedal-devtools`. API i zachowanie bez zmian.
- **0.5.3** — `<Devtools />` bez propsa `open` przywraca stan panelu zapamiętany w karcie przeglądarki (wcześniej zawsze startował zamknięty); przewodnik po devtools przeniesiony do `/docs` (strona *Devtools*: włączanie w Next, bezpieczne włączanie, typowe problemy, koszty); kontrakty deweloperskie z `docs/` zastąpione przez [docs/ROADMAP.md](docs/ROADMAP.md).
- **0.5.2** — devtools podpowiadają poprawną nazwę slotu dla bindingu bez trafień (`card > :slot(badges)` → `card > :slot(badge)`); dokumentacja `examples/next` (`/docs`) sprawdzona z kodem i rozbudowana dla osób nowych w server-driven UI.
- **0.5.1** — ID węzłów unikalne między sekcjami (wyjątek przy duplikacie z własnego generatora); problemy węzłów (`resolve` issues) w komunikatach i raporcie devtools; czytelniejsze komunikaty `required` / `remove`.
- **0.5.0** — devtools: zakładka *timing*, `copy report`, wyszukiwanie w drzewie (selektor, ID, sekcja, dane), zapamiętany stan panelu, `Alt+Shift+S`, przełączanie strony panelu.

Gotowe: kontrakt i typy, `createDedal`, buildery, `layout()` ze slotami, selektory, `patch` / `remove` / `select` (z zawężaniem typu dla `select(root, 'card')`), `assign`, `page` / `section`, `resolve` / `resolveTree`, `dedal/react`, cache stron, zapytania, loadery sekcji, sekcje odroczone, `dedal/devtools` (inspect, panel), `examples/next`.

Dalej: `dedal/astro`; `assign` — usuwanie pustych kontenerów (`prune`) i węzłów powiązanych (`removeWith`); cache — przykład adaptera Redis, śledzenie zależności stron od zapytań; devtools — diff buildów; wydajność — `layout()` i jedno przejście w `assign`. Szczegóły, otwarte pytania i zasady rozwoju: [docs/ROADMAP.md](docs/ROADMAP.md). Pomiary: `npm run bench`.
