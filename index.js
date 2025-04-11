require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const winston = require('winston');
const { ClusterClient, getInfo } = require('discord-hybrid-sharding');
const colors = require('colors/safe');

// Ulepszony system logowania z kolorowymi komunikatami w konsoli
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => {
      const baseMsg = `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
      // Dodajemy dane stosu dla błędów, jeśli są dostępne
      if (info.stack) {
        return `${baseMsg}\n${info.stack}`;
      }
      return baseMsg;
    })
  ),
  transports: [
    // Formatowanie konsoli z kolorami
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => {
          let prefix = '';
          switch(info.level) {
            case 'error': prefix = colors.red('[ERROR]'); break;
            case 'warn': prefix = colors.yellow('[WARN]'); break;
            case 'info': prefix = colors.green('[INFO]'); break;
            case 'debug': prefix = colors.blue('[DEBUG]'); break;
            default: prefix = `[${info.level.toUpperCase()}]`;
          }
          const baseMsg = `${prefix} [${colors.cyan(info.timestamp)}]: ${info.message}`;
          if (info.stack) {
            return `${baseMsg}\n${colors.gray(info.stack)}`;
          }
          return baseMsg;
        })
      )
    }),
    // Zapis do pliku z rotacją logów
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  ],
  // Dodajemy obsługę wyjątków, aby zapobiec crashom przy błędach logowania
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Tworzenie katalogu logs, jeśli nie istnieje
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
  logger.info('Utworzono katalog logs');
}

// Ulepszony klient Discord.js z dodatkową metryką
const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
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
  // Dodajemy więcej opcji dla lepszej wydajności
  failIfNotExists: false,
  allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
  presence: {
    activities: [{ name: 'Uruchamianie...', type: ActivityType.Playing }],
    status: 'dnd'
  },
  rest: { timeout: 15000 } // Zwiększamy timeout dla zapytań API
});

// Dodajemy Mapy i Kolekcje dla komend i innych danych
client.commands = new Collection();
client.cooldowns = new Collection();
client.metrics = {
  commandsUsed: 0,
  startTime: Date.now(),
  errors: 0,
  lastRestartTime: Date.now(),
  totalPlays: 0,
  activeVoiceConnections: 0
};

// Funkcja do rekursywnego ładowania komend z podfolderów
async function loadCommands(directory) {
  let commandsLoaded = 0;
  const folders = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const item of folders) {
    const fullPath = path.join(directory, item.name);
    
    if (item.isDirectory()) {
      // Rekursywne ładowanie z podfolderów
      commandsLoaded += await loadCommands(fullPath);
    } else if (item.name.endsWith('.js')) {
      try {
        delete require.cache[require.resolve(fullPath)]; // Czyszczenie cache modułu dla gorącego przeładowania
        const command = require(fullPath);
        // Sprawdzenie wymaganych pól komendy z bardziej szczegółową diagnostyką
        if (!command.data) {
          logger.warn(`Komenda w pliku ${fullPath} nie zawiera wymaganej właściwości 'data'`);
          continue;
        }
        if (!command.execute) {
          logger.warn(`Komenda w pliku ${fullPath} nie zawiera wymaganej metody 'execute'`);
          continue;
        }
        
        client.commands.set(command.data.name, command);
        logger.debug(`Załadowano komendę: ${command.data.name} z pliku ${item.name}`);
        commandsLoaded++;
      } catch (error) {
        logger.error(`Błąd podczas ładowania komendy z pliku ${fullPath}`, { stack: error.stack });
      }
    }
  }
  
  return commandsLoaded;
}

// Funkcja do inicjalizacji bota
async function initializeBot() {
  logger.info('Rozpoczynanie inicjalizacji bota...');
  
  // Ładowanie komend
  const commandsPath = path.join(__dirname, 'commands');
  try {
    if (fs.existsSync(commandsPath)) {
      const commandCount = await loadCommands(commandsPath);
      logger.info(`Załadowano pomyślnie ${commandCount} komend`);
    } else {
      logger.warn(`Katalog komend nie istnieje: ${commandsPath}`);
      fs.mkdirSync(commandsPath, { recursive: true });
      logger.info(`Utworzono katalog komend: ${commandsPath}`);
    }
  } catch (error) {
    logger.error('Wystąpił błąd podczas ładowania komend', { stack: error.stack });
  }
  
  // Konfiguracja Lavalink
  const nodes = [];
  
  // Podstawowy węzeł
  nodes.push({
    id: 'main',
    host: process.env.LAVALINK_HOST || 'lavalink_v4.muzykant.xyz',
    port: Number(process.env.LAVALINK_PORT) || 443,
    authorization: process.env.LAVALINK_PASSWORD || 'https://discord.gg/v6sdrD9kPh',
    secure: process.env.LAVALINK_SECURE !== 'false'
  });
  
  logger.debug(`Skonfigurowano ${nodes.length} węzłów Lavalink`);
  
  return nodes;
}

// Ulepszona funkcja reconnectu z wykładniczym opóźnieniem
let reconnectAttempts = {};
const reconnectNode = async (node) => {
  const nodeId = node.id;
  if (!reconnectAttempts[nodeId]) reconnectAttempts[nodeId] = 0;
  reconnectAttempts[nodeId]++;
  
  // Wykładnicze opóźnienie z maksymalnym limitem 5 minut
  const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts[nodeId] - 1), 300000);
  
  logger.warn(`Próba ponownego połączenia z węzłem ${nodeId} za ${Math.round(delay/1000)}s (próba #${reconnectAttempts[nodeId]})`);
  
  setTimeout(async () => {
    try {
      logger.debug(`Rozpoczynanie próby połączenia z węzłem ${nodeId}...`);
      await node.connect();
      logger.info(`Pomyślnie ponownie połączono z węzłem ${nodeId}`);
      reconnectAttempts[nodeId] = 0; // Reset licznika po sukcesie
    } catch (error) {
      logger.error(`Nieudana próba ponownego połączenia z węzłem ${nodeId}`, { stack: error.stack });
      // Rekurencyjne wywołanie, ale z kontrolą maksymalnej liczby prób
      if (reconnectAttempts[nodeId] < 10) {
        reconnectNode(node);
      } else {
        logger.error(`Przekroczono maksymalną liczbę prób połączenia z węzłem ${nodeId}. Zrezygnowano z prób.`);
        // Opcjonalnie: zresetuj licznik po jakimś czasie
        setTimeout(() => { reconnectAttempts[nodeId] = 0; }, 600000); // po 10 minutach
      }
    }
  }, delay);
};

// Funkcje dla rozszerzonych statusów bota
const botStatuses = [
  () => ({ name: `/help | ${client.guilds.cache.size} serwerów`, type: ActivityType.Listening }),
  () => ({ name: `muzykę dla ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} użytkowników`, type: ActivityType.Playing }),
  () => ({ name: `${client.metrics.commandsUsed} użytych komend`, type: ActivityType.Watching }),
  () => ({ name: `${client.metrics.activeVoiceConnections} aktywnych kanałów głosowych`, type: ActivityType.Streaming, url: 'https://www.twitch.tv/directory/category/music' }),
  () => ({ name: `${formatTime(Math.floor((Date.now() - client.metrics.startTime) / 1000))} uptime`, type: ActivityType.Competing })
];

// Funkcja do aktualizacji statusu bota
function updateBotStatus() {
  try {
    const statusIndex = Math.floor(Math.random() * botStatuses.length);
    const newStatus = botStatuses[statusIndex]();
    
    client.user.setPresence({
      activities: [newStatus],
      status: 'online'
    });
    
    logger.debug(`Zaktualizowano status bota: ${newStatus.type} "${newStatus.name}"`);
  } catch (error) {
    logger.error('Błąd podczas aktualizacji statusu bota', { stack: error.stack });
  }
}

// Globalny handler błędów z ulepszoną diagnostyką
process.on('unhandledRejection', (reason, promise) => {
  client.metrics.errors++;
  logger.error(`Nieobsłużona obietnica została odrzucona`, { 
    stack: reason instanceof Error ? reason.stack : String(reason),
    reason: String(reason)
  });
  
  // Dodatkowa diagnostyka dla Promise
  try {
    promise.catch(error => {
      logger.debug(`Dodatkowe informacje o odrzuconej obietnicy: ${error}`);
    });
  } catch (e) {
    // Ignorujemy błędy podczas próby uzyskania więcej informacji
  }
});

process.on('uncaughtException', (error) => {
  client.metrics.errors++;
  logger.error(`Nieobsłużony wyjątek`, { stack: error.stack });
  // W produkcji możemy chcieć zrestartować bota po ciężkim błędzie
  if (process.env.NODE_ENV === 'production') {
    logger.fatal('Krytyczny błąd - bot zostanie zamknięty za 3 sekundy...');
    setTimeout(() => process.exit(1), 3000);
  }
});

// Rozbudowane zdarzenie 'ready'
client.once('ready', async () => {
  const guildsCount = client.guilds.cache.size;
  const usersCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  logger.info('==================================================');
  logger.info(`BOT MUZYCZNY - URUCHOMIONY POMYŚLNIE`);
  logger.info('==================================================');
  logger.info(`Bot został uruchomiony jako: ${client.user.tag} (ID: ${client.user.id})`);
  logger.info(`Obsługuję ${guildsCount} serwerów z łącznie ~${usersCount} użytkownikami`);
  logger.info(`Działa na Node.js ${process.version} | Discord.js v${require('discord.js').version}`);
  logger.info(`Shard ID: ${client.shard?.ids[0] || 0} z ${getInfo().TOTAL_SHARDS}`);
  logger.info(`Załadowanych komend: ${client.commands.size}`);
  logger.info(`Użycie pamięci: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
  logger.info(`Użycie CPU: ${Math.round((cpuUsage.user + cpuUsage.system) / 1000)} ms`);
  logger.info(`System operacyjny: ${process.platform} ${process.arch}`);
  logger.info(`Wersja Discord API: ${client.options.ws.version}`);
  logger.info(`Data i czas uruchomienia: ${new Date().toLocaleString()}`);
  logger.info('==================================================');
  
  // Natychmiastowa aktualizacja statusu
  updateBotStatus();
  
  // Inicjalizacja LavalinkManager z ulepszoną obsługą błędów
  try {
    const nodes = await initializeBot();
    
    client.lavalink = new LavalinkManager({
      nodes,
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild?.shard) {
          return guild.shard.send(payload);
        } else {
          logger.warn(`Nie można wysłać danych Lavalink do nieprawidłowego serwera: ${guildId}`);
          return false;
        }
      },
      autoSkip: true,
      client: {
        id: client.user.id,
        username: client.user.username,
      },
      devOptions: {
        noAudio: process.env.NODE_ENV === 'development' && process.env.NO_AUDIO === 'true',
        debug: process.env.DEBUG_LAVALINK === 'true'
      }
    });

    await client.lavalink.init(client.user);
    logger.info('Pomyślnie zainicjalizowano menedżera Lavalink');

    // Przekazywanie surowych eventów z obsługą błędów
    client.on('raw', (data) => {
      try {
        client.lavalink.sendRawData(data);
      } catch (error) {
        logger.debug(`Błąd podczas przetwarzania danych surowego eventu: ${error.message}`);
      }
    });

    // Rozbudowane listenery dla węzłów Lavalink
    client.lavalink.on('nodeError', (node, error) => {
      logger.error(`Błąd węzła Lavalink ${node.id}: ${error.message}`, { stack: error.stack });
      reconnectNode(node);
    });

    client.lavalink.on('nodeDisconnect', (node, reason) => {
      logger.warn(`Węzeł Lavalink ${node.id} rozłączony. Powód: ${reason}`);
      reconnectNode(node);
    });

    client.lavalink.on('nodeConnect', (node) => {
      logger.info(`Węzeł Lavalink ${node.id} połączony pomyślnie! (v${node.version || 'nieznana'})`);
    });
    
    // Dodatkowe zdarzenia Lavalink dla lepszej diagnostyki
    client.lavalink.on('trackError', (player, track, error) => {
      logger.error(`Błąd odtwarzania utworu na serwerze ${player.guildId}: ${error.message}`);
      
      // Próba automatycznego naprawienia problemu
      try {
        const queue = player.queue;
        if (queue && queue.current) {
          logger.info(`Próba odtworzenia następnego utworu po błędzie na serwerze ${player.guildId}`);
          player.skip().catch(e => logger.error(`Nie można pominąć utworu po błędzie: ${e.message}`));
        }
      } catch (skipError) {
        logger.error(`Błąd podczas próby naprawy odtwarzacza: ${skipError.message}`);
      }
    });
    
    client.lavalink.on('playerCreate', (player) => {
      client.metrics.activeVoiceConnections++;
      logger.debug(`Utworzono nowy odtwarzacz dla serwera ${player.guildId} (Aktywne połączenia: ${client.metrics.activeVoiceConnections})`);
    });
    
    client.lavalink.on('playerDestroy', (player) => {
      client.metrics.activeVoiceConnections = Math.max(0, client.metrics.activeVoiceConnections - 1);
      logger.debug(`Zniszczono odtwarzacz dla serwera ${player.guildId} (Aktywne połączenia: ${client.metrics.activeVoiceConnections})`);
    });
    
    client.lavalink.on('trackStart', (player, track) => {
      client.metrics.totalPlays++;
      logger.debug(`Rozpoczęto odtwarzanie "${track.title}" na serwerze ${player.guildId} (Łącznie: ${client.metrics.totalPlays})`);
    });

  } catch (error) {
    logger.error(`Krytyczny błąd podczas inicjalizacji Lavalink:`, { stack: error.stack });
  }
  
  // Uruchomienie systemu automatycznego odświeżania statusu (co 15 min)
  setInterval(() => {
    updateBotStatus();
  }, 15 * 60 * 1000);
  
  // Okresowy zapis metryk z bardziej szczegółowymi informacjami
  setInterval(() => {
    const uptime = Math.floor((Date.now() - client.metrics.startTime) / 1000);
    const memoryUsage = process.memoryUsage();
    
    logger.info(`=== STATYSTYKI BOTA ===`);
    logger.info(`Uptime: ${formatTime(uptime)}`);
    logger.info(`Użytych komend: ${client.metrics.commandsUsed}`);
    logger.info(`Błędów: ${client.metrics.errors}`);
    logger.info(`Aktywne połączenia głosowe: ${client.metrics.activeVoiceConnections}`);
    logger.info(`Odtworzone utwory: ${client.metrics.totalPlays}`);
    logger.info(`Obsługiwane serwery: ${client.guilds.cache.size}`);
    logger.info(`Użycie RAM: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
    logger.info(`Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`);
    logger.info(`Aktywne węzły Lavalink: ${client.lavalink?.getActiveNodes().length || 0}`);
    logger.info(`======================`);
  }, 30 * 60 * 1000); // co 30 minut
  
  // Dodatkowy monitoring wydajności i zużycia zasobów
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    // Sprawdzanie zużycia pamięci i ostrzeganie przy wysokim zużyciu
    if (memoryUsage.rss > 1000 * 1024 * 1024) { // 1GB
      logger.warn(`Wysokie użycie pamięci: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
    }
    
    // Zapisywanie szczegółowych metryk wydajności
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`Zużycie zasobów: RAM ${Math.round(memoryUsage.rss / 1024 / 1024)} MB, Heap ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB, External ${Math.round(memoryUsage.external / 1024 / 1024)} MB`);
    }
  }, 5 * 60 * 1000); // co 5 minut
});

// Obsługa interakcji z ulepszoną obsługą błędów i metrykami
client.on('interactionCreate', async (interaction) => {
  // Ignorujemy interakcje od botów
  if (interaction.user.bot) return;
  
  // Bardziej szczegółowe logowanie interakcji w trybie debug
  logger.debug(`Odebrano interakcję ${interaction.type} od ${interaction.user.tag} (${interaction.user.id}) w ${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'DM'})`);
  
  if (!interaction.isCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  
  if (!command) {
    logger.warn(`Próba użycia nieistniejącej komendy ${interaction.commandName} przez ${interaction.user.tag}`);
    return interaction.reply({ 
      content: 'Ta komenda nie istnieje lub została wyłączona.', 
      ephemeral: true 
    }).catch(error => {
      logger.error(`Nie można odpowiedzieć na interakcję z nieistniejącą komendą: ${error.message}`);
    });
  }
  
  // System cooldownów dla komend z dodatkowymi informacjami diagnostycznymi
  if (command.cooldown) {
    const cooldownTime = command.cooldown * 1000;
    const cooldownKey = `${interaction.user.id}-${command.data.name}`;
    
    if (client.cooldowns.has(cooldownKey)) {
      const expirationTime = client.cooldowns.get(cooldownKey) + cooldownTime;
      const timeLeft = (expirationTime - Date.now()) / 1000;
      
      if (Date.now() < expirationTime) {
        logger.debug(`Cooldown aktywny dla ${interaction.user.tag} na komendzie ${command.data.name} (pozostało ${timeLeft.toFixed(1)}s)`);
        return interaction.reply({
          content: `Musisz poczekać jeszcze ${timeLeft.toFixed(1)} sekund przed ponownym użyciem komendy \`${command.data.name}\`.`,
          ephemeral: true
        }).catch(error => {
          logger.error(`Nie można odpowiedzieć na interakcję z cooldownem: ${error.message}`);
        });
      }
    }
    
    client.cooldowns.set(cooldownKey, Date.now());
    setTimeout(() => client.cooldowns.delete(cooldownKey), cooldownTime);
  }
  
  // Wykonanie komendy z pełną obsługą błędów i ulepszoną synchronizacją
  try {
    // Aktualizacja metryki i szczegółowe logowanie
    client.metrics.commandsUsed++;
    const startTime = process.hrtime();
    
    // Logowanie użycia komendy
    logger.info(`Użytkownik ${interaction.user.tag} (${interaction.user.id}) użył komendy /${interaction.commandName} na serwerze ${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'DM'})`);
    
    // Sprawdzenie uprawnień - czy bot ma wymagane uprawnienia w kanale
    if (interaction.guild) {
      const botPermissions = interaction.channel.permissionsFor(client.user.id);
      const requiredPermissions = ['SendMessages', 'ViewChannel', 'EmbedLinks'];
      
      if (command.requiredPermissions) {
        requiredPermissions.push(...command.requiredPermissions);
      }
      
      const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));
      
      if (missingPermissions.length > 0) {
        logger.warn(`Brak wymaganych uprawnień (${missingPermissions.join(', ')}) dla komendy ${interaction.commandName} na kanale ${interaction.channel.name}`);
        return interaction.reply({
          content: `Nie mam wymaganych uprawnień do wykonania tej komendy. Brakuje: \`${missingPermissions.join(', ')}\``,
          ephemeral: true
        });
      }
    }
    
    // Jeśli komenda wymaga połączenia z węzłem Lavalink, sprawdzamy jego stan
    if (command.requiresLavalink) {
      const activeNodes = client.lavalink?.getActiveNodes() || [];
      if (!activeNodes.length) {
        logger.warn(`Próba użycia komendy muzycznej ${interaction.commandName} bez aktywnych węzłów Lavalink`);
        return interaction.reply({
          content: 'Usługa muzyczna jest obecnie niedostępna. Spróbuj ponownie za chwilę.',
          ephemeral: true
        });
      }
    }
    
    // Wykonanie komendy z mierzeniem czasu wykonania
    await Promise.resolve(command.execute(interaction, client));
    
    // Mierzymy czas wykonania komendy
    const endTime = process.hrtime(startTime);
    const executionTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
    logger.debug(`Komenda ${interaction.commandName} wykonana w ${executionTime}ms`);
    
  } catch (error) {
    client.metrics.errors++;
    logger.error(`Błąd przy wykonywaniu komendy ${interaction.commandName}:`, { stack: error.stack });
    
    // Różne typy odpowiedzi w zależności od stanu interakcji z dodatkową obsługą błędów
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: 'Wystąpił błąd podczas wykonywania tej komendy. Nasi programiści zostali powiadomieni.',
          components: [] // Usuwamy wszystkie komponenty, jeśli były
        }).catch(e => logger.error(`Nie można edytować odpowiedzi po błędzie: ${e.message}`));
      } else {
        await interaction.reply({
          content: 'Wystąpił błąd podczas wykonywania tej komendy. Nasi programiści zostali powiadomieni.',
          ephemeral: true
        }).catch(e => logger.error(`Nie można odpowiedzieć po błędzie: ${e.message}`));
      }
    } catch (replyError) {
      logger.error(`Nie można odpowiedzieć na interakcję po błędzie: ${replyError.message}`);
    }
    
    // Dodatkowa analityka błędów
    if (process.env.NODE_ENV === 'development') {
      console.error('Szczegóły błędu:', error);
    }
  }
});

