# Brief e riassunti leggibili

Il cockpit apre i resoconti con una lettura in prosa: che cosa è accaduto, perché conta, quali aspetti restano incerti e quale decisione richiede JJ. Il testo originale rimane consultabile in una sezione espandibile. La sintesi accompagna la review; i testi effettivi di proposte, bozze e caption restano integrali e soggetti alle autorizzazioni esistenti.

La presentazione copre il brief del mattino letto da Notion, i resoconti giornalieri degli ultimi sette giorni e le note di riconsegna delle attività, comprese quelle già salvate. Le risposte future del runner e del Citofono condividono lo stesso criterio editoriale. Nella conversazione le domande a JJ restano visibili; i dettagli degli strumenti e gli aggiornamenti tecnici sono raccolti in una sezione espandibile. Le pagine sorgente in Notion e i registri delle attività non vengono riscritti.

## Criterio editoriale

La regola condivisa è in `lib/briefing/policy.ts`: da due a quattro paragrafi brevi, collegati e concreti, senza inventari di ID, percorsi o cronologie di log. Un'interpretazione deve essere riconoscibile come tale. Errori, scadenze, fonti mancanti e decisioni aperte non devono scomparire nella sintesi. Un'esecuzione terminata o dei record aggiornati non dimostrano che un contenuto sia stato prodotto, approvato o pubblicato.

Per esempio, in un caso **dimostrativo**, un elenco di chiamate agli strumenti può diventare: «La bozza preparata è disponibile nel pannello di revisione. Il prossimo passaggio è controllare che il testo completo e le fonti rispondano al bisogno editoriale.» Il conteggio degli aggiornamenti resta nel dettaglio; il paragrafo spiega quale valutazione serve. Questo esempio e le immagini collegate sotto usano dati sintetici, non risultati di produzione.

## Preparazione e disponibilità sul VPS

Le richieste interattive ricevono subito un quadro essenziale in prosa, ricavato dai dati disponibili. La lettura del mattino riconosce soltanto le forme esplicite del generatore Notion esistente; formati sconosciuti rimangono dichiarati tali. I resoconti delle esecuzioni distinguono completamenti, errori e stati sconosciuti. Anche un'esecuzione con stato `Success` richiede attenzione se il conteggio degli errori è positivo.

La lettura più articolata viene preparata in background. Il servizio usa il provider Anthropic già presente e `COCKPIT_REPORT_MODEL`, mantenendo il valore predefinito esistente. Il modello riceve fonti e quadro essenziale come dati, senza strumenti di azione. Sono ammesse al massimo due chiamate concorrenti per processo, con timeout di venti secondi e senza retry automatico del client. Richieste identiche condividono il lavoro in corso; dopo un errore una nuova richiesta può riprovare trascorsi sessanta secondi.

Il timer VPS esistente prepara anche i brief dopo aver aggiornato House e Cancello. La cache delle sintesi è identificata dall'intera fonte, dal contesto, dalle regole editoriali e dalla configurazione del modello. Un cambiamento al testo invalida la sintesi anche quando ID e stato restano identici. Con `COCKPIT_SNAPSHOT_DIR` configurato, le sintesi riuscite sono conservate nella sottocartella `briefings`, con scritture atomiche, directory privata e file con permessi `0600`; vengono conservati al massimo 128 file. Non vengono salvati nuovi duplicati dei log nella cache delle sintesi. Il timer registra solo conteggi di disponibilità, senza testi o credenziali.

Il browser verifica ogni cinque secondi se la lettura è pronta, per un massimo di 24 richieste, e annulla le richieste al cambio di vista o alla chiusura. Una nuova lettura impedisce a risposte precedenti di sovrascriverla. Il riepilogo di un'attività viene caricato senza rileggere il suo intero registro degli eventi. La nota visualizzata è legata all'attività e alla versione corrispondenti.

## Limiti e review umana

Se il modello non è disponibile o restituisce un formato inadeguato, il quadro essenziale resta visibile con un'indicazione esplicita. La validazione controlla forma, lunghezza e completezza della risposta, ma **non certifica la fedeltà semantica del modello**. Per una fonte superiore a 48.000 caratteri, il modello riceve inizio e fine con indicazione della parte omessa; la presentazione segnala sempre questo limite. Il quadro essenziale viene ricavato dall'intera fonte.

Nessuna sintesi concede approvazioni o avvia una pubblicazione. I controlli di autenticazione e di approvazione sui canali di scrittura restano quelli esistenti. La review finale riguarda sempre i contenuti effettivi e le fonti accessibili, non la sola interpretazione del modello.

## Verifica del 9 settembre 2026

La suite locale completa passa: 218 test riusciti, cinque test preesistenti saltati, nessun fallimento. La build di produzione e il controllo TypeScript passano. I nuovi test verificano fallback prudenti, invalidazione della cache quando cambia la fonte, persistenza privata, concorrenza limitata, errori del modello, fonte parziale, annullamento delle risposte obsolete e autenticazione del riepilogo. I test del timer mantengono la separazione fra lettura e approvazione.

La verifica nel browser usa il frontend della build di produzione con **tutte le risposte applicative sostituite da fixture locali**. Su desktop a 1280 px e telefono a 390 px conferma aggiornamento automatico della prosa, originali inizialmente chiusi ma accessibili, testo della proposta da approvare conservato integralmente, assenza di overflow orizzontale e di errori JavaScript. Il controllo blocca qualsiasi richiesta di scrittura e verifica di non averne rilevate. Non è una prova di generazione del modello reale, di deployment o di prestazioni sul VPS.

[Brief desktop](2026-09-09/morning-1280.png), [brief telefono](2026-09-09/morning-390.png), [cockpit desktop](2026-09-09/cockpit-1280.png), [cockpit telefono](2026-09-09/cockpit-390.png), [esito del browser](2026-09-09/browser-check.json).

Per ripetere la verifica: eseguire `npm test` e `npm run build`; avviare la build su `127.0.0.1:3114` con `AUTH_SECRET=content-manager-local-fixture-only` e `AUTH_URL=http://127.0.0.1:3114/api/auth`, quindi eseguire `node tools/performance/verify-readable-briefs.mjs`. Il controllo richiede Playwright e Chromium, selezionabili tramite `PLAYWRIGHT_MODULE` e `CHROME_BIN`. Lo script rifiuta host non locali e la credenziale dimostrativa va usata soltanto per questo server locale.
