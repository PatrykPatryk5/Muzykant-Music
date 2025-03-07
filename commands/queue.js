const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Wyświetl obecną kolejkę utworów'),
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

        const queue = player.queue;
        if (!queue.tracks.length) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.emptyQueue)
                .setDescription(t.errors.noTracks);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const queueMessage = queue.tracks
                .map((track, index) => `${index + 1}. ${track.info.title}`)
                .join('\n');
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.queueCommand.currentQueue)
                .setDescription(queueMessage);
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in queue command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.queueCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};