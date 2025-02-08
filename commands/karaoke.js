const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('karaoke')
        .setDescription('Enable/disable karaoke effect'),
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
            const enabled = !player.filters.karaoke;
            player.setFilters({ karaoke: enabled ? { level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 } : null });
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Karaoke')
                .setDescription(t.commands.karaoke.enabledMessage.replace('{status}', enabled ? t.enabled : t.disabled));
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in karaoke command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.genericError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};