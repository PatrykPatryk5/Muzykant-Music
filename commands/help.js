const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a list of available commands'),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(t.commands.help.title)
            .setDescription(t.commands.help.description)
            .addFields(
                { name: '/play', value: t.playCommand.description },
                { name: '/nowplaying', value: t.nowPlayingCommand.description },
                { name: '/pause', value: t.pauseCommand.description },
                { name: '/queue', value: t.queueCommand.description },
                { name: '/resume', value: t.resumeCommand.description },
                { name: '/skip', value: t.skipCommand.description },
                { name: '/stop', value: t.stopCommand.description },
                { name: '/volume', value: t.volumeCommand.description },
                { name: '/language', value: t.languageCommand.description },
                { name: '/8d', value: t.commands['8d'].description },
                { name: '/bassboost', value: t.commands.bassboost.description },
                { name: '/distorsion', value: t.commands.distorsion.description },
                { name: '/karaoke', value: t.commands.karaoke.description },
                { name: '/nightcore', value: t.commands.nightcore.description },
                { name: '/pitch', value: t.commands.pitch.description },
                { name: '/rate', value: t.commands.rate.description },
                { name: '/reset', value: t.commands.reset.description },
                { name: '/rotation', value: t.commands.rotation.description },
                { name: '/speed', value: t.commands.speed.description },
                { name: '/tremolo', value: t.commands.tremolo.description },
                { name: '/vibrato', value: t.commands.vibrato.description },
                { name: '/lowpass', value: t.commands.lowpass.description },
                { name: '/node', value: t.commands.node.description },
                { name: '/ping', value: t.commands.ping.description }
            );
        return interaction.reply({ embeds: [embed] });
    },
};