// Rozbudowana obsługa wzmianek z informacjami o systemie i bocie
client.on('messageCreate', async (message) => {
  // Ignorujemy wiadomości od botów
  if (message.author.bot) return;
  
  const botMention = `<@${client.user.id}>`;
  const mentionWithNickname = `<@!${client.user.id}>`;
  
  if (message.content.trim() === botMention || message.content.trim() === mentionWithNickname) {
    try {
      logger.debug(`Użytkownik ${message.author.tag} wspomniał bota na serwerze ${message.guild?.name || 'DM'}`);
      
      if (message.guild && !message.channel.permissionsFor(client.user.id).has('SendMessages')) {
        logger.warn(`Brak uprawnień do wysyłania wiadomości na kanale ${message.channel.name} (${message.channel.id})`);
        return;
      }
  
      const serverCount = client.guilds.cache.size;
      const uptimeSeconds = Math.floor((Date.now() - client.metrics.startTime) / 1000);
      const memoryUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const activeNodes = client.lavalink?.getActiveNodes().length || 0;
  
      await message.reply({
        content: `👋 Cześć ${message.author}! Jestem zaawansowanym botem muzycznym opartym na Lavalink!\n\n` +
                 `🎵 Użyj \`/help\` aby zobaczyć dostępne komendy muzyczne.\n` +
                 `📊 Statystyki: ${serverCount} serwerów | ${client.metrics.totalPlays} odtworzonych utworów\n` + 
                 `🎧 Aktywne kanały głosowe: ${client.metrics.activeVoiceConnections} | Węzły Lavalink: ${activeNodes}\n` +
                 `⚙️ Zużycie RAM: ${memoryUsage} MB | ⏱️ Uptime: ${formatTime(uptimeSeconds)}`,
        allowedMentions: { repliedUser: true }
      });
  
    } catch (error) {
      logger.error(`Błąd podczas odpowiadania na wzmiankę: ${error.message}`, { stack: error.stack });
    }
  }
});
client.on('messageCreate', async (message) => { // Add `async` here
    // Ignorujemy wiadomości od botów
    if (message.author.bot) return;
  
    const prefix = process.env.PREFIX || '=';
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
  
      try {
        // Znajdź komendę albo alias
        const command = client.commands.find(cmd =>
          cmd.data?.name === commandName ||
          (cmd.aliases && cmd.aliases.includes(commandName))
        );
  
        if (!command) return;
  
        logger.debug(`Użytkownik ${message.author.tag} użył prefiksowej komendy ${prefix}${commandName}`);
  
        // Sprawdź czy komenda ma obsługę prefiksową
        if (command.executeMessage) {
          client.metrics.commandsUsed++;
          await command.executeMessage(message, args, client); // This now works because the function is async
        }
      } catch (error) {
        logger.error(`Błąd przy wykonywaniu prefiksowej komendy ${commandName}:`, { stack: error.stack });
      }
    }
  });


