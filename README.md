# homii v3.1 — Zonnestraal Wonen demo

Een Nederlandstalig demo-prototype van homii voor woningcorporaties: hoe
servicekosten worden afgerekend per kostencomponent en uiteindelijk per
huurder. Twee fictieve complexen, één denkbeeldige corporatie.

## Wat zit erin

**Demo-organisatie:** Zonnestraal Wonen (fictief)

**Twee complexen:**
- **Tulpenhof** (Utrecht, 36 woningen) — twee blokken (Voorhuis 16,
  Achterhuis 20) plus een subset doelgroep voor tuinonderhoud (12 woningen
  begane grond). 5 kostencomponenten.
- **Bloemkwartier** (Zwolle, 56 woningen + 3 BOG) — alternatieve
  subgroepen (24 op CV-aansluiting vs 32 op stadsverwarming), galerij
  subgroep (32), aparte commerciële pool (3 BOG). 8 kostencomponenten.

**Wat het laat zien:**
1. **Overzicht** — KPI's, doelgroepen, voortgang afrekening, aandachtspunten
2. **Kostenstroom** — progressieve Sankey (categorieën → componenten →
   per-component canvas), per-component afrekenproces in 5 stappen
3. **Huurders** — master grid, één rij per huurperiode, kolom per
   kostencomponent, klikbaar voor volledig overzicht per woning
4. **Live editing** — bewerk kosten/voorschotten/verdeelsleutels en zie
   het direct doorrekenen tot op huurder-niveau (Stap 5 voorbeeld + master
   tab beide werken live mee)
5. **Canvas-bewerking** — knooppunten slepen om te ordenen, correcties
   (+/−) toevoegen op stromen, knooppunten verwijderen — allemaal met
   live impact op de afrekening

## Lokaal draaien

```bash
npm install
npm run dev
# → http://localhost:5180
```

Edits worden bewaard in `localStorage` (`homii.costFlow.edits.v1`). Reset
via de browser-devtools.

## Stack

React 18 · Vite 7 · Tailwind v4 · React Router · lucide-react

## Architectuur in één oogopslag

- **`src/data/`** — JSON met fictieve buildings, organisaties en de twee
  cost-flow definities (Tulpenhof + Bloemkwartier)
- **`src/lib/costFlow.js`** — leest de actieve kostenstroom + overlay van
  bewerkingen via `active()`
- **`src/lib/costFlowEdits.js`** — localStorage-overlay voor alle
  bewerkingen (veldwijzigingen, toegevoegde/verwijderde knopen,
  correcties, vergrendelde componenten)
- **`src/lib/perTenant.js`** — deterministisch synthetische VHE- en
  huurperiode-registers + de berekening per (huurperiode × component)
- **`src/components/CostFlowPage.jsx`** — Sankey (L1) + per-component
  canvas (L3) + bewerk-modus
- **`src/components/LaneWorkflowView.jsx`** — 5-stappen afrekenproces
  per kostencomponent
- **`src/components/GroupDetailPage.jsx`** — paginahost (Overzicht,
  Kostenstroom, Huurders, etc.) inclusief de master Huurders-tab
- **`src/components/TenancyDetailSheet.jsx`** — volledig overzicht per
  woning (kosten/voorschot/Δ over alle componenten)

Alle bewerkingen zijn live: één `useEditsVersion()` subscriptie verbindt
elke kant van het systeem. Wijzig een kostenpost in stap 1 en het
voorbeeld in stap 5 + de master Huurders-tab werken direct mee.
