const { ClusterManager, ReClusterManager, HeartbeatManager } = require('discord-hybrid-sharding');
const path = require('path');
const winston = require('winston');
require('dotenv').config();

// Rozszerzony logger z dodatkowymi poziomami i kolorami
const logger = winston.createLogger({
    level: 'debug', // Zmieniono z 'info' na 'debug' dla bardziej szczegółowych logów
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'  // Dodano milisekundy dla dokładniejszego timestampa
        }),
        winston.format.printf(info => `[${info.timestamp}] [${info.level.toUpperCase()}] [CLUSTER MANAGER] ${info.message}`)
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // Dodano kolorowanie dla konsoli
                winston.format.printf(info => `[${info.timestamp}] [${info.level.toUpperCase()}] [CLUSTER MANAGER] ${info.message}`)
            )
        }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }), // Osobny plik dla błędów
        new winston.transports.File({ filename: 'sharding.log' }) // Główny plik logów
    ]
});

// Logowanie informacji o starcie managera
logger.info('Inicjalizacja Discord Hybrid Sharding...');
logger.info(`Wersja Node.js: ${process.version}`);
logger.info(`Katalog główny: ${__dirname}`);

// Konfiguracja menedżera hybrydowego sharding'u
logger.info('Tworzenie ClusterManager...');
const manager = new ClusterManager(path.join(__dirname, 'index.js'), {
    token: process.env.BOT_TOKEN,
    totalShards: 'auto',
    shardsPerClusters: 2,
    mode: 'process',
    respawn: true // Automatyczny restart klastrów
});

// Logowanie konfiguracji (bez tokenu)
logger.info(`Konfiguracja: totalShards='auto', shardsPerClusters=2, mode='process', respawn=true`);

// Rozszerzenie managera o ReClusterManager
logger.info('Dodawanie ReClusterManager...');
manager.extend(
    new ReClusterManager({
        restartMode: 'gracefulSwitch', // Dodano tryb restartu
    })
);
logger.info('ReClusterManager załadowany');

// Rozszerzenie managera o HeartbeatManager
logger.info('Dodawanie HeartbeatManager...');
manager.extend(
    new HeartbeatManager({
        interval: 2000,
        maxMissedHeartbeats: 5,
        mode: 'worker' // Tryb monitorowania
    })
);
logger.info('HeartbeatManager załadowany');

// Logowanie systemowych informacji
manager.on('debug', message => {
    logger.debug(`Debug: ${message}`);
});

// Logowanie ostrzeżeń systemowych
manager.on('warn', message => {
    logger.warn(`Ostrzeżenie systemowe: ${message}`);
});

// Główna obsługa zdarzeń klastra
manager.on('clusterCreate', cluster => {
    logger.info(`Klaster [ID: ${cluster.id}] został utworzony`);
    logger.debug(`Klaster [ID: ${cluster.id}] Informacje: Zarządza shardami od ${cluster.shardList[0]} do ${cluster.shardList[cluster.shardList.length - 1]}`);
    
    // Rejestrowanie wszystkich zdarzeń klastra
    cluster.on('spawn', () => {
        logger.info(`Klaster [ID: ${cluster.id}] Proces został uruchomiony (PID: ${cluster.process?.pid || 'nieznany'})`);
    });
    
    cluster.on('ready', () => {
        logger.info(`Klaster [ID: ${cluster.id}] Jest gotowy i zarządza ${cluster.shardList.length} shardami`);
    });
    
    cluster.on('disconnect', () => {
        logger.warn(`Klaster [ID: ${cluster.id}] Został rozłączony od Discord API`);
    });
    
    cluster.on('reconnecting', () => {
        logger.info(`Klaster [ID: ${cluster.id}] Próbuje ponownie połączyć się z Discord API`);
    });
    
    cluster.on('death', () => {
        logger.error(`Klaster [ID: ${cluster.id}] Proces zakończył działanie nieoczekiwanie! Próba restartu...`);
    });
    
    cluster.on('error', error => {
        logger.error(`Klaster [ID: ${cluster.id}] Błąd: ${error.message}`);
        logger.error(`Klaster [ID: ${cluster.id}] Stack: ${error.stack}`);
    });
    
    // Monitorowanie heartbeat
    cluster.on('heartbeat', heartbeat => {
        logger.debug(`Klaster [ID: ${cluster.id}] Heartbeat: ${JSON.stringify(heartbeat)}`);
    });
    
    cluster.on('missingHeartbeat', count => {
        logger.warn(`Klaster [ID: ${cluster.id}] Brakujące heartbeaty: ${count}`);
    });
    
    // Komunikacja z klastrami
    cluster.on('message', message => {
        logger.debug(`Klaster [ID: ${cluster.id}] Wiadomość: ${typeof message === 'object' ? JSON.stringify(message) : message}`);
    });
    
    // Informacje o zasobach
    if (cluster.workerStats) {
        setInterval(() => {
            logger.debug(`Klaster [ID: ${cluster.id}] Użycie pamięci: ${Math.round(cluster.workerStats.rss / 1024 / 1024)}MB`);
        }, 60000); // Co minutę
    }
});

// Monitorowanie procesu głównego
process.on('uncaughtException', error => {
    logger.error(`Nieobsłużony wyjątek w procesie głównym: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Nieobsłużona odrzucona obietnica: ${reason}`);
});

// Uruchomienie klastrów z timeout ustawionym na nieskończoność
logger.info('Rozpoczynanie uruchamiania klastrów...');
manager.spawn({ timeout: -1 })
    .then(clusters => {
        logger.info(`Wszystkie klastry zostały uruchomione. Liczba klastrów: ${clusters.size}`);
        logger.info(`Łączna liczba shardów: ${manager.totalShards}`);
        logger.info(`Szacowana liczba serwerów: ${manager.totalShards * 2500}`); // Szacunkowo 2500 serwerów na shard
        
        // Funkcja okresowego logowania statystyk
        setInterval(() => {
            const clustersInfo = Array.from(manager.clusters.values()).map(c => ({
                id: c.id,
                status: c.ready ? 'gotowy' : 'niegotowy',
                shards: c.shardList.length
            }));
            logger.info(`Status klastrów: ${JSON.stringify(clustersInfo)}`);
        }, 300000); // Co 5 minut
    })
    .catch(error => {
        logger.error(`Krytyczny błąd podczas uruchamiania klastrów: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);
        process.exit(1);
    });

// Dodatkowe metody dla zarządzania z konsoli
process.stdin.on('data', data => {
    const command = data.toString().trim();
    if (command === 'stats') {
        logger.info(`Statystyki managera: ${manager.clusters.size} klastrów, ${manager.totalShards} shardów`);
    } else if (command === 'list') {
        const clustersInfo = Array.from(manager.clusters.values()).map(c => 
            `Klaster ${c.id}: ${c.ready ? 'gotowy' : 'niegotowy'}, Shardy: ${c.shardList.join(', ')}`
        );
        logger.info(`Lista klastrów:\n${clustersInfo.join('\n')}`);
    } else if (command.startsWith('restart ')) {
        const id = parseInt(command.split(' ')[1]);
        if (manager.clusters.has(id)) {
            logger.info(`Ręczny restart klastra ${id}...`);
            manager.clusters.get(id).respawn();
        } else {
            logger.warn(`Nie znaleziono klastra o ID ${id}`);
        }
    }
});

logger.info('Manager gotowy, oczekiwanie na uruchomienie klastrów...');
