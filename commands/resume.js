const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Wznów odtwarzanie utworu'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noActivePlayer)
                .setDescription(t.errors.noPlayer);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            await player.resume();
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.trackResumed)
                .setDescription(t.success.resumed);
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in resume command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.resumeCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};