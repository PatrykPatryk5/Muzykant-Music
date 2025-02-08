const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Zatrzymaj odtwarzanie i wyczyść kolejkę'),
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
            // Use the correct stopPlaying method with clearQueue=true and executeAutoplay=false
            await player.stopPlaying(true, false);
            await player.disconnect();

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.playbackStopped)
                .setDescription(t.success.queueCleared);
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in stop command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.stopCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
