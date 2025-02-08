require('dotenv').config();
const { ShardingManager } = require('discord.js');
const path = require('path');
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
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

const token = process.env.BOT_TOKEN;

if (!token) {
  logger.error('BOT_TOKEN is not defined. Please check your environment variables.');
  process.exit(1);
}

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: token
});

manager.on('shardCreate', shard => {
  logger.info(`Launched shard ${shard.id}`);
});

manager.spawn().catch(error => {
  logger.error(`Error spawning shards: ${error.message}`);
  process.exit(1);
});
