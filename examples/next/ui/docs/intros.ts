/**
 * Group pages of the docs: context for someone new — what a part of Dedal is for, how it works, why it is designed
 * this way, how to use it and what to watch out for. Polish prose, technical names in English.
 */
export const intros = {
  introduction: `Dedal to biblioteka do budowania stron w modelu **server-driven UI**. Jeśli to pojęcie jest dla Ciebie nowe, zacznij tutaj: ta strona wyjaśnia ideę, pokazuje na prawdziwym przykładzie, co dzieje się z data krok po kroku, i zbiera słownik pojęć używanych w całej dokumentacji.

## Problem: układ strony zaszyty we froncie

W klasycznej aplikacji układ strony jest w kodzie frontu: komponent strony głównej importuje \`<Hero>\`, \`<NewsGrid>\`, \`<Promotions>\` i układa je w JSX. Serwer (API) dostarcza tylko data — listy artykułów, promocje, menu.

Każda zmiana układu — kolejność bloków, nowa section, inna liczba kart na mobile, wariant A/B, ukrycie promocji w jednym serwisie — to zmiana kodu frontu i jego wdrożenie. Gdy frontów jest kilka (web, aplikacja), tę samą zmianę robi się kilka razy.

## Idea server-driven UI

Serwer wysyła nie tylko data, ale **opis ekranu**: drzewo „component \`grid\` z props \`{ columns: 2 }\`, w nim dwa \`card\` z takimi tytułami”. Front ma katalog komponentów (w Dedalu: **registry**) i renderuje to, co dostał. Nie wie, jaką stronę składa ani skąd wzięły się data.

Analogia: front ma klocki, serwer przysyła instrukcję, jak je złożyć. Nowa instrukcja (inny układ) nie wymaga nowych klocków. Nowy rodzaj klocka (nowy component) — już tak, i to jedyna zmiana, która dotyka frontu.

\`\`\`
klasycznie
  front:   <Grid columns={2}><Card title={a.title} /> …</Grid>     ← układ w kodzie frontu
  API:     [{ title: "Pierwszy" }, …]                               ← tylko data

server-driven UI
  serwer:  { component: "grid", props: { columns: 2 },
             children: [{ component: "card", props: { title: "Pierwszy" } }, …] }
  front:   registry { grid: Grid, card: Card } + <Render tree={…} /> ← generyczny renderer
\`\`\`

## Co dokładnie robi Dedal

Dedal nie dostarcza komponentów ani klienta API — przynosisz własne (shadcn, Radix, własny design system; fetch, SDK, baza). Dostarcza to, co jest pomiędzy:

- **opis układu w TypeScript** — bloki budowane funkcją \`node()\`, typowane contractem: literówka w nazwie component albo propsa to błąd kompilacji,
- **łączenie układu z data** — data trafiają na miejsca w układzie przez selectory w składni CSS (\`card\`, \`#featured\`, \`card > :slot(badge)\`), a nie przez indeksy,
- **jawne zasady na braki** — co zrobić, gdy artykułów jest mniej niż kart, gdy API nie odpowiada, gdy section jest pusta,
- **cache** stron i źródeł data (stale-while-revalidate) oraz **streaming** wolnych section,
- **renderer React** (\`<Render>\`) i **devtools** — panel, który pokazuje, skąd wziął się każdy prop i co poszło nie tak.

## Kto za co odpowiada

Model ma dwie strony:
- **serwer** definiuje strony (bloki, section, loadery data), buduje wynik (\`build\`) i łączy layout z data w props (\`resolve\`),
- **front** ma registry i renderuje gotowe drzewo (\`<Render>\`).

Łączy je **contract** — typ TypeScript opisujący, jakie component istnieją i jakie mają props. To jedyna rzecz, którą obie strony muszą znać wspólnie.

W tym przykładzie (Next.js, App Router) obie strony żyją w jednej aplikacji: \`build\` i \`resolve\` działają w Server Component, a \`<Render>\` od razu renderuje wynik. Podział i tak obowiązuje: ta sama strona jest dostępna jako JSON (\`/api/home\`), więc mógłby ją renderować zupełnie inny front, np. aplikacja mobilna z własną registry.

## Jak płyną data

\`\`\`
contract (typ)       — jakie component istnieją i jakie mają props / sloty
   │
blocks               — node('card', { props, slots, children }) — struktura bez data i bez ID
   │
page({ sections, data })
   │  build(ctx)      layout (ID, remove, patch) → load (data strony, loadery section) → assign (bindings)
   ▼
PageResult (JSON)    — layout (drzewo node z ID) i data (ID node → data) osobno + raport;
   │                   można go cache'ować i wysłać przez sieć
   │  resolve()       props z layoutu + data node → ostateczne props (toProps albo deep merge)
   ▼
ResolvedPage (JSON)  — drzewo { key, component, props, slots, children }
   │  <Render registry>
   ▼
React                — registry zamienia nazwę component na komponent React
\`\`\`

Każdy etap ma jedną odpowiedzialność. Layout nie zna data (da się go zbudować bez wywołań API), data nie znają layoutu (trafiają na miejsce przez selector), a front nie zna ani bloków, ani źródeł data — dostaje gotowe drzewo.

## Przykład od początku do końca

Strona z jedną section: siatka z dwiema kartami, w każdej karcie slot na badge.

\`\`\`ts
type Contract = {
  grid: { columns?: number }
  card: { title: string; href: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }
  badge: { label: string }
}

const ui = createDedal<Contract>({
  defaults: { card: { size: 'md' } },
  toProps: {
    // toProps jest wołane także dla node bez data (data: undefined) — stąd warunek
    card: ({ props, data }: ToPropsInput<Contract, 'card', Article>) =>
      data ? { ...props, title: data.headline, href: \`/a/\${data.slug}\` } : props,
    badge: ({ props, data }: ToPropsInput<Contract, 'badge', string>) => (data ? { ...props, label: data } : props),
  },
})

const home = ui.page({
  sections: [
    ui.section('news', ui.node('grid', {
      props: { columns: 2 },
      children: [ui.repeat(ui.node('card', { slots: { badge: ui.node('badge') } }), 2)],
    })),
  ],
  data: async () => ({
    news: {                                        // key section
      card: await api.latest(2),                   // [{ headline: 'Pierwszy', slug: 'pierwszy' }, …]
      'card > :slot(badge)': ['Sport', 'Kraj'],     // badge w każdej card
    },
  }),
})
\`\`\`

**Krok 1.** \`await home.build()\` zwraca \`PageResult\` — layout i data osobno (skrócone):

\`\`\`
sections: [{ key: 'news', layout:
  { id: 'news', component: 'grid', props: { columns: 2 }, children: [
    { id: 'news.0', component: 'card', props: { size: 'md' },
      slots: { badge: { id: 'news.0:badge', component: 'badge', props: {} } } },
    { id: 'news.1', component: 'card', props: { size: 'md' },
      slots: { badge: { id: 'news.1:badge', component: 'badge', props: {} } } } ] } }]
data: {
  'news.0': { headline: 'Pierwszy', slug: 'pierwszy' },
  'news.1': { headline: 'Drugi', slug: 'drugi' },
  'news.0:badge': 'Sport',
  'news.1:badge': 'Kraj',
}
report: { … }   — co przypisano, co usunięto, czego zabrakło
\`\`\`

Każdy node dostał ID z pozycji (\`news.0\` — pierwsze dziecko korzenia section \`news\`, \`news.0:badge\` — jego slot \`badge\`), \`size: 'md'\` pochodzi z \`defaults\`, a data są przypisane do ID — jeszcze niepołączone z props.

**Krok 2.** \`ui.resolve(result)\` łączy jedno z drugim przez \`toProps\` i zwraca \`ResolvedPage\`:

\`\`\`
{ key: 'news', component: 'grid', props: { columns: 2 }, children: [
  { key: 'news.0', component: 'card', props: { size: 'md', title: 'Pierwszy', href: '/a/pierwszy' },
    slots: { badge: { key: 'news.0:badge', component: 'badge', props: { label: 'Sport' } } } },
  … ] }
\`\`\`

**Krok 3.** \`<Render tree={resolved} registry={{ grid: Grid, card: Card, badge: Badge }} />\` renderuje w praktyce to samo, co ten JSX:

\`\`\`tsx
<Grid columns={2}>
  <Card size="md" title="Pierwszy" href="/a/pierwszy" badge={<Badge label="Sport" />} />
  <Card size="md" title="Drugi" href="/a/drugi" badge={<Badge label="Kraj" />} />
</Grid>
\`\`\`

Children z layoutu trafiają do \`children\` komponentu, a sloty — do props o nazwie slotu, jako gotowe elementy React.

W aplikacji Next całość to kilka linii w Server Component:

\`\`\`tsx
export default async function Page() {
  const ctx = { device: 'desktop' }
  const resolved = ui.resolve(await home.build(ctx), { ctx })
  return <Render tree={resolved} registry={registry} />
}
\`\`\`

## Słownik

- **server-driven UI (SDUI)** — model, w którym serwer decyduje o strukturze ekranu, a front tylko ją renderuje.
- **contract** — typ TypeScript: nazwa component → jego props (\`card: { title: string; size?: 'sm' | 'md' | 'lg'; badge?: Slot }\`). Jedno źródło prawdy dla serwera i frontu.
- **component** — nazwa z contractu (\`card\`, \`grid\`). To nie jest komponent React — komponent React przypisuje do tej nazwy registry.
- **instancja** — wynik \`createDedal<Contract>(options)\`, tworzony raz na projekt; z niej bierzesz \`node\`, \`repeat\`, \`section\`, \`page\`, \`query\`, \`resolve\`.
- **block** — drzewo zbudowane z \`node()\` / \`repeat()\`: sama struktura, bez data i bez ID. Zwykła wartość (albo funkcja zwracająca blok), którą można eksportować i używać w wielu stronach.
- **node** — element drzewa: component, props, children, slots, opcjonalny alias. W layoucie dostaje ID.
- **children i slot** — dwa sposoby zagnieżdżania. Children to zwykła zawartość (\`children\` w React). Slot to nazwane miejsce zadeklarowane w contract jako \`Slot\` (jeden node) albo \`Slot[]\` (lista) — trafia do propsa o tej nazwie.
- **ID** — identyfikator node wyliczony z pozycji: \`news\` (korzeń section), \`news.0.1\` (dzieci), \`news.0:badge\` (slot), \`hero:actions.1\` (slot-lista). Po ID spotykają się layout i data.
- **alias** — nazwa nadana node w bloku (\`alias: 'featured'\`), do której odwołuje się selector \`#featured\`.
- **selector** — wyrażenie w składni CSS wybierające node (\`card\`, \`#featured\`, \`card:first-child\`, \`card > :slot(badge)\`). Ten sam matcher działa w patch, remove, bindings, \`required\` i devtools.
- **section** — kawałek strony: unikalny key, block i zasady (patch, remove, loader, onEmpty…). Key jest prefiksem ID jej node i kluczem jej data.
- **page** — lista section (stała albo zależna od ctx), skąd biorą data i opcjonalny cache.
- **ctx** — kontekst requestu (np. \`{ device }\`); dostają go \`sections\`, loadery, \`cache.key\` i \`toProps\`.
- **layout** — drzewo node section po rozwinięciu \`repeat\`, nadaniu ID, \`remove\` i \`patch\` — jeszcze bez data.
- **loader** — funkcja async zwracająca data: \`data\` strony (dla wielu section) albo \`data\` section (tylko dla niej).
- **binding** — wpis w data section: \`{ selector: items }\`. Selector wybiera node, items trafiają do nich po kolei.
- **assign** — etap, w którym bindings są rozdzielane na node; tu działają zasady na braki (\`onShortage\`, \`onSurplus\`, \`onEmpty\`).
- **PageResult** — wynik \`build\`: layout section, data (ID node → data) i raport. Czysty JSON.
- **defaults** — domyślne props component, dokładane przez \`node()\` przy tworzeniu bloku.
- **toProps** — mapowanie data (kształt API) na props component; czyste funkcje bez IO.
- **resolve** — złączenie layoutu z data w ostateczne props; wynik to **ResolvedPage**.
- **registry** — mapa component → komponent React po stronie frontu.
- **query** — źródło data z cache instancji (\`ui.query\`), współdzielone przez loadery i requesty.
- **deferred section** — section budowana osobnym requestem i dostreamowana później (\`defer\`).
- **trace** — tryb debug: pochodzenie props, szczegółowy raport, czasy — dla devtools.

## Typowe zadania

- **Nowa strona albo section** — bloki z istniejących component, section z \`patch\` / \`remove\`, data przez bindings. Zacznij od *Tutorial*, potem *Layout*, *Data*, *Sections*.
- **Nowy component** — (1) dopisz go do contract z jego props (sloty jako \`Slot\` / \`Slot[]\`), (2) dodaj implementację do każdej registry — \`satisfies Registry<Contract>\` nie skompiluje się bez niej, (3) w razie potrzeby \`defaults\` i \`toProps\` w opcjach instancji, (4) użyj go w bloku: \`node('nazwa', …)\`. Tylko ta zmiana wymaga wdrożenia frontu.
- **Coś się nie wyświetla albo wyświetla źle** — panel devtools (*Devtools*) i opisy ostrzeżeń w *Data*, *Sections*, *Rendering*.
- **Build rzuca wyjątek** — *Errors*: każdy komunikat z wyjaśnieniem.

## Jak czytać te docs

Każda strona przypadku pokazuje jedną rzecz: opis, kod (ten sam, który się wykonuje), wynik i raport devtools — albo wyjątek, gdy build się wywraca. Ramka „Zobacz na żywo” mówi, co otworzyć w panelu devtools (przycisk **dedal** w prawym dolnym rogu). Kropka przy przypadku w menu: zielona — działa, żółta — ostrzeżenie w devtools, czerwona — błąd w devtools, fioletowa — build rzuca wyjątek.

Kolejność: *Tutorial* (cała strona krok po kroku), potem *Layout*, *Data* i *Sections* — to codzienne narzędzia. *Cache & queries* i *Rendering* — gdy strona już działa. *Errors* i *Devtools* — gdy coś nie działa.`,

  tutorial: `W 12 krokach zbudujesz stronę główną serwisu z wiadomościami: hero, najnowsze artykuły, section „Więcej”, rekomendacje — z data z API, wariantami na mobile, cache i devtools. Każdy krok dokłada jedną rzecz i pokazuje wynik na żywo. Krok 13 to ćwiczenie: ta sama strona z pięcioma ukrytymi pomyłkami do znalezienia w panelu devtools.

Jeśli nie znasz idei server-driven UI, przeczytaj najpierw *Introduction* — zwłaszcza „Przykład od początku do końca”.

## Jak czytać

Każdy krok ma:
- opis — co robimy i po co,
- kod — prawdziwe pliki tego przykładu (contract, instancja, toProps, registry) i kod strony z tego kroku,
- wynik — strona zbudowana z tego kodu,
- „Zobacz na żywo” — co otworzyć w panelu devtools (przycisk **dedal** w prawym dolnym rogu albo \`Alt+Shift+S\`),
- raport devtools — to samo w formie tekstu.

Kolejne kroki korzystają z bloków z poprzednich — warto iść po kolei (link „next” na dole strony).

## Jak to wygląda w projekcie

Pliki tego przykładu (\`examples/next\`):

\`\`\`
ui/contract.ts           — contract: component i ich props (wspólny dla serwera i frontu) + typ Ctx
ui/dedal.ts             — instancja: createDedal<Contract>({ defaults, toProps })
ui/to-props.ts           — mapowania data z API → props component
ui/home.page.ts          — bloki (node, repeat) i strona: section, data, query, cache
ui/registries/*.tsx      — registry: component → komponenty React (shadcn, Radix Themes)
ui/page-view.tsx         — build → resolve → <Render> (w trybie debug + devtools)
app/(radix)/radix/…      — route'y Next, które renderują PageView z wybraną registry
\`\`\`

W większym projekcie bloki zwykle wydziela się do osobnych modułów (np. \`blocks.ts\`), a każdą stronę do własnego pliku.

Instalacja: \`npm i github:dawidglosny/dedal#v0.6.0\`. Potrzebujesz TypeScript i React (dla \`dedal/react\`, React 18+); serwer może być dowolny (Node 20.9+) — tu Next.js (App Router, Server Components).`,

  layout: `Layout to struktura section: jakie component, w jakiej kolejności, w jakich slotach, z jakimi props — **bez data**. Opisuje się go blokami: \`node(component, { props, children, slots, alias })\`.

## Po co osobny layout

Layout nie zależy od data, więc:
- da się go zbudować bez wywołań API (to sam CPU, ułamek milisekundy),
- ten sam blok obsługuje różne data (3 artykuły czy 30 — repeat i zasady braków decydują, co zostaje),
- zmiana układu (kolejność, warianty, A/B) to zmiana bloku na serwerze, nie wdrożenie frontu.

## Builders: node, repeat, clone

Bierzesz je z instancji (\`ui.node\`, \`ui.repeat\`, \`ui.clone\`) — wtedy są typowane contractem i dokładają \`defaults\`.

- \`node(component, { props, children, slots, alias })\` — jeden node. \`defaults\` instancji są łączone z \`props\` (deep merge: zagnieżdżone obiekty się łączą, tablice i \`undefined\` zastępują wartość domyślną).
- \`repeat(block, n)\` — ten sam blok \`n\` razy jako kolejne rodzeństwo; \`n\` to liczba całkowita \`>= 1\`. Każda kopia dostaje własne ID.
- \`clone(n, a, b)\` — powtarza sekwencję bloków: \`clone(2, a, b)\` daje \`[a, b, a, b]\` (do rozwinięcia w \`children\`).

Blok to zwykła wartość TypeScript — można go parametryzować funkcją (\`cards(title, count)\`), składać z mniejszych bloków, eksportować i używać w wielu stronach.

## Children i sloty

- **children** — zwykła zawartość node (lista). W React trafia do \`children\` komponentu.
- **sloty** — nazwane miejsca zadeklarowane w contract jako prop typu \`Slot\` (jeden node, np. \`media\` w hero) albo \`Slot[]\` (lista, np. \`actions\`). W React trafiają do propsa o nazwie slotu jako gotowy element (albo tablica elementów).

Sloty są częścią layoutu, nie data: serwer decyduje, co jest w slocie (badge, avatar, przyciski). Data do node w slotach przypisuje się jak do każdego innego node — selectorem \`:slot(nazwa)\`.

## ID node

ID wynika z pozycji w layoucie (po rozwinięciu \`repeat\`):
- korzeń section — key section: \`news\`,
- dziecko — ID rodzica + \`.\` + indeks: \`news.0\`, \`news.0.2\`,
- pojedynczy slot — ID rodzica + \`:\` + nazwa slotu: \`news.0:badge\`,
- slot-lista — dodatkowo indeks w slocie: \`hero:actions.1\`.

Po ID spotykają się layout i data, także gdy przyszły z różnych miejsc (cache, sieć). Zmiana bloku zmienia ID — dlatego layout i data zawsze powinny pochodzić z tego samego \`build\`.

Własny generator ID (\`createDedal({ id })\`) jest możliwy, ale musi dawać ID unikalne na **całej stronie** — najprościej, gdy zaczyna się od \`prefix\` (key section), jak wbudowany.

## patch i remove

Section może zmodyfikować blok bez jego kopiowania:
- \`patch: { selector: props }\` — nakłada props na trafione node (deep merge; przy kilku patchach na ten sam prop wygrywa późniejszy wpis),
- \`remove: selector\` (albo lista selectorów) — usuwa trafione node razem z poddrzewem, także ze slotów.

Kolejność etapów: blok → \`remove\` → \`patch\` → przypisanie data. Selectory patcha widzą drzewo **przed** patchem (jak CSS widzi DOM) — patch zmieniający \`size\` nie wpływa na to, czy inny patch z \`[size=lg]\` trafi.

## Selectory — ściąga

Składnia CSS, dopasowywana do drzewa jednej section (\`:root\` to korzeń section):
- \`card\` — component; \`*\` — dowolny node,
- \`#featured\` — alias,
- \`[size]\` — prop istnieje; \`[size=lg]\` — prop ma wartość (porównanie jako string); \`[style.height="100%"]\` — zagnieżdżony prop, wartość w cudzysłowie,
- \`:first-child\`, \`:last-child\`, \`:nth-child(2)\`, \`:nth-child(odd)\` / \`(even)\`, \`:nth-child(3n+1)\`, \`:nth-last-child(…)\` — pozycja liczona od 1, po rozwinięciu \`repeat\`; w slocie-liście — w obrębie slotu,
- \`:slot\` — node w dowolnym slocie; \`:slot(badge)\` — w slocie \`badge\`,
- \`:root\` — korzeń section,
- \`a b\` — potomek (także przez sloty), \`a > b\` — bezpośrednie dziecko albo zawartość slotu, \`a, b\` — jeden z selectorów.

Inne konstrukcje CSS (klasy \`.x\`, \`:not()\`, \`:has()\`, \`+\`, \`~\`) nie są obsługiwane — dają błąd składni z pozycją. Ten sam matcher działa w patch, remove, bindings i devtools — czego nauczysz się raz, używasz wszędzie. Selector możesz sprawdzić w polu wyszukiwania zakładki *tree* w devtools, zanim wpiszesz go w kod.

## Jak używać

- Zdefiniuj bloki dla powtarzalnych układów (lista card, hero, siatka).
- W section użyj bloku i dopasuj go \`patch\` / \`remove\` zamiast kopiować blok z drobną zmianą.
- Warianty (mobile / desktop, A/B) — \`sections: (ctx) => [...]\`: inne bloki albo inne patch per ctx.
- Miejsca, do których trzeba się odwołać niezależnie od pozycji (wyróżniona card), nazwij aliasem.

## Na co uważać

- Selector, który nic nie trafia (literówka, zmieniony blok), nie zgłasza błędu — devtools pokazują go jako warning (z podpowiedzią, gdy da się poprawić selector).
- \`remove: ':root'\` usuwa całą section — jej loader się nie wykonuje, a data strony pod jej key trafiają do \`unknownData\`.
- Korzeń section to jeden node (nie można go powtórzyć \`repeat\`), a pojedynczy slot przyjmuje jeden node — kilka wymaga slotu-listy (\`Slot[]\`).`,

  data: `Data trafiają do layoutu przez **bindings**: data section to obiekt \`{ selector: items }\`. Selector wybiera node w section, a kolejne items trafiają do kolejnych trafionych node — w kolejności drzewa.

\`\`\`ts
data: async () => ({
  news: {                                   // key section
    card: articles,                         // binding: każda card dostaje kolejny artykuł
    'card > :slot(badge)': categories,      // binding do slotów
  },
})
\`\`\`

## Dlaczego selectory, a nie jedna lista

Jedna płaska lista data na section (pierwszy element do pierwszego component, drugi do drugiego…) psuje się przy każdej zmianie bloku: dodanie nagłówka przesuwa wszystkie data o jeden. Bindings są adresowane — \`card\` dostaje artykuły, \`badge\` kategorie, niezależnie od kolejności w bloku. Data nigdy nie przechodzą między section — key section jest jawny.

## Jak dokładnie działa przypisanie

- **Kolejność drzewa**: node, potem jego sloty (w kolejności z bloku), potem children — rekurencyjnie. Pierwszy item trafia do pierwszego trafionego node w tej kolejności.
- **Kolejność bindings ma znaczenie**: są przetwarzane w kolejności wpisów, a node zajęty przez wcześniejszy binding jest pomijany przez kolejne. Dlatego szczegółowe (\`#featured\`) wpisuje się przed ogólnymi (\`card\`).
- **Kształt**: binding to tablica items albo \`{ items, onShortage, onSurplus }\` (własne zasady dla tego bindingu). Item może być czymkolwiek serializowalnym do JSON — obiekt, string, liczba; \`null\` / \`undefined\` = brak data dla tego node.
- **Wynik** to mapa \`ID node → item\` w \`PageResult.data\`; z props łączy ją dopiero \`resolve\`.

## Data a props

Data mogą mieć kształt API (\`Article\`), a nie props component. **toProps** (opcja instancji) mapuje je per component na props contractu — czysty moduł, bez IO, działa na serwerze i na froncie. Dostaje \`{ props, data, node, ctx }\` i jest wołane dla każdego node danego component, **także bez data** (\`data: undefined\`). Bez toProps data (muszą być obiektem) są łączone z props wprost (deep merge, data wygrywają).

Pierwszeństwo props: \`defaults\` (dokładane przez \`node()\` przy tworzeniu bloku) → props z bloku → \`patch\` section → data. \`resolve\` przekazuje props z layoutu i data do \`toProps\` — jego wynik to ostateczne props (stąd \`...props\` w mapowaniu). Devtools przy każdym propsie pokazują źródło.

## Gdy liczba się nie zgadza

Data z API rzadko pasują idealnie do layoutu:
- **mniej items niż node** — \`onShortage\`: \`'remove'\` (domyślnie — node bez data znika razem z poddrzewem), \`'keep'\` (zostaje z props z layoutu, np. placeholder), \`'error'\` (wyjątek),
- **więcej items niż node** — \`onSurplus\`: \`'ignore'\` (domyślnie — nadmiar pominięty) albo \`'error'\`,
- \`null\` / \`undefined\` w liście = brak data dla tego node (jak przy zbyt krótkiej liście).

Zasady ustawia się na trzech poziomach — węższy wygrywa: instancja (\`createDedal({ assign: { onShortage, onSurplus } })\`), section (\`section(key, block, { policies })\`), jeden binding (\`{ items, onShortage }\`).

## Jak używać

- Przygotuj data per component (lista artykułów dla \`card\`, kategorie dla \`badge\`), nie jedną listę dla całej section.
- Bindings szczegółowe (\`#featured\`) wpisuj przed ogólnymi (\`card\`).
- Zdecyduj, co przy brakach: znikające card (\`remove\`) czy stałe miejsca (\`keep\`).

## Na co uważać

- Rozjazdy (binding bez trafień, zła kolejność, data, które przepadły) nie wywracają strony — devtools pokazują je w *sections* z wyjaśnieniem i listą data, które nie trafiły na stronę.
- \`onShortage: 'remove'\` na kontenerze usuwa też jego dzieci — razem z data, które już dostały (*Dropped data*).`,

  sections: `Section to kawałek strony: key, block i zasady. Strona (\`ui.page\`) to lista section plus to, skąd biorą data.

\`\`\`ts
const home = ui.page<Ctx>({
  sections: ctx => [header, ui.section('news', newsBlock, { patch: { … } })],  // albo stała tablica
  data: async ctx => ({ news: { card: await api.latest() } }),               // data strony
  cache: { key: ctx => ['home', ctx.device] },                               // opcjonalnie
  onSectionError: (error, { section }) => log(section, error),               // opcjonalnie
})
\`\`\`

Opcje section (\`ui.section(key, block, options)\`): \`remove\`, \`patch\` (zob. *Layout*), \`policies\` (zob. *Data*), \`data\`, \`optional\`, \`onEmpty\`, \`required\`, \`defer\` — opisane niżej. Key section musi być unikalny na stronie.

## Skąd section bierze data

- **data strony** — \`page({ data: (ctx) => ({ news: {...}, hero: {...} }) })\` — jedno miejsce dla wielu section,
- **loader section** — \`section(key, block, { data: (ctx) => bindings })\` — section ładuje swoje data sama; zwraca bindings tylko tej section (bez key section),
- **bez data** — section statyczna: renderuje sam layout (np. nagłówek z tekstem w bloku).

Loader section pozwala zrobić **section wspólne** (header, footer, menu): definiujesz je raz z loaderem i dołączasz do wielu stron bez powtarzania ich data w każdej. Wszystkie loadery i data strony działają **równolegle**. Loadery wykonują się tylko dla section obecnych na stronie (nie dla usuniętych przez \`remove: ':root'\` ani odroczonych).

## Gdy coś pójdzie nie tak

- **Błąd loadera** domyślnie przerywa build — strona bez kluczowej section nie powinna się wyrenderować po cichu. \`optional: true\` usuwa wtedy tylko tę section (np. rekomendacje), a błąd trafia do \`onSectionError\` strony (logi, metryki).
- **Pusta section** — section dostała bindings (z loadera albo z data strony), ale po przypisaniu żaden node nie ma data. Decyduje \`onEmpty\`: \`'remove'\` (domyślnie), \`'keep'\`, blok (stan pusty, np. „Brak wyników”) albo \`'error'\`. \`required: 'card'\` liczy tylko node pasujące do selectora — gdy nagłówek dostaje data zawsze, a o sensie section decydują card.
- **Section bez bindings** — gdy data strony nie mają jej key albo loader zwrócił \`undefined\`, section nie jest „pusta” w sensie \`onEmpty\`: zostaje z samym layoutem (devtools ostrzegają, gdy wyglądało to na pomyłkę).

## Section odroczone (streaming)

\`defer: { fallback }\` — wynik strony zawiera tylko zaślepkę (\`fallback\`, z \`deferred: true\`), loader się nie wykonuje. Treść buduje \`page.section(key, ctx)\` w osobnym wywołaniu — zwraca \`PageResult\` z tą jedną section, więc \`resolve\` i \`<Render>\` działają bez zmian. W Next to async Server Component w \`<Suspense>\`: strona wychodzi od razu, a wolna section (rekomendacje, data spersonalizowane) dociera, gdy jest gotowa.

\`\`\`tsx
async function Deferred({ sectionKey, ctx }: { sectionKey: string; ctx: Ctx }) {
  const resolved = ui.resolve(await home.section(sectionKey, ctx), { ctx })
  return <Render tree={resolved} registry={registry} />
}

<Render
  tree={resolved}
  registry={registry}
  deferred={({ sectionKey, fallback }) => (
    <Suspense fallback={fallback}>
      <Deferred sectionKey={sectionKey} ctx={ctx} />
    </Suspense>
  )}
/>
\`\`\`

Bez propsa \`deferred\` \`<Render>\` pokazuje sam fallback. Section odroczona jest poza cache strony (cache'owana jest tylko zaślepka) — dobre miejsce na data per użytkownik.

## Etapy strony

\`page.build(ctx)\` to trzy etapy w jednym wywołaniu (plus cache). Są też dostępne osobno — gdy chcesz np. cache'ować layout niezależnie od data:
- \`page.layout(ctx)\` — layout section, bez IO,
- \`page.load(ctx)\` — data strony i loadery section (równolegle),
- \`page.assign(sections, data, ctx)\` — przypisanie data, wynik to \`PageResult\`.

## Dlaczego tak

Każda decyzja „co, gdy brakuje” jest jawna i ma domyślną wartość, która nie wywraca strony tam, gdzie to bezpieczne (puste promocje znikają), a wywraca tam, gdzie cisza byłaby błędem (błąd loadera bez \`optional\`). Wszystko, co zostało usunięte albo pominięte, jest w raporcie (\`report.removedSections\`, \`failedSections\`, \`emptySections\`, \`unknownData\`) i w devtools.

## Jak używać

- Section wspólne (header, footer) — z własnym loaderem, eksportowane i dołączane do stron.
- Section „miłe do mania” — \`optional: true\`; section, bez których strona nie ma sensu — \`onEmpty: 'error'\`.
- Wolne albo spersonalizowane — \`defer\`.

## Na co uważać

- Data strony pod key section z własnym loaderem albo section odroczonej to wyjątek (nie wiadomo, które wygrywa).
- Data pod key, którego nie ma na stronie (literówka, section z innego wariantu), są pomijane — devtools: \`unknownData\` z podpowiedzią.`,

  cache: `Dwa poziomy cache: **strony** (cały wynik \`build\`) i **query** (pojedyncze źródła data). Oba żyją w instancji i działają w trybie stale-while-revalidate.

## Cache strony

\`page({ cache: { key: ctx => ['home', ctx.device] } })\` zapisuje wynik \`build\` pod key. Key to tablica wartości JSON obejmująca wszystko, od czego zależą section i data — tu \`device\`. Key \`undefined\` = ten ctx nie jest cache'owany (np. zalogowany użytkownik). Bez opcji \`cache\` strona nie jest cache'owana wcale.

Stale-while-revalidate (wiek wpisu):
- do \`staleTime\` (domyślnie 5 s) — wynik z cache (\`hit\`),
- do \`maxAge\` (domyślnie 5 min) — stary wynik od razu, odświeżenie w tle (\`stale\`),
- starszy albo brak wpisu — build i czekanie na wynik (\`miss\`),
- równoległe requesty o ten sam key czekają na jeden build (bez lawiny wywołań API),
- błędy nie są cache'owane; gdy odświeżenie w tle się nie uda, zostaje poprzedni wpis.

Czasy ustawia się dla instancji (\`createDedal({ cache: { staleTime, maxAge } })\`) i nadpisuje per strona (\`cache: { key, staleTime, maxAge }\`) albo query. Musi być \`0 <= staleTime <= maxAge\`.

## Query

\`\`\`ts
const articlesQuery = ui.query({
  key: (count: number) => ['articles', count],   // key musi obejmować wszystkie parametry fn
  fn: (count: number) => api.latest(count),
  staleTime: 60_000,
})

const list = await articlesQuery(8)               // w loaderze strony albo section
\`\`\`

Query to źródło data cache'owane w instancji, wspólne dla stron, section i requestów — np. menu pobierane raz dla wszystkich stron. Key \`undefined\` = to wywołanie bez cache (\`bypass\`). Wynik z cache jest zamrożony i współdzielony między requestami — tylko do odczytu: \`[...items].sort()\`, nie \`items.sort()\`. Wynik musi być JSON-em (zewnętrzny magazyn go serializuje — \`Date\` czy \`Map\` nie przetrwają).

Query jest opcjonalne — loader to zwykła funkcja async, można w niej wołać dowolne źródło (fetch, klient API, cache, który aplikacja już ma).

## Dlaczego w instancji

Cache żyje tyle co instancja: twórz ją raz (na poziomie modułu), nie w każdym requeście. Strony i query mają osobne przestrzenie key (\`['menu']\` strony i \`['menu']\` query to różne wpisy), ale wspólne między stronami — key strony zaczynaj od jej nazwy.

\`ui.invalidate(prefix)\` usuwa wpisy stron i query, których key zaczyna się od \`prefix\` (\`[]\` — wszystkie), np. po publikacji w CMS: \`ui.invalidate(['articles'])\`.

## Magazyn i opcje instancji

\`createDedal({ cache: { … } })\`:
- \`store\` — magazyn wpisów; domyślnie \`memoryStore()\` (pamięć procesu, LRU, 500 wpisów). Dla wielu instancji serwera — własny adapter (Redis, KV) z metodami \`get\`, \`set\`, \`delete\`; opcjonalnie \`deletePrefix\` (bez niego \`invalidate\` usuwa tylko wpis o dokładnie takim key) i \`lock\` (jedno odświeżenie naraz w całym klastrze),
- \`waitUntil\` — na edge / serverless przekazuje odświeżenie w tle środowisku (np. \`waitUntil\` z \`@vercel/functions\`), żeby nie zostało przerwane po odpowiedzi,
- \`onEvent\` — zdarzenia cache (\`{ key, status, ms }\`) do logów i metryk.

## Debug a cache

Tryb debug (\`trace\`) **omija cache strony** — ani nie czyta, ani nie zapisuje; devtools zawsze pokazują świeży build. Cache query działa dalej; zakładka *timing* pokazuje status każdego query: \`miss\`, \`hit\`, \`stale\`, \`bypass\`, \`error\` (wymaga \`AsyncLocalStorage\` — w Next jest globalny).

## Na co uważać

- Data zależne od użytkownika: użytkownik w key albo key \`undefined\` — inaczej jeden użytkownik zobaczy stronę drugiego. Lepiej: część spersonalizowaną jako section odroczona (poza cache strony).
- Key query bez któregoś parametru \`fn\` zwróci wynik dla innych parametrów.
- Wyniki z cache są zamrożone — mutacja rzuca wyjątek.`,

  rendering: `Rendering to dwa kroki: \`resolve\` (złączenie layoutu z data w props) i \`<Render>\` (props → komponenty React przez registry).

## resolve

\`ui.resolve(result, { ctx })\` zamienia \`PageResult\` (layout i data osobno) w \`ResolvedPage\` — drzewo \`{ key, component, props, slots, children }\` z ostatecznymi props. Dla każdego node: gdy component ma \`toProps\`, jego wynik to ostateczne props (dostaje props z layoutu — już z \`defaults\` — data node i \`ctx\`); bez \`toProps\` data (obiekt) są łączone z props (deep merge).

\`resolve\` to czysta funkcja — może działać na serwerze (jak w tym przykładzie) albo na froncie, gdy front dostaje \`PageResult\` przez API. Sprawdza wersję formatu (\`dedal: 1\`) i odrzuca nieznaną.

## Registry

Registry mapuje nazwy component z contractu na komponenty React:

\`\`\`tsx
const registry = { card: Card, grid: Grid, … } satisfies Registry<Contract>
<Render tree={resolved} registry={registry} fallback={Missing} />
\`\`\`

Komponent w registry dostaje (\`RenderProps<Contract, 'card'>\`):
- props z contractu (bez slotów),
- każdy slot jako prop o jego nazwie: \`ReactNode\` dla \`Slot\`, \`ReactNode[]\` dla \`Slot[]\`,
- children z layoutu jako \`children\`.

\`\`\`tsx
card: ({ title, href, size = 'md', badge, footer }) => (
  <Card data-size={size}>
    {badge}
    <a href={href}>{title}</a>
    {footer}
  </Card>
)
\`\`\`

\`satisfies Registry<Contract>\` sprawdza przy kompilacji, że są wszystkie component i props się zgadzają. Registry to adapter: contract opisuje, czego potrzebuje strona, a registry tłumaczy to na API konkretnej biblioteki (badge \`variant: 'secondary'\` → \`variant="soft"\` w Radix Themes) — zmiana biblioteki to zmiana registry, nie serwera.

\`<Render>\` nie używa hooków ani stanu — działa w React Server Components, w SSR i na kliencie; komponenty w registry mogą być komponentami klienckimi (\`'use client'\`). Opcje: \`fallback\` (komponent dla component spoza registry, dostaje \`{ component, nodeKey }\`), \`deferred\` (render section odroczonej, zob. *Sections*), \`debug\` (znaczniki dla devtools).

## Problemy, które nie wywracają strony

\`resolve\` nie rzuca przy złych data — zbiera **issues** (\`resolved.issues\`: \`{ id, message }\`), a node dostaje props z layoutu:
- data nie-obiekt bez toProps,
- wyjątek w toProps albo toProps zwracające nie-obiekt,
- data dla ID, którego nie ma w layoucie (layout i data z różnych buildów).

Brak component w registry renderuje \`fallback\` (albo nic). Dlaczego tak: jeden zły artykuł nie powinien zabrać całej strony. Gdzie wolisz twardy błąd (testy, CI) — \`resolve(result, { onIssue: 'throw' })\`.

## Na co uważać

- Issues są widoczne w \`resolved.issues\` i devtools (\`!\` w *tree*, komunikaty w *sections*) — warto je logować na produkcji.
- Front starszy niż serwer: component, którego nie ma w registry, renderuje \`fallback\` — nowe component wdrażaj najpierw na froncie, potem używaj w blokach.`,

  errors: `Część problemów przerywa build albo \`resolve\` wyjątkiem — to błędy programisty (zły blok, zła składnia, sprzeczna konfiguracja) albo sytuacje, które sam oznaczyłeś jako niedopuszczalne (\`onShortage: 'error'\`, \`onEmpty: 'error'\`, loader bez \`optional\`).

## Dlaczego wyjątki

Ciche obejście takich błędów ukryłoby je do produkcji. Wyjątek przy pierwszym buildzie (lokalnie, w testach) wskazuje problem od razu.

## Jak czytać komunikaty

Każdy komunikat mówi:
- **gdzie** — section (\`section "news": …\`), binding, selector z pozycją,
- **co przyszło** — np. \`got array (3 items)\`, \`got 0\`,
- **co zrobić** — np. \`wrap it in a container\`, \`remove "news" from page data or drop the section's loader\`.

Błąd loadera zachowuje oryginalny błąd w \`cause\`.

## Gdy strona się nie buduje

Devtools nie pokażą nic — nie ma payloadu, bo nie ma strony. Zostaje komunikat wyjątku (w logu serwera, w overlay Next). Strony w tej grupie łapią wyjątek i pokazują jego treść.

## Wyjątek a warning

Braki, nadmiar i puste section domyślnie nie wywracają strony (**warning** w devtools). Złe data (issues \`resolve\`) i binding bez trafień to **błąd** (✗) w devtools, ale strona się renderuje. Wyjątkiem stają się dopiero po ustawieniu \`'error'\` (\`onShortage\`, \`onSurplus\`, \`onEmpty\`) albo \`onIssue: 'throw'\` w \`resolve\`. Zły kształt data (lista zamiast bindings, binding nie-lista) i to, co zależy od kodu (składnia, struktura bloków, konfiguracja), jest wyjątkiem zawsze.`,

  devtools: `Devtools pokazują, co Dedal zrobił z konkretną stroną: skąd każdy prop, które data trafiły gdzie, co przepadło i dlaczego, ile trwał build i które query poszły do API. Ta strona opisuje, skąd biorą się te informacje i jak je czytać — zakładka po zakładce.

## Skąd panel ma dane

\`\`\`
page.build(ctx, { trace: true })   build w trybie debug: zapisuje pochodzenie props, raport bindings, czasy
        │                          (omija cache strony — zawsze świeży build)
ui.resolve(result, { trace: true }) złączenie layout + data, z pochodzeniem każdego propsa
        │
inspect(result, resolved)          payload devtools — czysty JSON: section, node, komunikaty, czasy
        │
<DevtoolsData payload />           payload osadzony na stronie w <script type="application/json">
<Render debug />                   każdy node owinięty w <dedal-node data-dedal-key="…"> (do "pick")
<Devtools />                       panel (Shadow DOM): czyta skrypty z payloadem, także dostreamowane później
\`\`\`

Panel nie pyta serwera o nic — wszystko jest w payloadzie z chwili renderu. Section odroczona (streaming) przychodzi z własnym payloadem; panel łączy je w jeden widok.

## Jak włączyć (Next, React Server Components)

Cztery elementy w trybie debug: build i resolve z \`trace\`, znaczniki w DOM, payload na stronie i panel. Uproszczona wersja \`ui/page-view.tsx\` z tego przykładu (tu \`isDebug()\` to po prostu \`?debug=1\`):

\`\`\`tsx
import { Suspense } from 'react'
import { inspect } from 'dedal/devtools'
import { DevtoolsData, Render } from 'dedal/react'
import { Devtools } from 'dedal/react/devtools'

export async function PageView({ ctx, registry }: { ctx: Ctx; registry: Registry<Contract> }) {
  const debug = await isDebug()                                 // zob. „Bezpieczne włączanie”
  const result = await home.build(ctx, { trace: debug })        // 1. pochodzenie props, raport, czasy; omija cache strony
  const resolved = ui.resolve(result, { ctx, trace: debug })

  return (
    <>
      <Render
        tree={resolved}
        registry={registry}
        debug={debug}                                           // 2. znaczniki node w DOM (do „pick”)
        deferred={({ sectionKey, fallback }) => (
          <Suspense fallback={fallback}>
            <DeferredSection sectionKey={sectionKey} ctx={ctx} registry={registry} debug={debug} />
          </Suspense>
        )}
      />
      {debug && <DevtoolsData payload={inspect(result, resolved)} />}   {/* 3. payload dla panelu */}
      {debug && <Devtools />}                                            {/* 4. panel */}
    </>
  )
}

// section odroczona dokłada własny payload — panel łączy go z payloadem strony
async function DeferredSection({ sectionKey, ctx, registry, debug }: { sectionKey: string; ctx: Ctx; registry: Registry<Contract>; debug: boolean }) {
  const result = await home.section(sectionKey, ctx, { trace: debug })
  const resolved = ui.resolve(result, { ctx, trace: debug })
  return (
    <>
      <Render tree={resolved} registry={registry} debug={debug} />
      {debug && <DevtoolsData payload={inspect(result, resolved)} />}
    </>
  )
}
\`\`\`

- \`inspect\` (\`dedal/devtools\`) — czysta funkcja: payload (JSON) z indeksem node, selectorami, data, komunikatami i czasami.
- \`<DevtoolsData>\` (\`dedal/react\`) — osadza payload jako \`<script type="application/json" data-dedal-devtools>\`, z escapowaniem (data z \`</script>\` nie zamkną skryptu).
- \`<Devtools />\` (\`dedal/react/devtools\`) — komponent kliencki; kod panelu ładuje się dynamicznie dopiero po zamontowaniu. Bez propsa \`open\` panel jest otwarty albo zamknięty tak, jak zostawiono go w tej karcie przeglądarki; \`open\` / \`open={false}\` wymusza stan.

## Bezpieczne włączanie

Tryb debug **ujawnia strukturę i data strony** (wszystkie props, data node, key cache) i omija cache strony — każdy request w debug to pełny build z wywołaniami API. Dlatego włącza go aplikacja, świadomie:
- poza produkcją — zawsze albo przełącznikiem (ten przykład: \`?debug=1\`),
- na produkcji — tylko dla zaufanych osób, np. cookie z sekretem ustawiane przez chroniony endpoint. Sam query param na produkcji to zaproszenie dla każdego.

\`\`\`ts
import { cookies } from 'next/headers'

export async function isDebug() {
  if (process.env.NODE_ENV !== 'production') return true
  const token = process.env.DEDAL_DEBUG_TOKEN
  return Boolean(token) && (await cookies()).get('dedal_debug')?.value === token
}
\`\`\`

Bez trybu debug nic się nie zmienia: wynik \`build\` / \`resolve\` jest taki sam jak bez devtools, DOM nie ma znaczników, a kod panelu nie jest ładowany.

## Inne środowiska

- **React bez RSC (SPA, SSR)** — te same komponenty: \`<Render debug>\`, \`<DevtoolsData>\`, \`<Devtools />\`. \`inspect()\` działa też w przeglądarce.
- **Backend → front (API z JSON-em)** — backend robi \`build(ctx, { trace: true })\` tylko dla zaufanych żądań; front wywołuje u siebie \`resolve\` i \`inspect()\` (czyste funkcje) i renderuje jak wyżej.
- **Bez Reacta** — \`mountDevtools()\` z \`dedal/devtools/panel\` po załadowaniu strony; payload osadź jako \`<script type="application/json" data-dedal-devtools>\`, zamieniając \`<\` na \`\\u003c\`. Bez znaczników node w DOM panel pokazuje *tree*, *sections* i *timing*, ale nie podświetla elementów, a \`pick\` nic nie znajdzie.

## node — jeden element strony

\`pick\` i kliknij element strony (albo wybierz node w *tree*):
- **component, ID, section, slot** — ID wynika z pozycji w bloku (\`news.0.1\`, \`hero:actions.0\`),
- **selector** — najkrótszy selector trafiający tylko w ten node (do patch i bindings), z \`copy\`; \`not unique\`, gdy nie da się wskazać go jednoznacznie,
- **data** — surowe data node (kształt z API) i binding, który je przypisał (\`assigned by card\`),
- **issues** — problemy \`resolve\` (data nie-obiekt, błąd toProps) i brak component w registry,
- **props** — ostateczne props z pochodzeniem: \`← default\` (defaults instancji), \`← template\` (blok), \`← patch <selector>\` (który patch; przy kilku pasujących wygrywa późniejszy), \`← data\` (z data przez toProps albo deep merge), \`← layout\` (z layoutu, bez szczegółów — strona zbudowana bez \`trace\`),
- **parent / children** — nawigacja po drzewie (najechanie podświetla, kliknięcie przechodzi).

Pochodzenie dotyczy props najwyższego poziomu: patch \`{ style: { height } }\` oznacza źródło propsa \`style\`. Prop równy wartości domyślnej jest oznaczany jako \`default\`, nawet gdy blok ustawił tę samą wartość — wynik jest wtedy identyczny. Sugerowany selector jest liczony na stronie po \`assign\` — gdy \`assign\` usunął rodzeństwo (np. card bez data), pozycja \`:nth-child\` w bloku może być inna. \`pick\` anuluje \`Esc\`.

## tree — cała strona

Wszystkie section i node w kolejności drzewa. \`●\` — node ma data, \`!\` — issues albo brak w registry. Section usunięte przez data są pokazane z layoutem sprzed \`assign\` („removed — no data; layout before assign”) — widać, na co czekały.

Pole wyszukiwania szuka na trzy sposoby naraz: **selector** (ten sam matcher co patch / bindings — sprawdzisz selector, zanim wpiszesz go w kod), **tekst w ID, key section i aliasie** (\`news\`, \`news.0.1\`, \`#featured\`) i **tekst w data** (fragment tytułu, id, URL — od 2 znaków). Data, które nie trafiły na stronę, a zawierają tekst, są wypisane jako „not on the page” (z section, bindingiem i indeksem). Selectory atrybutów (\`[size=lg]\`) widzą props z layoutu, nie z data. „only matches” zostawia tylko trafienia i ich przodków.

## sections — co poszło nie tak

Na górze komunikaty strony, jedna linia na problem: \`✗\` błąd, \`!\` ostrzeżenie, \`·\` informacja. Niżej każda section: skąd ma data (\`source: page / section / deferred / none\`), jej bindings w postaci „X data items for Y nodes” i pod spodem — co z tego wynikło i co zrobić. Najechanie na binding podświetla na stronie node, do których trafiły jego data; kliknięcie otwiera *tree* z jego selectorem.

## timing — skąd biorą się liczby

Build w trybie debug mierzy czas zegarem \`performance.now()\` w kilku punktach. Wszystkie czasy w *timing* są w milisekundach **od początku tego builda** (zaokrąglone do 0,1 ms).

\`\`\`
0 ms                                                               total
├─ layout ─┼──────────────── data loading ──────────────────┼─ assign ─┤
           ├─ page data  ███████████                        │
           ├─ hero       ██████                             │
           └─ related    ████████████████████████████████████  ← slowest
                         query miss ███████  query hit ▏
\`\`\`

**Etapy** (pierwszy pasek i legenda):
- **layout** — wywołanie \`sections(ctx)\`, zamiana bloków na node (rozwinięcie \`repeat\`, ID), \`remove\` i \`patch\` wszystkich section. Sam CPU, bez IO — zwykle ułamek milisekundy. (\`defaults\` są już w blokach — dokłada je \`node()\` przy ich tworzeniu.)
- **data loading** — od końca layoutu do chwili, gdy skończyły się **wszystkie** loadery (\`data\` strony i loadery section). Loadery działają równolegle, więc ten etap trwa mniej więcej tyle, co najwolniejszy z nich — nie tyle, co ich suma.
- **assign** — rozdzielenie data na node (bindings), \`onShortage\`, \`onEmpty\`. Znowu sam CPU.
- **total** — suma trzech etapów, czyli czas \`build\`.

**Loadery** (paski na osi czasu): każdy loader jest mierzony osobno — od wywołania do zakończenia (albo błędu). Pasek zaczyna się w miejscu startu loadera i ma długość jego czasu. Wszystkie startują w tym samym momencie (zaraz po layoucie), dlatego paski zaczynają się równo. \`page data\` to funkcja \`data\` strony; pozostałe nazwy to key section z loaderem. \`slowest\` — loader, na który czeka cały build; czerwony — loader rzucił wyjątek.

**Query** (pod loaderem): każde wywołanie \`ui.query\` w czasie builda z trybem debug zapisuje swój key, status cache, start i czas trwania. Skąd wiadomo, który loader je wywołał? Dedal uruchamia każdy loader w kontekście asynchronicznym (\`AsyncLocalStorage\`) z jego nazwą, a query odczytuje ten kontekst — nawet po \`await\`. Dzięki temu dwa równoległe requesty, które korzystają z tej samej instancji i tego samego cache, nie mieszają swoich query. W Next \`AsyncLocalStorage\` jest globalny; gdzie indziej przekaż \`createDedal({ AsyncLocalStorage })\` z \`node:async_hooks\` — bez niego *timing* pokazuje tylko etapy i loadery.

Co znaczy status i czas query:
- \`miss\` — pobrane: brak w cache albo wpis wygasł (\`maxAge\`); czas ≈ czas wywołania \`fn\` (API),
- \`hit\` — z cache, świeże (\`staleTime\` nie minął); czas ≈ 0,
- \`stale\` — z cache, ale po \`staleTime\`: stary wynik od razu (czas ≈ 0), a odświeżenie biegnie w tle — **poza pomiarem**, następny request dostanie świeży,
- \`bypass\` — query bez key: pobierane zawsze, bez cache,
- \`error\` — \`fn\` rzuciło.

Dwa równoczesne wywołania z tym samym key to jeden fetch (deduplikacja): oba mają status \`miss\`, a drugie trwa tyle, ile czekało na pierwsze.

## Czego w timing nie ma

- \`resolve\`, render React, wysyłki HTML do przeglądarki, narzutu Next — mierzony jest tylko \`build\`,
- odświeżeń \`stale\` w tle,
- **cache strony** — build z trace go omija, więc *timing* pokazuje zawsze pełny build. Na produkcji strona z cache (\`hit\`) nie wykonuje loaderów wcale.

Dlatego liczby w debug są „najgorszym przypadkiem dla strony” i „prawdziwym stanem cache query”. Do tego: tryb \`npm run dev\` jest wolniejszy niż produkcyjny build, a pierwszy request po starcie serwera — wolniejszy niż kolejne (puste cache query, rozgrzewanie JIT).

## Jak czytać timing

- **Strona wolna** → który loader ma \`slowest\`; to on wyznacza data loading. Przyspieszenie pozostałych nic nie da.
- **Loader długi, a pod nim brak query** → wolne źródło spoza \`ui.query\` (bezpośredni fetch, baza) — rozważ \`ui.query\` ze \`staleTime\`, \`defer\` albo cache strony.
- **To samo query \`miss\` przy każdym odświeżeniu** → \`staleTime: 0\`, key zmienia się co request (np. zawiera czas) albo query bez key (\`bypass\`).
- **Query w jednym loaderze startują jedno po drugim** (start drugiego ≈ koniec pierwszego) → kolejne \`await\` w loaderze; jeśli są niezależne, użyj \`Promise.all\`.
- **Loader czerwony** → *sections* pokaże treść błędu.

## Typowe problemy

**Panel jest pusty.** \`No devtools payload on this page\` — strona nie osadziła payloadu: w trybie debug wyrenderuj \`<DevtoolsData payload={inspect(result, resolved)} />\`. \`built without trace — …\` — payload jest, ale build szedł bez \`trace\`: brakuje liczby items, pochodzenia props, bindings bez trafień i section usuniętych przez data (zob. przypadek *Build without trace*).

**Component się nie renderuje.** \`✗ card is not in the registry — …\` — registry nie ma component; node renderuje \`fallback\` z \`<Render>\` albo nic. Wymaga \`<Render debug>\` (znacznik \`data-dedal-missing\`).

**Patch się nie aplikuje.** *sections* → \`! patch “crad” matches no node in this section — it has no effect. Did you mean: card?\` (dla \`remove\`: \`… nothing is removed.\`). Selector trafia, ale prop ma inną wartość — w *node* sprawdź pochodzenie: późniejszy patch albo data mogły go nadpisać.

**Card nie dostała data albo zniknęła.** *sections* → bindings section: \`! card — 2 data items for 4 nodes\` (\`(1 null)\` — część items to \`null\`; bez trace: \`2 of 4 nodes filled\`), a pod spodem skutek: \`2 nodes removed — …\` albo \`2 nodes left empty (onShortage: 'keep')\`, a przy nadmiarze \`3 data items not shown — no node left for them:\` z listą.

**Data nie trafiły na stronę, choć section je dostała.** \`✗ crad — 3 data items for 0 nodes\` z \`No node in this section matches “crad” … Did you mean: card?\` (literówka, także w nazwie slotu) albo \`“#featured” matches nodes already filled by “card” … Move “#featured” before “card”\` (zła kolejność bindings). \`news.2.0 had data, but their parent news.2 was removed\` — data przepadły razem z usuniętym rodzicem.

**Gdzie wylądował ten artykuł?** *tree* → wpisz fragment tytułu, id albo URL. Node, których data go zawierają, są wyróżnione w drzewie i na stronie; jeśli artykuł nie trafił na stronę — \`! not on the page: section … · card [4] …\`.

**Section nie ma na stronie.** Komunikaty strony w *sections* podają przyczynę: \`failed\` (loader \`optional\` section rzucił — z treścią błędu), \`removed\` (pusta przy \`onEmpty: 'remove'\`, korzeń bez data albo \`remove\` w definicji section), \`empty\` (\`kept\` / \`replaced by the onEmpty block\`), \`unknownData\` (data pod key, którego nie ma na stronie — z podpowiedzią).

**Na stronie są stare data.** *sections* → \`cache key\`. Tryb debug omija cache strony, więc pokazuje świeży build — jeśli w debug data są aktualne, a bez niego nie, to stary wpis cache (\`staleTime\`, \`ui.invalidate()\`).

## Pozostałe

- \`copy report\` — raport tekstowy (URL, komunikaty, section z problemami, czasy) do zgłoszenia błędu — to samo, co „devtools report” na stronach tych docs,
- \`Alt+Shift+S\` otwiera i zamyka panel; \`⇤\` / \`⇥\` przenosi go na drugą stronę ekranu; panel pamięta otwarcie, zakładkę i stronę w obrębie karty przeglądarki (\`sessionStorage\`), także po przeładowaniu.

## Ograniczenia i koszty (tylko w trybie debug)

- **Znaczniki zmieniają DOM** — \`<Render debug>\` owija każdy node w \`<dedal-node style="display: contents">\`: selectory CSS zależne od struktury (\`.grid > .card\`, \`:first-child\`) mogą działać inaczej, a tam, gdzie HTML wymaga konkretnych dzieci (\`<table>\`, \`<ul>\`, \`<select>\`), struktura się psuje.
- **Debug omija cache strony** — każdy request to pełny build z wywołaniami API.
- **Koszt \`inspect()\` i rozmiar payloadu** — rzędu kilku ms i 150–250 KB na ~500 node, kilkadziesiąt ms i 1–2 MB na ~4000 node; rozmiar zależy głównie od ilości data.
- **Zrzut, nie stan na żywo** — panel pokazuje stronę z chwili renderu na serwerze; zmian po stronie klienta (stan komponentów) nie widzi.
- **Tylko odczyt** — panel nie zmienia layoutu ani data.

## Programistycznie

Te same funkcje są w \`dedal/devtools\` — działają w Node, w testach i w logach:

\`\`\`ts
import { inspect, mergePayloads, pageMessages, reportText, searchNodes, selectNodes } from 'dedal/devtools'

const result = await home.build(ctx, { trace: true })
const payload = inspect(result, ui.resolve(result, { ctx, trace: true }))

payload.nodes['news.0'].selector             // sugerowany selector
payload.nodes['news.0'].props.size           // { value: 'lg', source: { from: 'patch', selector: '…', section: 'news' } }
payload.sections[0].diagnosis                // unmatched, layout, removed, dropped
selectNodes(payload, 'grid > card')          // ID pasujących node — ten sam matcher co patch / bindings
searchNodes(payload, 'tytuł')                // wyszukiwanie z *tree*: { bySelector, byText, byData, lost }
pageMessages(payload)                        // komunikaty strony: { level, subject, text, suggestions? }
reportText(payload, { title })               // raport tekstowy (to samo co „copy report”)
payload.page.timings                         // czasy: [{ scope, total, layout, load, assign, loaders, queries? }]
mergePayloads([pagePayload, sectionPayload]) // payload strony + section odroczonej
\`\`\`

Przykłady testów: „żaden binding nie gubi data” — \`expect(pageMessages(payload).filter(m => m.level === 'error')).toEqual([])\`; „patch wyróżnionej card trafia dokładnie w jeden node” — \`expect(selectNodes(payload, 'grid > card:first-child')).toHaveLength(1)\`.`,
} as const
