# Angličtina

Rodinná appka na precvičovanie angličtiny pre deti základnej školy. Rodič na PC nahrá lekcie (z fotky učebnice alebo cez formulár) a nastaví profily detí. Deti sa učia na mobile.

## Čo vie

- **Rodičovský účet, viac detí.** Profil dieťaťa: ročník, zdatnosť, dotazník silných a slabých stránok, výber metód. Rodičovská zóna je chránená PIN-om, mobil sa dá zamknúť na jedno dieťa.
- **Lekcie:** slovíčka (EN, SK, príkladová veta s prekladom, obrázok), gramatické doplňovačky, texty na čítanie a počúvanie. Import z fotky a dopĺňanie viet cez Claude.
- **Hodina:** dieťa vyberie lekcie, zaškrtne časti a ich poradie, potom spustí.
- **Metódy:** predvolene klasické precvičovanie a kartičky. Voliteľne spájanie dvojíc, poskladaj slovo, diktát, blesková runda, opakuj po mne, rozcvička z minulých lekcií, premiešanie, obrázok k slovíčku, body a séria dní. Zapínajú sa v profile dieťaťa.
- **Opakovanie chýb:** Leitnerove krabičky. Chyba vráti slovíčko na začiatok, v hodine sa vráti o pár otázok neskôr a v ďalších hodinách sa zaraďuje skôr.
- **Hlas:** po správnej odpovedi zaznie anglická veta s prekladom, listening číta vetu a potom preklad. Mužský alebo ženský hlas. Bez Azure kľúča sa použije hlas telefónu.
- **Povzbudzovanie a motivačné hlášky** (vypínateľné), prehľad po hodine, história a problémové slovíčka pre rodiča.
- **Ukážka bez účtu:** `/ukazka`.

## Stack

Next.js 16 (PWA), Tailwind 4, Supabase (Auth, Postgres s RLS), Vercel. AI: Claude API (import, vety, gramatika), Azure Speech (hlasy EN a SK).

## Premenné prostredia

Pozri `.env.example`. Povinné sú len dve `NEXT_PUBLIC_SUPABASE_*`. AI a Azure sú voliteľné; bez nich appka funguje s formulárom a hlasom telefónu.

## Vývoj

```bash
npm install
cp .env.example .env.local
npm run dev
```
