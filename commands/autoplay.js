const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { autoPlayFunction } = require('../autoPlayFunction');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Enable/disable autoplay'),
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
        if (!player) return interaction.reply({ ephemeral: true, content: t.errors.noTrackPlaying });
        if (player.voiceChannelId !== vcId) return interaction.reply({ ephemeral: true, content: t.errors.joinVoiceChannel });

        try {
            const isAutoplayDisabled = player.get('autoplay_disabled') === true;
            player.set('autoplay_disabled', !isAutoplayDisabled);
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Autoplay')
                .setDescription(t.success.autoplayStatus.replace('{status}', !isAutoplayDisabled ? t.success.enabled : t.success.disabled));

            // Trigger autoplay function
            const lastPlayedTrack = player.queue.previous[player.queue.previous.length - 1];
            await autoPlayFunction(player, lastPlayedTrack);

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in autoplay command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.autoplayCommandError)
                .setDescription(t.errors.genericError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};