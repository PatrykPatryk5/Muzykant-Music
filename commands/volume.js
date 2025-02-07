const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Ustaw lub wyświetl głośność odtwarzacza')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Nowa wartość głośności (1-200)')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        if (!lavalink) return interaction.editReply('Lavalink nie został zainicjalizowany.');

        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) return interaction.editReply('Brak aktywnego odtwarzacza.');

        const level = interaction.options.getInteger('level');

        try {
            if (!level) {
                return interaction.editReply(`Aktualna głośność to ${player.volume}.`);
            }
            if (level < 1 || level > 200) {
                return interaction.editReply('Głośność musi być pomiędzy 1 a 200.');
            }
            await player.setVolume(level);
            return interaction.editReply(`Głośność ustawiona na ${level}.`);
        } catch (error) {
            console.error('Błąd w komendzie volume:', error);
            return interaction.editReply('Wystąpił błąd podczas zmiany głośności.');
        }
    }
};
