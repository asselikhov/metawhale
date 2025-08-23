# 🌾 CES Token Price Telegram Bot

Telegram бот для отслеживания цены токена CES в реальном времени с улучшенным форматом вывода.

## ✨ Новые возможности

### 📊 Обновленный формат сообщения
```
💰 Цена токена CES: $ 3.18 | ₽ 256.40
➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖
🔻 -3.58% • 🅥 $ 1.17M • 🅐🅣🅗 $ 3.18
```

**Где:**
- 🔻 - падение цены (красная стрелка вниз)
- 🔺 - рост цены (зеленая стрелка вверх) 
- 🅥 - суточный объем торгов (24h Volume)
- 🅐🅣🅗 - максимальная цена за все время (All Time High)

### ⚡ Ускоренная работа
- Убран медленный процесс генерации графиков
- Уменьшен таймаут API запросов с 10 до 8 секунд
- Убрано получение ненужной истории цен при каждом запросе

### 🔄 Реальное время
- Автоматическое обновление цен каждые 30 секунд
- Логирование обновлений цены в консоль
- Умное кэширование для экономии API запросов

## 🚀 Установка и запуск

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd Metawhale
```

### 2. Установка зависимостей
```bash
yarn install
```

### 3. Настройка переменных окружения
Скопируйте `.env.example` в `.env` и заполните:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ces-bot
COINGECKO_API_URL=https://api.coingecko.com/api/v3
CES_CONTRACT_ADDRESS=0x1bdf71ede1a4777db1eebe7232bcda20d6fc1610
WEBHOOK_URL=https://your-app-name.onrender.com
PORT=3000
API_CALL_INTERVAL=10000
```

### 4. Запуск
```bash
# Разработка
yarn dev

# Продакшн
yarn start
```

## 📋 Команды бота

- `/start` - Приветственное сообщение
- `/price` - Получить текущую цену CES токена

## 🏗 Архитектура

### Основные компоненты:
- **Telegram Bot API** (через Telegraf)
- **CoinGecko API** для получения данных о цене
- **MongoDB** для хранения истории цен
- **Express.js** для webhook и health endpoints

### Оптимизации:
- Webhook вместо polling для стабильности
- Rate limiting для CoinGecko API
- Автоматический self-ping для Render
- Fallback на кэшированные данные при ошибках API

## 🔧 API интеграция

### CoinGecko API
Бот использует два endpoint'а:
1. `/simple/token_price/polygon-pos` - основной (по контракту)
2. `/simple/price?ids=ces` - резервный (по ID токена)

Поддерживаемые параметры:
- `vs_currencies=usd,rub` - цены в долларах и рублях
- `include_24hr_change=true` - изменение за 24 часа
- `include_market_cap=true` - рыночная капитализация  
- `include_24hr_vol=true` - объем торгов
- `include_ath=true` - максимальная цена (ATH)

## 📈 Мониторинг

### Health endpoints:
- `GET /` - Статус сервиса
- `GET /health` - Детальная информация о здоровье
- `GET /ping` - Keep-alive endpoint

### Логирование:
- Обновления цен каждые 30 секунд
- API ошибки и fallback на кэш
- Self-ping статус

## 🚀 Деплой на Render

Проект готов к деплою на Render.com с конфигурацией в `render.yaml`:

```yaml
services:
  - type: web
    name: metawhale-bot
    env: node
    buildCommand: yarn install
    startCommand: yarn start
```

## 🧪 Тестирование

Запуск тестов форматирования:
```bash
node test-format.js
```

## 📊 Структура проекта

```
├── index.js              # Основной файл бота
├── package.json          # Зависимости и скрипты
├── render.yaml           # Конфигурация для Render
├── .env.example          # Шаблон переменных окружения
├── test-format.js        # Тесты форматирования
└── README.md            # Документация
```

## 🔒 Безопасность

- Переменные окружения не коммитятся в репозиторий
- Использование webhook вместо long polling
- Rate limiting для предотвращения блокировки API
- Graceful shutdown при получении сигналов завершения

## 📝 Лицензия

MIT License

---

### 🤝 Поддержка

При возникновении проблем:
1. Проверьте переменные окружения
2. Убедитесь в доступности MongoDB
3. Проверьте статус CoinGecko API
4. Посмотрите логи приложения