// Le ricorrenze vivono in supabase/functions/_shared perché le usa anche la Edge Function (Deno), che si
// pubblica solo con i file della cartella functions. Qui le si espone al resto del monorepo.
export * from "../../../supabase/functions/_shared/recurrence.ts";
