/**
 * "See it live" hints: what to open in the devtools panel on each case page and what to look for.
 * Polish prose, technical names in English; the same inline format as case descriptions (`code`, *tab*).
 */
export const live: Record<string, string> = {
  // tutorial
  'tutorial-contract':
    'Kliknij `pick` i wskaż nagłówek „Witaj w Dedalu” — *node* pokaże component `section`, ID `welcome` i props `title`, `description` ze źródłem `← template` (z bloku).',
  'tutorial-first-block':
    '*tree* → section `news`: `section` → `grid` → trzy `card` z ID `news.0.0`, `news.0.1`, `news.0.2`. `pick` na kartę → props `title ← template`, `size ← default`.',
  'tutorial-data':
    '*sections* → `✓ card — 3 data items for 3 nodes`. `pick` na kartę → *node* → **data** (artykuł z API) i `assigned by card`.',
  'tutorial-to-props':
    '`pick` na kartę → *node*: **data** ma `headline`, `slug`, `cover` (kształt API), a **props** — `title ← data`, `href ← data`, `image ← data`, `size ← default`. To robota toProps i defaults.',
  'tutorial-slots':
    '*tree* → w każdej card node `badge :slot(badge)` i `avatar :slot(footer)`, ze znacznikiem ● (mają data). *sections* → trzy bindings: `card`, `card > :slot(badge)`, `card > :slot(footer)`.',
  'tutorial-shared-section':
    '*sections* → `source: section` przy `hero`, `source: page` przy `news`. *timing* → `hero` i `page data` startują razem (równolegle).',
  'tutorial-variants':
    '*tree* → section `news` ma jedną kolumnę i dwie card (to wariant `mobile`). `pick` na siatkę → `columns: 1 ← template`.',
  'tutorial-patch-remove':
    '`pick` na pierwszą kartę w „Najnowsze” → `size: "lg" ← patch card:first-child`. *tree* → card w section `more` nie mają slotu `footer` (usunięty przez `remove`).',
  'tutorial-missing-data':
    '*sections* → `✗ recommendations failed — the loader threw "recommendations API: 503"` i `! promotions removed — no node got data`. *timing* → loader `recommendations` na czerwono.',
  'tutorial-defer':
    'Odśwież stronę: „Dla Ciebie” najpierw jest zaślepką, po ~800 ms dochodzi treść. *timing* → osobny blok `section forYou (streamed separately)`.',
  'tutorial-queries-cache':
    '*timing* → pod `hero` i `page data` query `["tutorial","articles",8]`. Przy pierwszym wejściu (po starcie serwera) oba `miss`, ale fetch jest jeden — drugi loader czeka na ten sam (deduplikacja). Odśwież stronę: oba `hit`. *sections* → `cache key: ["page","tutorial-home","desktop"]`.',
  'tutorial-debugging':
    'Ten krok to ćwiczenie — panel jest głównym narzędziem. Zacznij od *sections*: na górze zobaczysz podsumowanie problemów strony, a przy section szczegóły. Każde zadanie niżej podpowiada, gdzie zajrzeć.',
  'tutorial-render':
    'Cały panel: `pick` na dowolny element, *tree* z wyszukiwaniem (wpisz tytuł artykułu), *sections*, *timing* i `copy report` — to narzędzia, których używasz na co dzień przy pracy ze stronami dedal.',

  // layout
  'blocks-repeat':
    '*tree* → section `news`: grid i trzy card z ID `news.0.0`, `news.0.1`, `news.0.2`. Kliknij `pick` i wskaż kartę na stronie — *node* pokaże jej ID, sugerowany selector i props (`size: "md" ← default`).',
  slots:
    '*tree* → node w slotach mają dopisek `:slot(media)`, `:slot(actions)`, `:slot(badge)`, a ID z nazwą slotu (`hero:media`, `hero:actions.0`). `pick` na badge na karcie → *node* → data `assigned by card > :slot(badge)`.',
  aliases:
    '*tree* → `card #featured`. Wpisz `#featured` w pole wyszukiwania *tree* — trafia dokładnie jedną card. `pick` na wyróżnioną kartę → *node* → data `assigned by #featured`.',
  'patch-selectors':
    '`pick` na ostatnią kartę → *node* → `size: "sm" ← patch card:last-child`; na badge → `variant ← patch …`. Wpisz selector z patcha w pole *tree* (np. `card:nth-child(even) > :slot(badge)`), żeby zobaczyć, w które node trafia.',
  'patch-no-match':
    '*sections* → `! patch “crad” matches no node in this section`. Kliknij podpowiedź **card** — *tree* pokaże node, w które trafiłby poprawiony selector.',
  remove: '*tree* → card mają tylko slot `badge` — slot `footer` usunął `remove`. Porównaj z przypadkiem *Slots*, gdzie card mają oba sloty.',
  'remove-root': '*sections* → `! promo removed — the section\'s remove option removed its root`. W *tree* jest tylko section `news`.',
  variants:
    '*tree* → jedna kolumna i dwie card (wariant `mobile`). `pick` na siatkę → *node* → `columns: 1 ← template`. Na stronie głównej przykładu przełącz `ctx.device`, żeby zobaczyć oba warianty.',

  // data
  bindings:
    '*sections* → `✓ card — 3 data items for 3 nodes` i `✓ card > :slot(badge) — …`. Najedź kursorem na binding — panel podświetli na stronie node, do których trafiły jego data.',
  'to-props':
    '`pick` na kartę → *node* → **data** (surowy artykuł z API: `headline`, `slug`…) i **props** po mapowaniu: `title ← data`, `href ← data`, `size ← default`.',
  'null-items': '*sections* → `! card — 3 data items for 3 nodes (1 null)` i `1 node removed — nothing to fill it with`. W *tree* zostały dwie card.',
  'shortage-remove': '*sections* → `! card — 2 data items for 4 nodes`, `2 nodes removed — …`. W *tree* tylko dwie card.',
  'shortage-keep': '*sections* → `2 nodes left empty (onShortage: \'keep\')`. W *tree* dwie ostatnie card nie mają znacznika ● (brak data).',
  surplus:
    '*sections* → `3 data items not shown — no node left for them:` z listą artykułów. Wpisz w pole *tree* fragment tytułu jednego z nich — panel powie, że jest tylko w data, które nie trafiły na stronę.',
  'binding-no-match':
    '*sections* → `✗ crad — 3 data items for 0 nodes` i podpowiedź **card**. *tree* → section „removed — no data; layout before assign” — widać layout, który czekał na data.',
  'binding-order':
    '*sections* → `✗ #featured — 1 data item for 0 nodes` z instrukcją, jak to naprawić. `pick` na wyróżnioną kartę → *node* → `assigned by card` (zamiast `#featured`).',
  dropped: '*sections* → `news.1.0, news.1.1 had data, but their parent news.1 was removed`. W *tree* nie ma drugiego gridu (`#more`).',

  // sections
  'section-loader':
    '*sections* → `source: section` przy `header`, `source: page` przy `news`. *timing* → loader `header` i `page data` na wspólnej osi czasu — startują razem.',
  'optional-failed':
    '*sections* → `✗ recommendations failed — the loader threw "recommendations API: 503"`. *timing* → pasek loadera `recommendations` na czerwono. Section `news` jest na stronie normalnie.',
  'on-empty-remove': '*sections* → `! promotions removed — no node got data (onEmpty: \'remove\')`. W *tree* tylko section `news`.',
  'on-empty-keep': '*sections* → `! promotions empty — … kept as is`. W *tree* section `promotions` z card bez ●.',
  'on-empty-block':
    '*sections* → `! search empty — … replaced by the onEmpty block`. `pick` na „Brak wyników” — to node bloku zastępczego, nie oryginalnej section.',
  required:
    '*sections* → `! popular removed — none of the required nodes got data` — mimo że hero dostał data. *tree* → section „removed — no data; layout before assign” z hero i card.',
  defer:
    'Odśwież stronę: „Dla Ciebie” najpierw jest zaślepką, po ~800 ms dochodzi treść. *timing* → osobny blok `section forYou (streamed separately)`; *tree* → section `forYou` po dotarciu.',
  'unknown-data':
    '*sections* → `! newz unknownData — … Did you mean: news?`. Section `news` nie dostała nic — w *tree* card bez ●, `source: none`.',
  'loader-undefined': '*sections* → `! news no data — the section loader returned undefined for this section, so it shows its layout only`.',

  // cache & queries
  'page-cache': '*sections* → `· cache key: ["page","docs-page-cache","desktop"] — debug builds bypass the cache`. W *timing* widać pełny build — debug nie czyta z cache strony.',
  'cache-key-undefined': '*sections* → `· cache key: none — cache.key returned undefined for this ctx, so the page is not cached`.',
  'query-statuses':
    '*timing* → pod `page data` pięć query w kolejności: `miss`, `hit`, `miss`, `stale`, `bypass` — z czasami (`hit` i `stale` trwają ułamek ms). Podsumowanie: `queries — 2 miss · 1 hit · 1 stale · 1 bypass`.',
  invalidate: '*timing* → query `["articles","latest"]` ma status `miss` — po `invalidate` cache był pusty.',

  // rendering
  'registry-missing':
    '*sections* → `✗ badge is not in the registry — 3 nodes rendered by the fallback`. *tree* → `!` przy każdym badge; `pick` na przerywaną ramkę → *node* → issue o registry.',
  'data-not-object':
    '*sections* → `✗ 1 node has issues` i treść issue przy section. *tree* → `!` przy `grid`; `pick` → *node* → **issues** i props bez data z API.',
  'to-props-throws': '*sections* → `✗ 1 node has issues`, `list shortcuts.0: toProps("list") threw: …`. *tree* → `!` przy `list`.',
  'to-props-non-object': '*sections* → `✗ 2 nodes have issues`, `toProps("badge") must return an object, got string …`. Badge na stronie są puste — dostały props z layoutu.',
  'data-without-node': '*sections* → issue strony `✗ news.0.7 data for an ID that has no node in the layout — layout and data are out of sync`.',

  // devtools
  panel:
    'Przejdź po kolei: `pick` i kliknij kartę (*node*), *tree* — wpisz tytuł artykułu w pole wyszukiwania, *sections* — bindings, *timing* — czasy, `copy report` — wklej raport do notatnika.',
  timing: '*timing* → `related` (150 ms) oznaczony `slowest`, `header` (40 ms) i `page data` krótsze — wszystkie paski zaczynają się w tym samym miejscu, bo loadery działają równolegle.',
  'timing-sequential':
    '*timing* → loader `sequential` ~200 ms (`slowest`): jego query `latest-a` startuje przy ~0 ms, `popular-a` — ok. 100 ms później, gdy pierwsze się skończy. Loader `parallel` ~100 ms: oba query (`latest-b`, `popular-b`) startują w tej samej chwili. Wszystkie query to `miss` (pusta instancja).',
  'no-trace':
    '*sections* → `· built without trace — …`. *timing* → `No timings`. `pick` na kartę → props z layoutu nie mają źródła (bez trace build nie zapisuje `← default` / `← template` / `← patch`); `← data` zostaje, bo ten widok robi `resolve` z trace.',
}

/** For cases that throw: the panel has nothing to show — explain it instead of a hint. */
export const LIVE_THROWS =
  'Panel devtools jest tu pusty — build (albo `resolve`) się nie udał, więc na stronie nie ma payloadu. W aplikacji zostaje komunikat wyjątku: log serwera, overlay błędu w Next — ten sam, który widać niżej w „thrown error”.'
