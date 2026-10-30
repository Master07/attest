const MESSAGE = `attest: the CLI is being rebuilt.
  npm run phase -- <ref> <label>   run one verifier phase (T5)
  npm run smoke                    plumbing smoke test (T4)
\`attest prove\` and \`attest verify\` arrive with T8/T10.`;

console.log(MESSAGE);
process.exit(1);
