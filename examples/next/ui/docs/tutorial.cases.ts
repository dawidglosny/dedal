import type { Article } from '@/content/articles'
import type { Ctx } from '../contract'
import { articles, build, ui } from './shared'
import type { DocCase } from './types'

const { node, repeat, section } = ui
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// #region tutorial-contract
// a page with one static section — layout only, no data yet
const welcome = ui.page<Ctx>({
  sections: [
    section(
      'welcome',
      node('section', { props: { title: 'Witaj w Dedalu', description: 'Ta section to jeden node z props — zgodnych z contract.' } })
    ),
  ],
})
// #endregion

// #region tutorial-first-block
// a block: a section with a grid of three cards — a plain value, reusable in any page
const staticNews = node('section', {
  props: { title: 'Najnowsze' },
  children: [
    node('grid', {
      props: { columns: 3 },
      // repeat: one card definition, three nodes (each with its own ID)
      children: [repeat(node('card', { props: { title: 'Tytuł artykułu', href: '#' } }), 3)],
    }),
  ],
})

const firstBlock = ui.page<Ctx>({ sections: [section('news', staticNews)] })
// #endregion

// #region tutorial-data
// the same block without fixed texts — data will fill the cards
const latest = node('section', {
  props: { title: 'Najnowsze' },
  children: [node('grid', { props: { columns: 3 }, children: [repeat(node('card'), 3)] })],
})

const withData = ui.page<Ctx>({
  sections: [section('news', latest)],
  // page data: section key → bindings { selector: items }
  data: async () => ({ news: { card: await articles(3) } }),
})
// #endregion

// #region tutorial-to-props
// the page from the previous step — nothing changes here:
// cards get `title`, `href`, `description`, `image` from toProps (ui/to-props.ts) and `size: "md"` from defaults (ui/dedal.ts)
const toPropsStep = withData
// #endregion

// #region tutorial-slots
// a parametrised block: title, number of cards, columns; every card has two slots — badge and footer
const cards = (title: string, count: number, columns: 1 | 2 | 3 | 4 = 3) =>
  node('section', {
    props: { title },
    children: [
      node('grid', {
        props: { columns },
        children: [repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), count)],
      }),
    ],
  })

// data per component: articles for cards, categories for badges, authors for footers
const newsData = (list: Article[]) => ({
  card: list,
  'card > :slot(badge)': list.map(article => article.category),
  'card > :slot(footer)': list.map(article => article.author),
})

const withSlots = ui.page<Ctx>({
  sections: [section('news', cards('Najnowsze', 3))],
  data: async () => ({ news: newsData(await articles(3)) }),
})
// #endregion

// #region tutorial-shared-section
// a shared section with its own loader — define once, add to any page
const hero = section('hero', node('hero', { slots: { media: node('image'), actions: [node('button')] } }), {
  data: async () => {
    const [featured] = await articles(1)
    return {
      hero: [featured],
      image: [featured],
      'hero > :slot(actions)': [{ label: 'Czytaj', href: `/artykul/${featured.slug}` }],
    }
  },
})

const withHero = ui.page<Ctx>({
  sections: [hero, section('news', cards('Najnowsze', 3))],
  // page data covers the other sections; both loaders run in parallel
  data: async () => ({ news: newsData((await articles(4)).slice(1)) }),
})
// #endregion

// #region tutorial-variants
const withVariants = ui.page<Ctx>({
  // sections depend on ctx: on mobile one column and two cards
  sections: ({ device }) => [
    hero,
    section('news', device === 'mobile' ? cards('Najnowsze', 2, 1) : cards('Najnowsze', 3)),
  ],
  data: async ({ device }) => ({ news: newsData((await articles(device === 'mobile' ? 3 : 4)).slice(1)) }),
})
// #endregion

// #region tutorial-patch-remove
const withPatches = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section(
      'news',
      cards('Najnowsze', 3, device === 'mobile' ? 1 : 3),
      // the first card featured (two columns wide) — only where the grid has room for it
      device === 'desktop' ? { patch: { 'card:first-child': { size: 'lg' } } } : {}
    ),
    section('more', cards('Więcej', 4, device === 'mobile' ? 2 : 4), {
      // the same block in a compact version: no author footer, small cards
      remove: 'card > :slot(footer)',
      patch: { card: { size: 'sm' } },
    }),
  ],
  data: async () => {
    const list = await articles(8)
    return { news: newsData(list.slice(1, 4)), more: { card: list.slice(4), 'card > :slot(badge)': list.slice(4).map(article => article.category) } }
  },
})
// #endregion

