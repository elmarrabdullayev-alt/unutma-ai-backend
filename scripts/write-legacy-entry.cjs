// Keeps old deploy settings working: hosts still configured with
// "node dist/server.cjs" start the real server from dist-server/.
// The file only contains a require() path, so serving it publicly leaks nothing.
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'dist', 'server.cjs');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, "require('../dist-server/server.cjs');\n");
console.log('[build] wrote dist/server.cjs -> dist-server/server.cjs');
