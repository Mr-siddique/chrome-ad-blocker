const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// src/ is an ES-module package (src/package.json), so it is loaded with dynamic import.
async function main() {
  const src = (file) => import(path.join(ROOT, 'src', file));
  const { buildStreamingRules } = await src('utils/dnr-rules.js');
  const { PRIME_VIDEO_FILTER } = await src('filters/prime-video.js');
  const { JIO_HOTSTAR_FILTER } = await src('filters/jio-hotstar.js');
  const { VAST_VPAID_FILTER } = await src('filters/vast-vpaid.js');
  const rules = buildStreamingRules({
    filters: [PRIME_VIDEO_FILTER, JIO_HOTSTAR_FILTER],
    vast: VAST_VPAID_FILTER,
  });
  const out = path.join(ROOT, 'src/rules/streaming-rules.json');
  fs.writeFileSync(out, `${JSON.stringify(rules, null, 2)}\n`);
  console.log(`Wrote ${rules.length} rules to ${path.relative(ROOT, out)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
