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
            const currentPosition = player.position;
            const trackDuration = current.info.length;

            // Generate progress bar
            const progressBar = progressBar(currentPosition, trackDuration);

            // Format time
            const currentTime = formatTime(currentPosition);
            const totalTime = formatTime(trackDuration);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.nowPlayingCommand.nowPlaying)
                .setDescription(`**${current.info.title}**\n\n${progressBar}\n\n${currentTime} - ${totalTime}`);
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

function parseTime(string) {
    const time = string.match(/(\d+[dhms])/g);
    if (!time) return 0;
    let ms = 0;
    for (const t of time) {
        const unit = t[t.length - 1];
        const amount = Number(t.slice(0, -1));
        if (unit === 'd') ms += amount * 24 * 60 * 60 * 1000;
        else if (unit === 'h') ms += amount * 60 * 60 * 1000;
        else if (unit === 'm') ms += amount * 60 * 1000;
        else if (unit === 's') ms += amount * 1000;
    }
    return ms;
}

function progressBar(current, total, size = 20) {
    const percent = Math.round((current / total) * 100);
    const filledSize = Math.round((size * current) / total);
    const filledBar = '▓'.repeat(filledSize);
    const emptyBar = '░'.repeat(size - filledSize);
    return `${filledBar}${emptyBar} ${percent}%`;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
