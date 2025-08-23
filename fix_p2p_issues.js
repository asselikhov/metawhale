const fs = require('fs');

// Read the file
let content = fs.readFileSync('c:/Projects/Metawhale/src/handlers/messageHandler.js', 'utf8');

// Fix 1: Replace the incorrect emoji
content = content.replace(
  "const typeEmoji = orderType === 'buy' ? 'ЁЯУИ' : '.DataGridViewColumn';",
  "const typeEmoji = orderType === 'buy' ? 'ЁЯУИ' : 'ЁЯУЙ';"
);

// Fix 2: Replace all ctx.editMessageText with ctx.reply
content = content.replace(/ctx\.editMessageText/g, 'ctx.reply');

// Write the fixed content back to the file
fs.writeFileSync('c:/Projects/Metawhale/src/handlers/messageHandler.js', content);

console.log('All P2P issues have been fixed!');