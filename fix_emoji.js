const fs = require('fs');

// Read the file
let content = fs.readFileSync('c:/Projects/Metawhale/src/handlers/messageHandler.js', 'utf8');

// Fix the incorrect emoji (using the exact string we found)
content = content.replace(
  "const typeEmoji = orderType === 'buy' ? '📈' : '.DataGridViewColumn';",
  "const typeEmoji = orderType === 'buy' ? '📈' : '📉';"
);

// Write the fixed content back to the file
fs.writeFileSync('c:/Projects/Metawhale/src/handlers/messageHandler.js', content);

console.log('Incorrect emoji has been fixed!');