// #region tutorial-missing-data
const withMissingData = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section('news', cards('Najnowsze', 3, device === 'mobile' ? 1 : 3)),
    // no active promotions → the section disappears (default onEmpty: 'remove')
    section('promotions', cards('Promocje', 3)),
    section('recommendations', cards('Polecane', 3), {
      optional: true, // the recommendations API failing must not take the whole page down
      data: async () => {
        throw new Error('recommendations API: 503')
      },
    }),
  ],
  data: async () => ({ news: newsData((await articles(4)).slice(1)), promotions: { card: [] } }),
  onSectionError: (error, { section }) => console.warn(`[tutorial] ${section}:`, (error as Error).message),
})
// #endregion

// #region tutorial-defer
const withDeferred = ui.page<Ctx>({
  sections: ({ device }) => [
    hero,
    section('news', cards('Najnowsze', 3, device === 'mobile' ? 1 : 3)),
    // slow, personalised recommendations: the page goes out right away with a fallback, the section is streamed later
    section('forYou', cards('Dla Ciebie', 3), {
      defer: { fallback: node('section', { props: { title: 'Dla Ciebie', description: 'Ładowanie rekomendacji…' } }) },
      data: async () => {
        await wait(800)
        return newsData((await articles(7)).slice(4))
      },
    }),
  ],
  data: async () => ({ news: newsData((await articles(4)).slice(1)) }),
})
// #endregion

// #region tutorial-queries-cache
// a query: articles fetched once per key and shared by every loader (and every request, for staleTime)
const latestArticles = ui.query({ key: (count: number) => ['tutorial', 'articles', count], fn: articles, staleTime: 60_000 })

const heroFromQuery = section('hero', node('hero', { slots: { media: node('image'), actions: [node('button')] } }), {
  data: async () => {
    const [featured] = await latestArticles(8) // the same query as the page data below — fetched once
    return { hero: [featured], image: [featured], 'hero > :slot(actions)': [{ label: 'Czytaj', href: `/artykul/${featured.slug}` }] }
  },
})

const home = ui.page<Ctx>({
  sections: ({ device }) => [
    heroFromQuery,
    section('news', cards('Najnowsze', 3, device === 'mobile' ? 1 : 3), device === 'desktop' ? { patch: { 'card:first-child': { size: 'lg' } } } : {}),
    section('more', cards('Więcej', 4, device === 'mobile' ? 2 : 4), { remove: 'card > :slot(footer)', patch: { card: { size: 'sm' } } }),
  ],
  data: async () => {
    const list = await latestArticles(8)
    return { news: newsData(list.slice(1, 4)), more: { card: list.slice(4), 'card > :slot(badge)': list.slice(4).map(article => article.category) } }
  },
  // the whole page result cached per device (stale-while-revalidate; debug builds bypass it)
  cache: { key: ctx => ['tutorial-home', ctx.device] },
})
// #endregion

// #region tutorial-render
// server (React Server Component):
//   const result = await home.build(ctx)                   // layout + data (PageResult, JSON)
//   const resolved = ui.resolve(result, { ctx })            // final props (ResolvedPage, JSON)
//   return <Render tree={resolved} registry={radixThemes} />
//
// debug mode (the app decides when — e.g. ?debug=1 for the team):
//   const result = await home.build(ctx, { trace: true })
//   const resolved = ui.resolve(result, { ctx, trace: true })
//   <Render tree={resolved} registry={radixThemes} debug />
//   <DevtoolsData payload={inspect(result, resolved)} />
//   <Devtools />
const finalPage = home
// #endregion

// #region tutorial-debugging
// the tutorial page — with five mistakes hidden in it
const latestTwelve = ui.query({ key: () => ['tutorial', 'articles', 12], fn: () => articles(12), staleTime: 60_000 })

