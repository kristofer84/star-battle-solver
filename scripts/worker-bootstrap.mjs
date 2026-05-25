/**
 * Worker bootstrap: registers tsx ESM hooks then imports the TypeScript worker file.
 * tsxEsmApi path is passed from the main thread via workerData so the bootstrap
 * works regardless of how tsx was installed (local vs global npx cache).
 */
import { workerData } from 'worker_threads';

const { tsxEsmApi, __workerFile } = workerData;

const { register } = await import(tsxEsmApi);
register();

await import(__workerFile);
