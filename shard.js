const { ClusterManager } = require('discord-hybrid-sharding');
const path = require('path');
require('dotenv').config();
const winston = require('winston');

// Inicjalizacja loggera
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'sharding.log' })
    ]
});

// Konfiguracja menedżera hybrydowego sharding’u
const manager = new ClusterManager(path.join(__dirname, 'index.js'), {
    token: process.env.BOT_TOKEN,
    totalShards: 'auto',
    mode: 'process'  // Możliwe opcje: 'process' lub 'worker'
});

// Obsługa zdarzenia tworzenia shardu
manager.on('shardCreate', shard => {
    logger.info(`Wystartowano shard o ID: ${shard.id}`);
    
    // Poniższe zdarzenia są podobne do tych z tradycyjnego sharding’u.
    shard.on('spawn', () => {
        logger.info(`Shard ${shard.id} został uruchomiony`);
    });

    shard.on('ready', () => {
        logger.info(`Shard ${shard.id} jest gotowy`);
    });

    shard.on('disconnect', () => {
        logger.warn(`Shard ${shard.id} został rozłączony`);
    });

    shard.on('reconnecting', () => {
        logger.info(`Shard ${shard.id} próbuje ponownie połączyć`);
    });

    shard.on('exit', code => {
        logger.warn(`Shard ${shard.id} zakończył się z kodem: ${code}`);
    });

    // W zależności od potrzeb możesz dodać obsługę innych zdarzeń (np. error, message)
});

// Uruchomienie shardów
manager.spawn()
    .then(() => {
        logger.info('Wszystkie shardy zostały uruchomione.');
    })
    .catch(error => {
        logger.error(`Błąd podczas uruchamiania shardów: ${error.message}`);
        process.exit(1);
    });