const debugging = ui.page<Ctx>({
  sections: ({ device }) => [
    heroFromQuery,
    section(
      'news',
      node('section', {
        props: { title: 'Najnowsze' },
        children: [
          node('grid', {
            props: { columns: device === 'mobile' ? 1 : 3 },
            children: [
              node('card', { alias: 'lead', props: { size: 'lg' }, slots: { badge: node('badge'), footer: node('avatar') } }),
              repeat(node('card', { slots: { badge: node('badge'), footer: node('avatar') } }), 3),
            ],
          }),
        ],
      })
    ),
    section('promotions', cards('Promocje', 3)),
    section('recommendations', cards('Polecane', 3), {
      optional: true,
      data: async () => {
        throw new Error('recommendations API: 503')
      },
    }),
    section('more', cards('Więcej', 3, device === 'mobile' ? 2 : 3), { remove: 'card > :slot(footer)', patch: { card: { size: 'sm' } } }),
    section('popular', cards('Popularne', 3), {
      data: async () => {
        await wait(600) // a slow "most read" service, called on every request
        return newsData((await articles(10)).slice(7))
      },
    }),
  ],
  data: async () => {
    const list = await latestTwelve()
    const lead = list[11] // chosen by the editors: "Ostatni artykuł z mocka"
    return {
      news: { ...newsData(list.slice(1, 5)), '#lead': [lead] },
      promotion: { card: list.slice(5, 8) },
      more: { card: list.slice(8, 11), 'card > :slot(badges)': list.slice(8, 11).map(article => article.category) },
    }
  },
})
// #endregion

