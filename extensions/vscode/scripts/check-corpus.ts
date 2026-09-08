import { resolveCatalogue } from "../src/catalogue";
import { renderSvg } from "../src/static-data";

async function main() {
    const documentPath = process.argv[2];
    if (!documentPath)
        throw new Error(
            "Usage: npm run test:corpus -- /path/to/installed/consumer/example.tsx",
        );
    const catalogue = await resolveCatalogue(documentPath);
    let paths = 0;
    for (const name of catalogue.names) {
        const icon = await catalogue.load(name).catch((error) => {
            throw new Error(`${name}: ${String(error)}`);
        });
        renderSvg(icon, "#dddddd");
        paths += icon.paths.length;
    }
    console.log(
        `CORPUS PASS: ${catalogue.names.length} exact named exports, ${paths} paths, static parse and safe SVG render.`,
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