// Monitorowanie zmian w serwerach dla aktualizacji metryk
client.on('guildCreate', guild => {
 logger.info(`Bot został dodany do nowego serwera: ${guild.name} (${guild.id}) z ${guild.memberCount} użytkownikami`);
 updateBotStatus();
});

client.on('guildDelete', guild => {
 logger.info(`Bot został usunięty z serwera: ${guild.name} (${guild.id})`);
 updateBotStatus();
});

// Monitorowanie połączeń głosowych
client.on('voiceStateUpdate', (oldState, newState) => {
 try {
   // Bot został rozłączony z kanału głosowego
   if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
     logger.debug(`Bot został rozłączony z kanału głosowego w ${oldState.guild.name}`);
     
     // Zamykamy odtwarzacz Lavalink jeśli istnieje
     const player = client.lavalink?.getPlayer(oldState.guild.id);
     if (player) {
       player.destroy();
       logger.debug(`Zniszczono odtwarzacz dla serwera ${oldState.guild.id} po rozłączeniu`);
     }
   }
   
   // Bot został połączony z kanałem głosowym
   if (newState.member.id === client.user.id && newState.channelId && !oldState.channelId) {
     logger.debug(`Bot został połączony z kanałem głosowym w ${newState.guild.name}`);
   }
   
   // Sprawdź czy bot jest sam na kanale głosowym
   if (oldState.member.id !== client.user.id && oldState.channelId && oldState.channel?.members.has(client.user.id)) {
     const voiceChannel = oldState.channel;
     
     // Jeśli na kanale został tylko bot (i ewentualnie inne boty)
     if (voiceChannel.members.filter(m => !m.user.bot).size === 0) {
       logger.debug(`Bot został sam na kanale głosowym w ${oldState.guild.name} - rozpoczęcie odliczania do rozłączenia`);
       
       // Ustawienie timeout na opuszczenie kanału po 5 minutach samotności
       setTimeout(() => {
         // Sprawdź ponownie czy bot nadal jest sam
         const currentChannel = client.channels.cache.get(voiceChannel.id);
         if (currentChannel && currentChannel.members.filter(m => !m.user.bot).size === 0) {
           const player = client.lavalink?.getPlayer(oldState.guild.id);
           if (player) {
             player.destroy();
             logger.info(`Rozłączono z kanału głosowego w ${oldState.guild.name} po 5 minutach bezczynności`);
           }
         }
       }, 5 * 60 * 1000); // 5 minut
     }
   }
 } catch (error) {
   logger.error(`Błąd podczas obsługi zdarzenia voiceStateUpdate:`, { stack: error.stack });
 }
});

