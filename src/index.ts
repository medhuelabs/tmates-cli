#!/usr/bin/env node

import { runCli } from './cli/app';

async function main() {
  await runCli(process.argv.slice(2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
