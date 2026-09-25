import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

// ponytail: segnaposto finché la fase 5 non porta la sezione vera.
export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-4 pb-32">
      <PageHeader title="Scadenze" />
      <EmptyState expression="thinking" title="In arrivo">Bollette, bollo, revisione e assicurazioni, con un avviso in anticipo quanto vuoi tu.</EmptyState>
    </main>
  );
}
