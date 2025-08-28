console.log('Проверка исправления синтаксической ошибки в telegramBot.js...');

// Проверка синтаксиса всех измененных файлов
const { exec } = require('child_process');

const files = [
  'c:\\Projects\\Metawhale\\src\\bot\\telegramBot.js',
  'c:\\Projects\\Metawhale\\src\\handlers\\P2PHandler.js',
  'c:\\Projects\\Metawhale\\src\\handlers\\OptimizedCallbackHandler.js'
];

let success = true;

files.forEach(file => {
  try {
    exec(`node -c "${file}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Ошибка в файле ${file}:`, error);
        success = false;
      } else {
        console.log(`✅ Файл ${file} синтаксически корректен`);
      }
      
      // Проверка завершения всех проверок
      if (files.indexOf(file) === files.length - 1) {
        if (success) {
          console.log('\n🎉 Все файлы синтаксически корректны!');
          console.log('✅ Исправление успешно завершено');
        } else {
          console.log('\n❌ Найдены ошибки в файлах');
        }
      }
    });
  } catch (e) {
    console.error(`❌ Ошибка при проверке файла ${file}:`, e);
    success = false;
  }
});