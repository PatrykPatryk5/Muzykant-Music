const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Wznów odtwarzanie utworu'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        try {
            await player.resume();
            return interaction.editReply('Odtwarzanie zostało wznowione.');
        } catch (error) {
            console.error('Błąd w komendzie resume:', error);
            return interaction.editReply('Wystąpił błąd podczas wznawiania utworu.');
        }
    },
};
