import AppShell from "../../components/AppShell";

export default function Loading() {
    return (
        <AppShell>
            <div className="p-8 max-lg:p-4">
                <p className="column-label">La Portineria</p>
                <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong">
                    Caricamento segnali...
                </h1>
            </div>
        </AppShell>
    );
}