export const tutorialCases: DocCase[] = [
  {
    slug: 'tutorial-contract',
    title: '1. Contract',
    level: 'ok',
    files: [{ title: 'contract', file: 'ui/contract.ts' }],
    description: `Zaczynamy od **contract** — typu, który opisuje, jakie component może mieć strona i jakie mają props. To jedyne miejsce, które serwer i front muszą znać wspólnie.

- \`card: { title: string; href: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }\` — props card; \`Slot\` to miejsce na inny component (badge, avatar),
- wartości są neutralne (\`sm | md | lg\`), a nie z konkretnej biblioteki — każda registry (shadcn, Radix, własny DS) tłumaczy je po swojemu,
- \`Ctx\` — kontekst requestu (tu \`device\`), od którego mogą zależeć section i data.

Poniżej pierwsza strona: jedna section z jednym node \`section\` i jego props. Jeszcze bez data — tylko layout.`,
    run: build(ui, welcome),
  },
  {
    slug: 'tutorial-first-block',
    title: '2. Instance and the first block',
    level: 'ok',
    files: [{ title: 'instance', file: 'ui/dedal.ts' }],
    description: `**Instancja** (\`createDedal<Contract>(options)\`) to punkt wejścia: z niej bierzesz \`node\`, \`repeat\`, \`section\`, \`page\`, \`query\`, \`resolve\`. Tworzysz ją raz na projekt (moduł), z domyślnymi props component i mapowaniami data (o nich w kroku 4).

**Blok** to drzewo node: \`node(component, { props, children, slots })\`. \`repeat(node, 3)\` powiela node — tu jedną definicję card na trzy. Blok to zwykła wartość: można go eksportować, parametryzować i używać w wielu stronach.

Każdy node dostaje ID z pozycji (\`news.0.0\`, \`news.0.1\`…) — po nim layout spotyka się z data.

Card mają na razie wpisane na sztywno \`title\` — w następnym kroku zastąpią je data.`,
    run: build(ui, firstBlock),
  },
  {
    slug: 'tutorial-data',
    title: '3. Page data and bindings',
    level: 'ok',
    description: `Blok nie ma już tekstów — data przychodzą z \`data\` strony. Kształt: \`{ kluczSection: { selector: items } }\`. Każdy wpis to **binding**: selector \`card\` wybiera node w section \`news\`, a kolejne artykuły trafiają do kolejnych card.

Dlaczego selector, a nie po prostu lista? Bo blok może się zmieniać (dojdzie nagłówek, druga siatka) — binding \`card\` dalej trafia w card, niezależnie od ich miejsca.

\`data\` to zwykła funkcja async — wołasz w niej API, bazę, cokolwiek. Tu mock \`articles(3)\`.`,
    run: build(ui, withData),
  },
  {
    slug: 'tutorial-to-props',
    title: '4. toProps and defaults',
    level: 'ok',
    files: [
      { title: 'toProps', file: 'ui/to-props.ts' },
      { title: 'instance options', file: 'ui/dedal.ts' },
    ],
    description: `Artykuł z API ma pola \`headline\`, \`slug\`, \`cover\` — a card w contract chce \`title\`, \`href\`, \`image\`. Tłumaczy to **toProps**: per component funkcja \`({ props, data }) => props\`.

- dostaje props z layoutu i data node; jej wynik to ostateczne props — dlatego rozwija \`...props\`,
- jest wołana też dla node bez data (\`data: undefined\`) — stąd warunek \`data ? … : props\`,
- to czysty moduł bez IO: działa na serwerze i na froncie.

**defaults** (\`card: { size: 'md' }\`) to domyślne props component — \`node()\` dokłada je przy tworzeniu bloku. Pierwszeństwo: \`defaults\` → props z layoutu → data.

Strona jest ta sama co w kroku 3 — zmienia się tylko zrozumienie, skąd card mają \`title\` i \`size\`.`,
    run: build(ui, toPropsStep),
  },
  {
    slug: 'tutorial-slots',
    title: '5. Slots',
    level: 'ok',
    description: `Card ma w contract dwa **sloty**: \`badge\` i \`footer\`. W bloku wypełniamy je node (\`badge\`, \`avatar\`) — to serwer decyduje, co jest w slocie.

Data do slotów przypisuje się selectorem \`:slot(nazwa)\`: \`card > :slot(badge)\` to badge w każdej card. Data są przygotowane **per component**: artykuły dla card, kategorie dla badge, autorzy dla avatar — pomocnicza \`newsData(list)\` składa to w bindings.

Blok jest teraz funkcją \`cards(title, count, columns)\` — użyjemy go dla kilku section.`,
    run: build(ui, withSlots),
  },
  {
    slug: 'tutorial-shared-section',
    title: '6. A shared section with a loader',
    level: 'ok',
    description: `Hero (wyróżniony artykuł) ma być na wielu stronach. Zamiast powtarzać jego data w \`data\` każdej strony, section dostaje **własny loader**: \`section(key, block, { data })\` — zwraca bindings tylko tej section.

Taką section definiuje się raz (eksport z modułu) i dodaje do dowolnej strony — tak robi się header, footer, menu. Loader section i \`data\` strony działają **równolegle**.

Data strony nie mogą zwracać nic pod key section z loaderem — to błąd (nie wiadomo, które wygrywa).`,
    run: build(ui, withHero),
  },
  {
    slug: 'tutorial-variants',
    title: '7. Variants (ctx)',
    level: 'ok',
    description: `\`sections\` może być funkcją \`ctx\`. Tu na \`mobile\` section \`news\` ma jedną kolumnę i dwie card; \`data\` też dostaje \`ctx\` i pobiera tyle artykułów, ile trzeba.

Ten sam mechanizm obsługuje A/B testy, wersje językowe, różne układy per serwis — warianty to zwykły kod na serwerze, front nic o nich nie wie.

Ten krok jest renderowany z \`device: "mobile"\`.`,
    run: build(ui, withVariants, { device: 'mobile' }),
  },
  {
    slug: 'tutorial-patch-remove',
    title: '8. patch and remove',
    level: 'ok',
    description: `Często potrzebujesz bloku „prawie takiego samego”. Zamiast go kopiować, section modyfikuje blok:

- \`patch: { 'card:first-child': { size: 'lg' } }\` — pierwsza card wyróżniona (tylko na desktop),
- \`remove: 'card > :slot(footer)'\` + \`patch: { card: { size: 'sm' } }\` — section „Więcej” to ten sam blok \`cards\` w wersji kompaktowej.

Selektory mają składnię CSS (\`:first-child\`, \`>\`, \`:slot()\`, \`#alias\`, \`[size=lg]\`) — ten sam matcher działa w patch, remove, bindings i devtools.`,
    run: build(ui, withPatches),
  },
  {
    slug: 'tutorial-missing-data',
    title: '9. When data is missing',
    level: 'error',
    description: `Prawdziwe API bywa puste albo nie działa. Dedal każe zdecydować jawnie, co wtedy:

- **promocje** — źródło zwraca pustą listę; section, w której żaden node nie dostał data, domyślnie znika (\`onEmpty: 'remove'\`),
- **polecane** — API rzuca błąd; \`optional: true\` usuwa tylko tę section, a błąd trafia do \`onSectionError\` (logi). Bez \`optional\` cały build by się wywrócił.

Strona się renderuje, a devtools mówią, co zniknęło i dlaczego — to pierwszy krok, w którym panel pokazuje błąd i ostrzeżenie.`,
    run: build(ui, withMissingData),
  },
  {
    slug: 'tutorial-defer',
    title: '10. A deferred section (streaming)',
    level: 'ok',
    description: `Rekomendacje „Dla Ciebie” są wolne (800 ms) i spersonalizowane. \`defer: { fallback }\` sprawia, że wynik strony zawiera tylko zaślepkę, a loader się nie wykonuje — strona wychodzi od razu.

Treść section buduje \`page.section('forYou', ctx)\` w osobnym requeście; w Next to async komponent w \`<Suspense>\` — React dostreamowuje go, gdy będzie gotowy. Section odroczona jest też poza cache strony — dobre miejsce na data per użytkownik.`,
    run: build(ui, withDeferred),
  },
  {
    slug: 'tutorial-queries-cache',
    title: '11. Queries and cache',
    level: 'ok',
    description: `Hero i \`data\` strony potrzebują tych samych artykułów. \`ui.query({ key, fn, staleTime })\` pobiera je raz na key i współdzieli — między loaderami tego samego requestu i między requestami (do \`staleTime\`).

\`cache: { key: ctx => ['tutorial-home', ctx.device] }\` cache'uje cały wynik strony per device (stale-while-revalidate). Key musi obejmować wszystko, od czego zależą section i data.

Tryb debug omija cache strony (devtools pokazują świeży build), ale query dalej korzystają z cache — w *timing* widać, które to \`hit\`, a które \`miss\`.`,
    run: build(ui, home),
  },
  {
    slug: 'tutorial-render',
    title: '12. Rendering and devtools',
    level: 'ok',
    files: [{ title: 'registry (card)', file: 'ui/registries/radix-themes.tsx', region: 'card' }],
    description: `Ostatni krok to front. \`ui.resolve(result)\` łączy layout z data w drzewo \`{ component, props, children, slots }\`, a \`<Render tree registry>\` zamienia je w React.

**Registry** mapuje nazwy component na komponenty biblioteki — powyżej card w Radix Themes: dostaje props z contract (\`title\`, \`href\`, \`size\`) i sloty jako elementy React (\`badge\`, \`footer\`). \`satisfies Registry<Contract>\` pilnuje przy kompilacji, że registry ma wszystkie component.

W trybie debug dochodzą \`trace\`, \`<Render debug>\`, \`<DevtoolsData>\` i \`<Devtools />\` — panel, którego używałeś w tym tutorialu. Gotowa strona z tego tutorialu to w praktyce strona główna tego przykładu (\`/radix\`, \`/shadcn\` — ta sama strona, dwie registry).

Dalej: krok 13 — ćwiczenie z debugowania. Potem grupy *Layout*, *Data*, *Sections*… opisują każdą możliwość osobno, a *Errors* — co robić, gdy build rzuca wyjątek.`,
    run: build(ui, finalPage),
  },
  {
    slug: 'tutorial-debugging',
    title: '13. Debugging',
    level: 'error',
    codeCollapsed: true,
    description: `Dostajesz zgłoszenie od redakcji: „strona główna wygląda prawie dobrze, ale coś jest nie tak”. To ta sama strona co w tutorialu — z pięcioma pomyłkami, jakie zdarzają się w prawdziwym projekcie. Nic nie rzuca wyjątku, strona się renderuje — problemy widać dopiero, gdy się przyjrzysz.

Znajdź przyczyny **panelem devtools** (przycisk **dedal** w prawym dolnym rogu albo \`Alt+Shift+S\`), zanim zajrzysz do kodu — kod jest niżej, zwinięty. Każde zadanie to objaw, podpowiedź, gdzie szukać, i rozwiązanie do rozwinięcia.

Dobra kolejność przy każdym zgłoszeniu: *sections* (czy są ostrzeżenia i błędy) → \`pick\` na podejrzany element → *tree* z wyszukiwaniem → *timing*, gdy chodzi o czas. Raport z \`copy report\` dołącz do zgłoszenia.`,
    tasks: [
      {
        symptom: 'Redakcja wyróżniła artykuł „Ostatni artykuł z mocka”, ale nie ma go na stronie — duża karta w „Najnowsze” pokazuje inny artykuł.',
        hint: '*tree* → wpisz w pole wyszukiwania „Ostatni artykuł”. Potem *sections* → section `news`.',
        solution: `Wyszukiwanie mówi: \`! not on the page: section news · #lead [0] …\` — artykuł dotarł do data, ale nie trafił do żadnego node. W *sections*: \`✗ #lead — 1 data item for 0 nodes\` i \`“#lead” matches nodes already filled by “card”\`.

Przyczyna: binding \`card\` stoi przed \`#lead\`, więc zajmuje wszystkie card — także tę z aliasem \`lead\`. Node zajęty przez wcześniejszy binding jest pomijany przez kolejne.

Poprawka — szczegółowe bindings przed ogólnymi. Wyróżniona card ma też sloty (\`badge\`, \`footer\`), więc dostaje własne data do nich — inaczej \`card > :slot(badge)\` dałby jej kategorię innego artykułu:

\`\`\`ts
news: {
  '#lead': [lead],
  '#lead > :slot(badge)': [lead.category],
  '#lead > :slot(footer)': [lead.author],
  ...newsData(list.slice(1, 4)), // trzy pozostałe card
},
\`\`\``,
      },
      {
        symptom: 'W section „Więcej” karty nie mają kategorii (badge są puste).',
        hint: '*sections* → section `more` → bindings. Albo `pick` na pusty badge.',
        solution: `*sections*: \`✗ card > :slot(badges) — 3 data items for 0 nodes\` i \`No node in this section matches “card > :slot(badges)” … Did you mean: card > :slot(badge)?\`. \`pick\` na badge pokazuje, że nie ma data.

Przyczyna: literówka w nazwie slotu — w contract slot nazywa się \`badge\`. Selector, który nic nie trafia, nie rzuca wyjątku; data po prostu nie trafiają na stronę.

Poprawka: \`'card > :slot(badge)'\`. Selector możesz sprawdzić przed zmianą kodu: wpisz go w pole *tree* — panel pokaże, w które node trafia.`,
      },
      {
        symptom: 'Brakuje section „Polecane”.',
        hint: '*sections* → komunikaty strony na górze. Potem *timing*.',
        solution: `*sections*: \`✗ recommendations failed — the loader threw "recommendations API: 503"; the section is skipped (optional: true)\`. W *timing* loader \`recommendations\` jest czerwony.

Przyczyna: API rekomendacji nie działa. Section ma \`optional: true\`, więc zniknęła zamiast wywracać stronę — to zamierzone zachowanie, ale trzeba to zauważyć. Błąd trafia też do \`onSectionError\` strony — tam podepnij logi i alerty, żeby takie rzeczy nie umykały.`,
      },
      {
        symptom: 'W section „Promocje” są puste karty — bez tytułów i bez treści.',
        hint: '*sections* → komunikaty strony; zwróć uwagę na `source` przy section `promotions`.',
        solution: `*sections*: \`! promotion unknownData — data returned for a section that is not on this page … Did you mean: promotions?\`. Section \`promotions\` ma \`source: none\` — nie dostała żadnych data, więc renderuje sam layout.

Przyczyna: literówka w key section w \`data\` strony (\`promotion\` zamiast \`promotions\`). Data pod nieznanym key są pomijane.

Poprawka: \`promotions: { card: list.slice(5, 8) }\`. Gdyby promocji naprawdę nie było, section z pustą listą zniknęłaby sama (\`onEmpty: 'remove'\`) — puste karty to znak, że data w ogóle nie dotarły.`,
      },
      {
        symptom: 'Strona ładuje się wolno — ponad pół sekundy, choć API odpowiada w ~20 ms.',
        hint: '*timing* → który loader jest `slowest`.',
        solution: `*timing*: loader \`popular\` trwa ~600 ms i jest oznaczony \`slowest\` — data loading czeka na najwolniejszy loader, więc cała strona trwa tyle co on. Nie ma pod nim żadnego query — wynik nie jest cache'owany.

Poprawki (do wyboru):
- query w loaderze: \`const popular = ui.query({ key: () => ['popular'], fn: fetchPopular, staleTime: 60_000 })\` i \`await popular()\` — wolne wywołanie raz na minutę, a nie przy każdym requeście,
- \`defer: { fallback }\` — strona wychodzi od razu, „Popularne” dochodzą streamingiem,
- cache całej strony (\`page({ cache })\`) — na produkcji wolny build zdarza się tylko po wygaśnięciu wpisu.`,
      },
    ],
    run: build(ui, debugging),
  },
]
