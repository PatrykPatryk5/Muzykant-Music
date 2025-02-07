const { LavalinkManager } = require('lavalink-client');

module.exports = (client) => {
    // Konfiguracja node'a – upewnij się, że dane (host, port, authorization) są prawidłowe.
    const nodes = [
        {
            id: "main",
            host: process.env.LAVALINK_HOST || "lavalink_v4.muzykant.xyz",
            port: Number(process.env.LAVALINK_PORT) || 443,
            // Upewnij się, że authorization to prawidłowy token, np. "localhoist" lub inny właściwy ciąg znaków.
            authorization: process.env.LAVALINK_PASSWORD || "https://discord.gg/v6sdrD9kPh",
            secure: true // Ustaw na false, jeśli nie korzystasz z TLS (https)
        }
    ];

    // Inicjalizacja menedżera Lavalinka – zgodnie z dokumentacją.
    client.lavalink = new LavalinkManager({
        nodes,
        sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
        autoSkip: true,
        client: {
            id: client.user.id,
            username: client.user.username,
        },
    });

    // Przekazywanie surowych eventów do managera
    client.on("raw", data => client.lavalink.sendRawData(data));

    // Obsługa zdarzeń node'ów
    client.lavalink.on("nodeError", (node, error) => {
        console.error(`Błąd węzła ${node.id}:`, error);
    });

    client.lavalink.on("nodeDisconnect", (node, reason) => {
        console.warn(`Węzeł ${node.id} rozłączony. Powód: ${reason}. Próba ponownego połączenia za 5 sekund...`);
        setTimeout(() => {
            node.connect().catch(e => console.error(`Nie udało się ponownie połączyć węzła ${node.id}:`, e));
        }, 5000);
    });

    client.lavalink.on("nodeConnected", (node) => {
        console.log(`Węzeł ${node.id} połączony.`);
    });

    // Inicjalizacja menedżera po gotowości klienta
    client.on("ready", () => {
        client.lavalink.init(client.user)
            .then(() => console.log("Lavalink manager zainicjalizowany."))
            .catch(error => console.error("Błąd inicjalizacji Lavalink managera:", error));
    });
};
