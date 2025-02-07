const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Zatrzymaj odtwarzanie utworu'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        try {
            await player.pause();
            return interaction.editReply('Utwór został zatrzymany.');
        } catch (error) {
            console.error('Błąd w komendzie pause:', error);
            return interaction.editReply('Wystąpił błąd podczas zatrzymywania utworu.');
        }
    },
};
