const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Pomiń aktualny utwór'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        try {
            await player.skip();
            return interaction.editReply('Pominięto aktualny utwór.');
        } catch (error) {
            console.error('Błąd w komendzie skip:', error);
            return interaction.editReply('Wystąpił błąd podczas pomijania utworu.');
        }
    },
};
