const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Get the bot\'s latency'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Pong!')
            .addFields(
                { name: t.commands.ping.latency, value: `${sent.createdTimestamp - interaction.createdTimestamp}ms` },
                { name: t.commands.ping.apiLatency, value: `${Math.round(interaction.client.ws.ping)}ms` }
            );
        return interaction.editReply({ content: ' ', embeds: [embed] });
    },
};