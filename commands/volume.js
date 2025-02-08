const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

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
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        if (!lavalink) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.lavalinkNotInitialized)
                .setDescription(t.errors.initializationError);
            return interaction.editReply({ embeds: [embed] });
        }

        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noActivePlayer)
                .setDescription(t.errors.noPlayer);
            return interaction.editReply({ embeds: [embed] });
        }

        const level = interaction.options.getInteger('level');

        try {
            if (!level) {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.volumeCommand.currentVolume)
                    .setDescription(`${t.volumeCommand.currentVolumeLevel}: ${player.volume}`);
                return interaction.editReply({ embeds: [embed] });
            }
            if (level < 1 || level > 200) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(t.errors.invalidVolume)
                    .setDescription(t.errors.volumeRange);
                return interaction.editReply({ embeds: [embed] });
            }
            await player.setVolume(level);
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.volumeSet)
                .setDescription(`${t.success.newVolume}: ${level}`);
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in volume command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.volumeCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    }
};