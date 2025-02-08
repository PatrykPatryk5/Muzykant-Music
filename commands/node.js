const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('node')
        .setDescription('Get information about the node'),
    async execute(interaction, client) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        const guildId = interaction.guildId;
        if (!guildId) return;

        await interaction.deferReply();

        const lavalink = client.lavalink;
        if (!lavalink) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.nodeCommand.nodeError)
                .setDescription(t.nodeCommand.noNodeFound);
            return interaction.editReply({ embeds: [embed] });
        }

        const node = lavalink.nodes.first();
        if (!node) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.nodeCommand.nodeError)
                .setDescription(t.nodeCommand.noNodeFound);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.nodeCommand.nodeInformation)
                .setDescription(`Node: ${node.options.host}`)
                .addFields(
                    { name: t.nodeCommand.status, value: node.connected ? t.nodeCommand.connected : t.nodeCommand.disconnected },
                    { name: t.nodeCommand.players, value: `${node.stats.players}` },
                    { name: t.nodeCommand.playingPlayers, value: `${node.stats.playingPlayers}` },
                    { name: t.nodeCommand.uptime, value: `${Math.floor(node.stats.uptime / 60000)} minutes` },
                    { name: t.nodeCommand.cpuLoad, value: `${node.stats.cpu.systemLoad.toFixed(2)}%` },
                    { name: t.nodeCommand.memoryUsage, value: `${(node.stats.memory.used / 1024 / 1024).toFixed(2)} MB` },
                    { name: t.nodeCommand.frameStats, value: `Sent: ${node.stats.frameStats.sent}, Deficit: ${node.stats.frameStats.deficit}, Nulled: ${node.stats.frameStats.nulled}` }
                );
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(`Error in node command: ${error}`);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.nodeCommand.error)
                .setDescription(t.nodeCommand.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};