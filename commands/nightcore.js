const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nightcore')
        .setDescription('Enable/disable nightcore effect'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.players.get(interaction.guild.id);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noActivePlayer)
                .setDescription(t.errors.noPlayer);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const enabled = !player.filters.timescale;
            player.filters.timescale = enabled ? { speed: 1.3, pitch: 1.3, rate: 1.0 } : null;
            await player.setFilters(player.filters);
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Nightcore')
                .setDescription(t.commands.nightcore.enabledMessage.replace('{status}', enabled ? t.enabled : t.disabled));
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in nightcore command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.genericError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};