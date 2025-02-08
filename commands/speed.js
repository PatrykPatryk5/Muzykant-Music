const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speed')
        .setDescription('Set the speed of the track')
        .addNumberOption(option => 
            option.setName('value')
                .setDescription('Speed value (0.5 - 2.0)')
                .setRequired(true)
                .setMinValue(0.5)
                .setMaxValue(2.0)),
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

        const speed = interaction.options.getNumber('value');
        try {
            await player.filterManager.setSpeed(speed);
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.speedSet)
                .setDescription(`${t.success.speedValue}: **${speed}**`);
            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in speed command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.speedCommandError)
                .setDescription(t.errors.genericError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};