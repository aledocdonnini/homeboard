import EmptyState from "@/components/ui/EmptyState";
import Big from "@/components/dash/Big";
import PageHeader from "@/components/ui/PageHeader";

// ponytail: segnaposto finché la fase 5 non porta la sezione vera.
export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 lg:max-w-2xl">
      <PageHeader title="Scadenze">
        <p className="flex items-end gap-3">
          <Big className="text-8xl text-dot-off">00</Big>
          <span className="pb-2 text-xl text-muted">in arrivo</span>
        </p>
      </PageHeader>
      <EmptyState expression="thinking" title="In arrivo">Bollette, bollo, revisione e assicurazioni, con un avviso in anticipo quanto vuoi tu.</EmptyState>
    </main>
  );
}
