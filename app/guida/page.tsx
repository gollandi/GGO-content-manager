/**
 * The guide for the social media manager — what it shows, what each button
 * does, and what stays with JJ. Static: nothing here reads or writes data.
 */
export const metadata = { title: "Guida — cockpit GGO Med" };

const section = "paper mb-5 border border-paper-edge p-5 text-[14px] leading-relaxed text-paper-foreground";
const h2 = "column-label column-label-paper mb-2";

export default function GuidePage() {
    return (
        <div className="mx-auto max-w-2xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Guida</h1>
                    <p className="page-subtitle">Come scorre il lavoro social di GGO Med in questo cockpit.</p>
                </div>
            </header>

            <section className={section}>
                <h2 className={h2}>Guida al brand e ai social</h2>
                <p>Lo standard GGO Med per il lavoro social, approvato da JJ: le quattro regole che non si piegano, la voce, come nominare JJ, loghi e colori, formati e dimensioni, schemi per le didascalie, i canali e la checklist da seguire prima di programmare.</p>
                <p className="mt-2"><a className="underline" href="/api/social/library/social-media-guide" target="_blank" rel="noopener">Apri la guida interattiva</a> (scelta del formato, colori che si copiano con un clic, una schermata per le didascalie, una checklist che ricorda le tue spunte) oppure <a className="underline" href="/api/social/library/social-media-guide.pdf">scarica il PDF</a>.</p>
                <p className="mt-2">È interna: non inoltrarla e non pubblicarne nessuna parte.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Come si muove il lavoro</h2>
                <ol className="list-decimal space-y-1 pl-5">
                    <li>Gli agenti della casa pianificano e producono ogni post: immagini, didascalia e hashtag.</li>
                    <li>Quando un post è pronto per essere giudicato entra in <strong>Review</strong> e compare nella tua <a className="underline" href="/review">Coda social</a>.</li>
                    <li>Lo controlli e lo segni <strong>Pronto per JJ</strong>, aggiungi una nota, oppure <strong>chiedi modifiche</strong>.</li>
                    <li>Decide JJ: approva — e <strong>approvare è pubblicare</strong>: la sua approvazione pubblica il post nel Social Planner del sito e lo passa a Buffer, che lo pubblica nel suo slot — oppure lo rimanda al team, di solito con la tua nota.</li>
                </ol>
            </section>

            <section className={section}>
                <h2 className={h2}>I tre pulsanti</h2>
                <dl className="space-y-3">
                    <div>
                        <dt className="font-semibold">Pronto per JJ</dt>
                        <dd>Hai controllato il post e pensi che possa uscire. Aggiungi una breve nota se c&apos;è qualcosa che merita la sua attenzione. JJ vede &ldquo;Controllato da&rdquo; con il tuo nome e l&apos;ora. Non pubblica niente.</dd>
                    </div>
                    <div>
                        <dt className="font-semibold">Aggiungi nota</dt>
                        <dd>Lascia un commento nella storia del post senza cambiarne lo stato — una domanda, un suggerimento, un fatto da verificare.</dd>
                    </div>
                    <div>
                        <dt className="font-semibold">Chiedi modifiche</dt>
                        <dd>Il post va rilavorato. Scrivi cosa va cambiato (la nota è obbligatoria). JJ vede &ldquo;Modifiche chieste&rdquo; con il tuo nome sul post e lo rimanda al team; il post resta in coda finché non lo fa.</dd>
                    </div>
                </dl>
            </section>

            <section className={section}>
                <h2 className={h2}>Cosa resta a JJ</h2>
                <p>Pubblicare, in ogni forma — un post, una risposta a un commento, una pagina del sito, una newsletter — spetta a JJ. Approvare, programmare o inviare a Buffer, rimandare un post, rifiutarlo, chiuderlo o eliminarlo, e cambiare una data di pubblicazione spettano solo a lui. Tu agisci sui post in Review — quelli della tua coda. I pulsanti per il resto non ti vengono mostrati, e il server li rifiuta se richiesti. È voluto: GGO Med è uno studio medico, e niente arriva al pubblico senza l&apos;approvazione del clinico.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Le note sono una storia condivisa</h2>
                <p>Ogni nota si aggiunge al post con data, ora e nome di chi la scrive, su una riga, e niente viene mai sovrascritto. Il campo è condiviso e corto (1.600 caratteri per le persone, il resto è riservato agli agenti), quindi tieni le note brevi. Scrivi come su un documento condiviso: chiara, precisa, gentile. Puoi scrivere le note e i brief in italiano; ciò che GGO Med pubblica resta in inglese britannico.</p>
                <p className="mt-2">Le parentesi quadre diventano tonde: gli agenti usano marcatori tra parentesi quadre nello stesso campo.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Dare la direzione alla casa</h2>
                <p>Nei <a className="underline" href="/briefs">Brief</a> dici agli agenti cosa produrre. Scegli a chi è rivolto — Ernesto pianifica e gestisce la produzione social; Samantha scrive le didascalie, Greta monta il girato reale e Titti divide le registrazioni grezze, tutti tramite Ernesto; Ginevra crea reel generativi; Natascia risponde alle domande sui numeri — e scrivi cosa vuoi, per chi, entro quando e perché. Il tuo brief è firmato con il tuo nome. Gli agenti lo leggono al loro prossimo turno (Ernesto alle 07:15, 13:00 e 18:00) e rispondono nella stessa conversazione.</p>
                <p className="mt-2">Una <strong>strategia social</strong> va a Ernesto e orienta ogni piano che fa finché non la chiudi o la sostituisci. Se JJ ha aperta una sua strategia, la sua viene prima.</p>
                <p className="mt-2">Cosa un brief non può fare: pubblicare qualcosa, approvare un post, spendere oltre il budget settimanale della casa per i video generati (Ernesto chiede a JJ), o cambiare le regole della casa. Ogni bozza passa comunque dal controllo clinico e di conformità della casa, e ogni post aspetta comunque l&apos;approvazione di JJ. Puoi mandare venti messaggi al giorno.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Commenti</h2>
                <p>In <a className="underline" href="/comments">Commenti</a> trovi i commenti YouTube in attesa di risposta, ognuno con la bozza di Samantha. <strong>Suggerisci risposta</strong> le dà le tue parole o cosa dovrebbe dire la risposta: lei riscrive la bozza al giro successivo, e la nuova bozza passa dal controllo clinico e di conformità della casa come tutte le altre. <strong>Pronto per JJ</strong> gli dice che hai controllato la bozza a schermo. Una risposta viene pubblicata solo quando JJ la approva — approvare è pubblicare — e viene pubblicata esattamente la bozza che ha approvato. Se una bozza non ha passato il controllo di conformità, solo JJ può chiederne un&apos;altra.</p>
                <p className="mt-2"><strong>Dati sanitari.</strong> Se un commento parla della salute di qualcuno, premi <strong>Dati sanitari: gestisci a mano</strong>: nessun agente prepara più bozze, e JJ vede il segno. Non incollare mai dati sanitari in un suggerimento, in un brief o in uno strumento di intelligenza artificiale.</p>
                <p className="mt-2">La casa non legge ancora i commenti di Instagram e Facebook.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Numeri e sito</h2>
                <p>In <a className="underline" href="/performance">Risultati</a> trovi la lettura settimanale di Natascia e i numeri che la casa raccoglie ogni domenica (ricerca, sito, Instagram e Facebook, YouTube, newsletter). <a className="underline" href="/website">Sito</a> elenca ogni pagina di ggomed.co.uk con il suo stato. Sono entrambi in sola lettura; se lì qualcosa andrebbe cambiato, manda un brief.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Caricare i media</h2>
                <p><a className="underline" href="/carico">Carica media</a> accetta video e audio (MP4, MOV, M4V, WebM, MKV, AVI, M4A, MP3, WAV), anche direttamente dal telefono. I file grandi salgono a pezzi e ripartono se il segnale cade: premi <em>Riprendi</em>. Il worker del team prepara il girato per il montaggio. Puoi annullare solo i tuoi caricamenti.</p>
                <p className="mt-2">Non caricare mai niente che mostri o renda riconoscibile un paziente.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Il tuo account</h2>
                <ul className="list-disc space-y-1 pl-5">
                    <li>La tua password è tua: nessun altro la conosce. Se la dimentichi, chiedi a JJ un nuovo link.</li>
                    <li>Dopo diverse password sbagliate, l&apos;accesso si blocca per quindici minuti.</li>
                    <li>Tutto quello che fai qui viene registrato con il tuo nome.</li>
                    <li>Il tuo accordo firmato: <a className="underline" href="/api/contract/signed">scarica la tua copia</a> (un PDF di GGO Med con il testo firmato e le firme), oppure guardane lo stato nella <a className="underline" href="/benvenuto">pagina di benvenuto</a>.</li>
                </ul>
            </section>
        </div>
    );
}
