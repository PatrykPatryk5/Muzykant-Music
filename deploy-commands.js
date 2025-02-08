require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Initialize logger
const winston = require('winston');
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
        new winston.transports.File({ filename: 'registerCommands.log' })
    ]
});

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
let commandFiles;

try {
    commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
} catch (error) {
    logger.error(`Błąd podczas odczytu plików z komendami: ${error.message}`);
    process.exit(1);
}

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        commands.push(command.data.toJSON());
    } catch (error) {
        logger.error(`Błąd podczas ładowania komendy z pliku ${file}: ${error.message}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        logger.info('Rozpoczynanie rejestracji komend slash.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        logger.info('Komendy slash zostały zarejestrowane.');
    } catch (error) {
        if (error.response) {
            logger.error(`Błąd odpowiedzi API przy rejestracji komend: ${error.response.status} ${error.response.statusText}`);
            logger.error(`Szczegóły błędu: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            logger.error('Brak odpowiedzi API przy rejestracji komend.');
            logger.error(`Szczegóły błędu: ${error.message}`);
        } else {
            logger.error(`Błąd przy rejestracji komend: ${error.message}`);
        }
    } finally {
        process.exit(0);
    }
})();