// Funkcja pomocnicza do formatowania czasu
function formatTime(seconds) {
 const days = Math.floor(seconds / 86400);
 seconds %= 86400;
 const hours = Math.floor(seconds / 3600);
 seconds %= 3600;
 const minutes = Math.floor(seconds / 60);
 seconds %= 60;
 
 let result = '';
 if (days > 0) result += `${days}d `;
 if (hours > 0) result += `${hours}h `;
 if (minutes > 0) result += `${minutes}m `;
 result += `${seconds}s`;
 
 return result;
}

// Inicjalizacja klastra i logowanie
client.cluster = new ClusterClient(client);

// Funkcja do sprawdzania połączenia z internetem
async function checkInternetConnection() {
 try {
   const http = require('http');
   return new Promise((resolve) => {
     http.get('http://www.google.com', (res) => {
       resolve(res.statusCode === 200);
     }).on('error', () => {
       resolve(false);
     });
   });
 } catch (error) {
   return false;
 }
}

// Funkcja do inicjowania logowania z retryami
async function loginWithRetry(maxRetries = 5, initialDelay = 5000) {
 let retryCount = 0;
 
 while (retryCount < maxRetries) {
   try {
     // Sprawdź połączenie z internetem przed próbą logowania
     const connected = await checkInternetConnection();
     if (!connected) {
       logger.warn(`Brak połączenia z internetem, oczekiwanie przed próbą logowania (${retryCount + 1}/${maxRetries})...`);
       await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, retryCount)));
       retryCount++;
       continue;
     }
     
     logger.info('Próba logowania do Discord API...');
     await client.login(process.env.BOT_TOKEN);
     logger.info('Bot zalogowany pomyślnie!');
     return true;
   } catch (error) {
     retryCount++;
     const delay = initialDelay * Math.pow(2, retryCount - 1);
     
     if (error.message.includes('TOKEN_INVALID')) {
       logger.fatal(`Nieprawidłowy token bota. Sprawdź BOT_TOKEN w zmiennych środowiskowych.`);
       return false;
     }
     
     logger.error(`Błąd logowania (próba ${retryCount}/${maxRetries}): ${error.message}`, { stack: error.stack });
     
     if (retryCount >= maxRetries) {
       logger.fatal(`Przekroczono maksymalną liczbę prób logowania (${maxRetries}).`);
       return false;
     }
     
     logger.info(`Ponowna próba logowania za ${Math.round(delay/1000)} sekund...`);
     await new Promise(resolve => setTimeout(resolve, delay));
   }
 }
 
 return false;
}

