const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Zatrzymaj odtwarzanie i wyczyść kolejkę'),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        try {
            player.queue.clear();
            await player.stop();
            await player.disconnect();
            return interaction.editReply('Odtwarzanie zatrzymane i kolejka wyczyszczona.');
        } catch (error) {
            console.error('Błąd w komendzie stop:', error);
            return interaction.editReply('Wystąpił błąd podczas zatrzymywania odtwarzania.');
        }
    },
};
