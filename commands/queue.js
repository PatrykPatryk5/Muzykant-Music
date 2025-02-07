const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Wyświetl obecną kolejkę utworów'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        const queue = player.queue;
        if (!queue.tracks.length) {
            return interaction.editReply('Kolejka jest pusta.');
        }

        try {
            const queueMessage = queue.tracks
                .map((track, index) => `${index + 1}. ${track.info.title}`)
                .join('\n');
            return interaction.editReply(`**Obecna kolejka:**\n${queueMessage}`);
        } catch (error) {
            console.error('Błąd w komendzie queue:', error);
            return interaction.editReply('Wystąpił błąd podczas pobierania kolejki.');
        }
    },
};
