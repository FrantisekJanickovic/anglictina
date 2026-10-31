# Angličtina

Rodinná appka na precvičovanie angličtiny pre deti základnej školy. Rodič na PC nahrá lekcie (z fotky učebnice alebo cez formulár) a nastaví profily detí. Deti sa učia na mobile.

## Čo vie

- **Rodičovský účet, viac detí.** Profil dieťaťa: trieda, zdatnosť, dotazník silných a slabých stránok, výber metód. Rodičovská zóna je chránená PIN-om, mobil sa dá zamknúť na jedno dieťa.
- **Lekcie:** slovíčka (EN, SK, príkladová veta s prekladom, obrázok), gramatické doplňovačky, texty na čítanie, počúvanie a písanie viet.
- **Import z učebnice:** nahráš jednu alebo viac fotiek strán. AI každú stranu rozdelí na jednotlivé cvičenia, ukáže ich prepis (len na čítanie) a navrhne typ. Typy meníš bublinkami (Slovíčka, Gramatika, Čítanie, Počúvanie, Písanie viet, Nepoužiť) a tlačidlom „Vytvoriť cvičenia“ z nich vzniknú položky lekcie. Zmena typu neskôr nahradí položky z daného cvičenia.
- **Tréning (dieťa):** tlačidlo „Ideme trénovať“ otvorí výber: trieda (1. až 9.), potom lekcie tejto triedy (jedna alebo viac), sprievodca Ema alebo Leo (po kliknutí ostane zatlačený a pozdraví dvoma vetami) a tlačidlo „Začať tréning“. Cvičenia idú v krátkych blokoch v náhodnom poradí, položky sa miešajú naprieč lekciami a rovnaký druh cvičenia nejde dvakrát za sebou, ak sa dá.
- **Metódy:** predvolene klasické precvičovanie a kartičky. Voliteľne spájanie dvojíc, poskladaj slovo, diktát, blesková runda, opakuj po mne, obrázok k slovíčku, body a séria dní. Zapínajú sa v profile dieťaťa.
- **Lekcie podľa tried:** každá lekcia patrí do triedy. V zozname lekcií sa poradie v rámci triedy mení šípkami; „predchádzajúce lekcie“ sú tie vyššie v zozname.
- **Problémové otázky:** z každého tréningu sa uložia konkrétne otázky, ktoré dieťaťu nešli (slovíčko, gramatická doplňovačka, veta na písanie). Rodič ich vidí v lekcii na záložke „Problémové otázky“, môže ich mazať po jednej aj hromadne a ručne označiť ako zvládnuté. Otázka sa sama označí ako zvládnutá po niekoľkých tréningoch za sebou so správnou odpoveďou bez nápovedy.
- **Globálne nastavenia tréningu** (Nastavenia → Tréning): pridávanie najproblémovejších otázok z predchádzajúcich N lekcií (predvolene 2, najviac 6 otázok na tréning), koľko tréningov treba na zvládnutie (3) a koľko nových otázok sa uloží z jedného tréningu (10).
- **Opakovanie chýb:** tlačidlo „Opakovať chyby“ precvičí nezvládnuté otázky zo všetkých lekcií. Slovíčka majú navyše Leitnerove krabičky, takže chybné sa zaraďujú skôr.
- **Hlas:** po správnej odpovedi zaznie anglická veta s prekladom, listening číta vetu a potom preklad. Mužský alebo ženský hlas. Bez Azure kľúča sa použije hlas telefónu.
- **Povzbudzovanie a motivačné hlášky** (vypínateľné), prehľad po tréningu, história a nezvládnuté otázky pre rodiča.
- **Ukážka bez účtu:** `/ukazka`.

## Stack

Next.js 16 (PWA), Tailwind 4, Supabase (Auth, Postgres s RLS), Vercel. AI: Claude API (import, vety, gramatika), Azure Speech (hlasy EN a SK).

## Premenné prostredia

Pozri `.env.example`. Povinné sú len dve `NEXT_PUBLIC_SUPABASE_*`. AI a Azure sú voliteľné; bez nich appka funguje s formulárom a hlasom telefónu.

## Databáza

Migrácie sú v `supabase/migrations/`.

## Vývoj

```bash
npm install
cp .env.example .env.local
npm run dev
```
