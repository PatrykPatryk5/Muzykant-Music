const { ShardingManager } = require('discord.js');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const winston = require('winston');

// Initialize logger
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

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token: process.env.BOT_TOKEN,
    totalShards: 'auto'
});

manager.on('shardCreate', shard => {
    logger.info(`Wystartowano shard o ID: ${shard.id}`);
    shard.on('death', process => {
        logger.error(`Shard ${shard.id} zakończył się z kodem wyjścia ${process.exitCode}`);
    });

    shard.on('disconnect', () => {
        logger.warn(`Shard ${shard.id} został rozłączony`);
    });

    shard.on('reconnecting', () => {
        logger.info(`Shard ${shard.id} próbuje ponownie połączyć`);
    });

    shard.on('ready', () => {
        logger.info(`Shard ${shard.id} jest gotowy`);
    });

    shard.on('error', error => {
        logger.error(`Shard ${shard.id} napotkał błąd: ${error.message}`);
    });
});

manager.spawn().catch(error => {
    logger.error(`Błąd podczas uruchamiania shardów: ${error.message}`);
    process.exit(1);
});