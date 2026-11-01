const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// src/ is an ES-module package (src/package.json), so it is loaded with dynamic import.
function write(name, rules) {
  const out = path.join(ROOT, 'src/rules', name);
  fs.writeFileSync(out, `${JSON.stringify(rules, null, 2)}\n`);
  console.log(`Wrote ${rules.length} rules to ${path.relative(ROOT, out)}`);
}

async function main() {
  const src = (file) => import(path.join(ROOT, 'src', file));
  const { buildGeneralRules, buildStreamingRules } = await src('utils/dnr-rules.js');
  const { GENERAL_FILTER } = await src('filters/general-ads.js');
  const { PRIME_VIDEO_FILTER } = await src('filters/prime-video.js');
  const { JIO_HOTSTAR_FILTER } = await src('filters/jio-hotstar.js');
  const { VAST_VPAID_FILTER } = await src('filters/vast-vpaid.js');
  const rules = buildStreamingRules({
    filters: [PRIME_VIDEO_FILTER, JIO_HOTSTAR_FILTER],
    vast: VAST_VPAID_FILTER,
  });
  write('streaming-rules.json', rules);
  write('general-rules.json', buildGeneralRules([GENERAL_FILTER]));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
