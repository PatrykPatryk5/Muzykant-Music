const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Wyświetl aktualnie odtwarzany utwór'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        await interaction.deferReply();
        const lavalink = interaction.client.lavalink;
        const player = lavalink.getPlayer(interaction.guild.id);
        if (!player || !player.playing) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noTrackPlaying)
                .setDescription(t.errors.notPlaying);
            return interaction.editReply({ embeds: [embed] });
        }
        try {
            const current = player.queue.current;
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.nowPlayingCommand.nowPlaying)
                .setDescription(`**${current.info.title}**`);
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in nowplaying command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.nowPlayingCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};