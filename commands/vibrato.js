const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vibrato')
        .setDescription('Toggle Vibrato filter'),
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

        const vcId = interaction.member?.voice?.channelId;
        if (!vcId) return interaction.reply({ ephemeral: true, content: t.errors.joinVoiceChannel });

        const player = lavalink.getPlayer(guildId);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noTrackPlaying)
                .setDescription(t.errors.notPlaying);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (player.voiceChannelId !== vcId) return interaction.reply({ ephemeral: true, content: t.errors.joinVoiceChannel });

        try {
            await player.filterManager.toggleVibrato();
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(player.filterManager.filters.vibrato ? t.success.vibratoEnabled : t.success.vibratoDisabled);
            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in vibrato command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.vibratoCommandError)
                .setDescription(t.errors.genericError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};