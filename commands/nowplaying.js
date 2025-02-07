const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Wyświetl aktualnie odtwarzany utwór'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player || !player.playing) {
            return interaction.editReply('Aktualnie nie odtwarzam żadnego utworu.');
        }
        try {
            const current = player.queue.current;
            return interaction.editReply(`Aktualnie odtwarzany utwór: **${current.info.title}**`);
        } catch (error) {
            console.error('Błąd w komendzie nowplaying:', error);
            return interaction.editReply('Wystąpił błąd podczas pobierania informacji o utworze.');
        }
    },
};
