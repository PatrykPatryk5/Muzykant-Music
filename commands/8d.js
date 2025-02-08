const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8d')
        .setDescription('Toggle 8D audio effect'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        const guildId = interaction.guildId;
        if (!guildId) return;

        const lavalink = interaction.client.lavalink;
        if (!lavalink) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.lavalinkNotInitialized)
                .setDescription(t.errors.initializationError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const player = lavalink.getPlayer(guildId);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noTrackPlaying)
                .setDescription(t.errors.notPlaying);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const filterEnabled = player.filterManager.filters.rotation;
        try {
            if (filterEnabled) {
                await player.filterManager.toggleRotation();
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.success['8dDisabled']);
                return interaction.reply({ embeds: [embed] });
            } else {
                await player.filterManager.toggleRotation(0.2);
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.success['8dEnabled']);
                return interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in 8d command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors['8dCommandError'])
                .setDescription(t.errors.genericError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};