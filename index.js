require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

// Kolekcja komend
client.commands = new Collection();

// Ładowanie komend z folderu commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    client.commands.set(command.data.name, command);
  } catch (error) {
    logger.error(`Błąd podczas ładowania komendy z pliku ${file}: ${error.message}`);
  }
}

// Inicjalizacja menedżera Lavalink
const nodes = [
  {
    id: 'main',
    host: process.env.LAVALINK_HOST || 'lavalink_v4.muzykant.xyz',
    port: Number(process.env.LAVALINK_PORT) || 443,
    authorization: process.env.LAVALINK_PASSWORD || 'https://discord.gg/v6sdrD9kPh',
    secure: true // Ustaw na false, jeśli nie korzystasz z TLS (https)
  }
];

// Globalne handler błędów
process.on('unhandledRejection', error => {
  logger.error(`Unhandled promise rejection: ${error.message}`, error);
});

process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error.message}`, error);
});

// Reconnect logic for Lavalink nodes
const reconnectNode = (node) => {
  logger.warn(`Attempting to reconnect node ${node.id} in 5 seconds...`);
  setTimeout(() => {
    node.connect().catch(e => logger.error(`Failed to reconnect node ${node.id}: ${e.message}`, e));
  }, 5000);
};

// Inicjalizacja menedżera po gotowości klienta
client.once('ready', () => {
  logger.info(`Zalogowano jako ${client.user.tag}`);
  client.lavalink = new LavalinkManager({
    nodes,
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    autoSkip: true,
    client: {
      id: client.user.id,
      username: client.user.username,
    },
  });

  client.lavalink.init(client.user)
    .then(() => {
      logger.info('Lavalink manager zainicjalizowany.');

      // Przekazywanie surowych eventów do menedżera
      client.on('raw', data => client.lavalink.sendRawData(data));

      // Obsługa zdarzeń node'ów
      client.lavalink.on('nodeError', (node, error) => {
        logger.error(`Błąd węzła ${node.id}: ${error.message}`, error);
        reconnectNode(node);
      });

      client.lavalink.on('nodeDisconnect', (node, reason) => {
        logger.warn(`Węzeł ${node.id} rozłączony. Powód: ${reason}`);
        reconnectNode(node);
      });

      client.lavalink.on('nodeConnected', (node) => {
        logger.info(`Węzeł ${node.id} połączony.`);
      });

    })
    .catch(error => logger.error(`Błąd inicjalizacji Lavalink managera: ${error.message}`, error));
});

// Obsługa interakcji – komendy slash
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return interaction.reply({ content: 'Nieznana komenda!', ephemeral: true });
  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Błąd przy wykonywaniu komendy ${interaction.commandName}: ${error.message}`, error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('Wystąpił błąd podczas wykonywania komendy.');
    } else {
      await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania komendy.', ephemeral: true });
    }
  }
});

// Logowanie klienta
client.login(process.env.BOT_TOKEN).then(() => {
  logger.info('Klient zalogowany.');
}).catch(error => {
  logger.error(`Błąd logowania klienta: ${error.message}`, error);
  process.exit(1);
});

module.exports = client;