// Zaczynamy inicjalizację w bardziej kontrolowany sposób
(async () => {
 try {
   // Sprawdzamy czy plik .env istnieje
   if (!fs.existsSync('.env')) {
     logger.warn('Plik .env nie istnieje. Utwórz go i ustaw zmienne środowiskowe, szczególnie BOT_TOKEN.');
     console.warn('Przykładowy plik .env:');
     console.warn('BOT_TOKEN=twój_token_discord');
     console.warn('PREFIX=!');
     console.warn('LAVALINK_HOST=lavalink_v4.muzykant.xyz');
     console.warn('LAVALINK_PORT=443');
     console.warn('LAVALINK_PASSWORD=https://discord.gg/v6sdrD9kPh');
     console.warn('LAVALINK_SECURE=true');
     console.warn('LOG_LEVEL=info');
   }
   
   // Sprawdzamy niezbędne zmienne środowiskowe
   if (!process.env.BOT_TOKEN) {
     logger.fatal('Brak zmiennej środowiskowej BOT_TOKEN. Ustaw ją w pliku .env lub w zmiennych środowiskowych.');
     process.exit(1);
   }
   
   // Logowanie do Discorda z obsługą retryów
   const loginSuccess = await loginWithRetry();
   if (!loginSuccess) {
     logger.fatal('Nie udało się zalogować do Discord API po kilku próbach. Sprawdź logi błędów.');
     process.exit(1);
   }
 } catch (error) {
   logger.fatal(`Krytyczny błąd podczas uruchamiania bota:`, { stack: error.stack });
   process.exit(1);
 }
})();

// Eksportujemy klienta dla innych modułów
module.exports = {
 client,
 logger
};
