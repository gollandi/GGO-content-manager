# Deploy remoto — control-plane sempre acceso (Fase 2)

> Il cockpit è 12-factor: stesso codice in locale e sul server. Questo
> runbook è il percorso VPS (consigliato: i run generativi durano minuti e
> `.runs/` è su file — su Vercel servirebbero ristrutturazioni).

## 0. Prerequisiti
- VPS piccolo (2 GB RAM bastano): Hetzner CX22 / Fly.io / DigitalOcean.
- Node 24+, git, nginx (o Caddy per TLS automatico).
- Un dominio/sottodominio (es. `cockpit.ggomed.co.uk`).

## 1. Sul server
```bash
git clone https://github.com/gollandi/GGO-content-manager.git && cd GGO-content-manager
npm ci
cp .env.example .env.local   # compila TUTTE le variabili (vedi sotto)
npm run build
npm start                     # oppure: pm2 start "npm start" --name cockpit
```

## 2. Variabili (.env.local sul server)
Tutte quelle del tuo `.env.local` locale, PIÙ:
```
COCKPIT_SERVICE_TOKEN=<openssl rand -hex 32>   # per ernesto
```
⚠️ I token escono dal Mac: usa token NUOVI (rigenera viewer/write token in
Sanity manage e la chiave Anthropic in console) così quelli locali restano
solo locali e sono revocabili separatamente.

## 3. TLS + reverse proxy (Caddy, il più semplice)
```
cockpit.ggomed.co.uk {
    reverse_proxy localhost:3000
}
```

## 4. Accensione delle view in ernesto (R9)
Nel `.env` di ernesto-agents-house sul Mac:
```
COCKPIT_VIEWS_URL=https://cockpit.ggomed.co.uk
COCKPIT_SERVICE_TOKEN=<lo stesso del server>
```
Verifica: `node operations/pif-tick-lookup.js <un-content-asset-id>` deve
loggare "PIF TICK status (cockpit view)".

## 5. Osservazione (1 settimana) → pensionamento
- Controlla il 🤖 Agents Activity Log: nessun Failed sui job repointed
  (nightly-review-due, newsletter-scan, pif-tick-lookup via skills).
- Poi: `npm run retire:mirrors -- --apply --views-live` (archivia Evidence
  Sources + Schema Validation; Content Assets resta come stub — §5.5 A).
- Il run settimanale di notion-integration si spegne disattivando il
  workflow `weekly-full.yml` (gli stadi 3/5/6/7/9 sono rimpiazzati; 8-keywords
  resta finché il cache-tier non li possiede — Fase 2 residua).

## 6. Cosa NON spostare sul server
- Il worker video (Greta/Titti): resta sul Mac (girato + ffmpeg). Il server
  accoderà i job (Family C, da costruire).
- Le skill di ernesto: restano in ~/.claude sul Mac.
