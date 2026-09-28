// Scarica il modello degli embedding (lo usa device/install.sh), così il Pi ritrova le note anche offline da subito.
import { loadEmbedder } from "./notes.ts";

const embedder = await loadEmbedder();
await embedder.embed(["prova"]);
console.log("Modello delle note pronto.");
