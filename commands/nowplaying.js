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

            // Calculate progress percentage
            const progressPercentage = (currentPosition / trackDuration) * 100;

            // Generate progress bar
            const progressBar = generateProgressBar(progressPercentage);

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

function generateProgressBar(percentage) {
    const totalBars = 20;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    const progressBar = '▬'.repeat(filledBars) + '🔘' + '▬'.repeat(emptyBars);
    return progressBar;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
