# Dedal × własny design system

Strona główna serwisu z tekstami piosenek zbudowana na Dedalu z komponentami własnego design systemu: prymitywy layoutu (`wrapper-container`, `wrapper-layout`, `wrapper-group`), kafle, karty, karuzela, reklamy. Przykład na poziomie silnika — bez renderera: buduje `PageResult` i `ResolvedPage` na mockach źródeł danych.

```bash
npm run dedal   # build paczki → npm pack → instalacja z vendor/
npm test         # testy strony
npm run demo     # sekcje, liczba węzłów i rozmiar wyniku dla desktop i mobile
```

## Struktura

| Plik | Rola |
|---|---|
| `src/contract.ts` | kontrakt komponentów: otwarte propsy, sloty zadeklarowane jawnie obok (`carousel.items`, `special-content.secondaryComponent`) |
| `src/ui.ts` | opcje instancji: domyślne propsy komponentów, `toProps.card` (dane karty w propsie `data`) |
| `src/blocks.ts` | bloki: zwykłe stałe i funkcje (`node`, `repeat`, `clone`), osobne warianty desktop / mobile tam, gdzie różni się struktura |
| `src/helpers.ts` | dane sekcji per komponent: kafle utworów (z parsowaniem „wykonawca – tytuł”), karuzela kategorii, aktualności |
| `src/home.page.ts` | strona: zapytania, sekcje wspólne (nagłówek, okruszki, stopka), sekcje treści, patche, bindingi |
| `src/api.ts`, `src/mocks.ts` | interfejs źródeł danych i mocki |

## Co pokazuje przykład

**Zapytania i sekcje wspólne.** Meta strony, dane globalne, kategorie i listy artykułów to zapytania (`ui.query`). Nagłówek, okruszki i stopka są sekcjami z własnymi loaderami — korzystają z tych samych zapytań co `data` strony, więc dane globalne są pobierane raz na stronę (test „wspólne dane pobierane raz”). Strona tworzy własną instancję (`createHomePage(api)`): cache zapytań należy do źródła danych.

**Warianty urządzeń.** `sections: ({ device }) => [...]` — inne bloki (lista w kolumnach vs jedna kolumna), inne patche, sekcja tylko na mobile (`srodekSliderAd`).

**Bindingi per komponent.** Dane sekcji to osobne listy dla nagłówka, kafli i okładek (`{ 'block-header': [...], 'tile-v2': [...], 'image-holder': [...] }`). Przy brakach danych kafel i jego okładka zostają parą, a nadmiarowe węzły znikają (`onShortage: 'remove'`).

**Sloty zamiast komponentów w danych.**
- CTA: logo w slocie `secondaryComponent` bloku treści; na mobile sekcja usuwa slot (`remove: 'special-content > :slot(secondaryComponent)'`).
- Karuzela kategorii: elementy w slocie-liście `items` — `repeat(special-content, 12)` przycinane do liczby kategorii; obrazki elementów w ich slotach (`'special-content > :slot(secondaryComponent)'`).

**Selektory w patchach.** `tile-v2` (wszystkie kafle sekcji), `:root` (korzeń sekcji), `:root > wrapper-layout` (bezpośrednie dziecko korzenia), `special-content`.

**Kolejność bindingów.** W CTA szczegółowy selektor (logo w slocie) stoi przed ogólnym (`image-holder`) — wcześniejszy selektor zajmuje węzeł i późniejszy go pomija.

**Karty.** `toProps.card` przekazuje dane karty w propsie `data`, a tracking obok (`setupTracking`); pozostałe komponenty dostają dane rozłożone w propsach.

**Sekcje zależne od danych.** Listy utworów mają `required: 'tile-v2'`: sekcja jest pusta, gdy żaden kafel nie dostał danych (nagłówek dostaje je zawsze). Pusta sekcja domyślnie znika (`onEmpty: 'remove'`) — `polecane` przy pustym źródle (`report.removedSections`, `report.emptySections`).

## Wzorce

| Potrzeba | Wzorzec |
|---|---|
| Węzły powiązane (divider znika razem z kaflem obok) | osobny binding dla dividerów: `{}` — zostaje, `null` — brak danych, usuwany (`relatedDividers` w `home.page.ts`) |

Wyniki zapytań są zamrożone (tylko do odczytu) — strona robi kopie, gdy coś zmienia (`metaFor`), i nie sortuje list w miejscu.
