const fs = require('fs');

// Чтение файла и вывод последних 20 строк
const content = fs.readFileSync('c:/Projects/Metawhale/src/bot/telegramBot.js', 'utf8');
const lines = content.split('\n');

console.log(`Всего строк в файле: ${lines.length}`);
console.log('\nПоследние 20 строк файла:');

const start = Math.max(0, lines.length - 20);
for (let i = start; i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}