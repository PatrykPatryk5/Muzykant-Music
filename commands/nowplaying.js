const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

function parseDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function progressBar(current, total, size = 20) {
    const percent = Math.round((current / total) * 100);
    const filledSize = Math.round((size * current) / total);
    const filledBar = '▓'.repeat(filledSize);
    const emptyBar = '░'.repeat(size - filledSize);
    return `${filledBar}${emptyBar} ${percent}%`;
}

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
            const track = player.queue.current;
            const position = player.position;
            const duration = track.info.length || track.info.duration || 0;

            // Generate progress bar
            const progressBarText = progressBar(position, duration);

            // Format time
            const currentTime = parseDuration(position);
            const totalTime = parseDuration(duration);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.nowPlayingCommand.nowPlaying)
                .setDescription(`**${track.info.title}**\n\n${progressBarText}\n\n${currentTime} - ${totalTime}`);
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
