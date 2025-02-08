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
            console.error('Lavalink client is not defined');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.commands.nodeCommand.nodeError || 'Node Error')
                .setDescription(t.commands.nodeCommand.noNodeFound || 'No node found');
            return interaction.editReply({ embeds: [embed] });
        }

        const nodeManager = lavalink.nodeManager;
        if (!nodeManager) {
            console.error('Node manager is not defined in Lavalink client');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.commands.nodeCommand.nodeError || 'Node Error')
                .setDescription(t.commands.nodeCommand.noNodeFound || 'No node found');
            return interaction.editReply({ embeds: [embed] });
        }

        const nodes = nodeManager.nodes;
        if (!nodes || nodes.size === 0) {
            console.error('No nodes found in NodeManager');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.commands.nodeCommand.nodeError || 'Node Error')
                .setDescription(t.commands.nodeCommand.noNodeFound || 'No node found');
            return interaction.editReply({ embeds: [embed] });
        }

        const node = nodes.values().next().value;
        if (!node) {
            console.error('No node found in NodeManager');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.commands.nodeCommand.nodeError || 'Node Error')
                .setDescription(t.commands.nodeCommand.noNodeFound || 'No node found');
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.commands.nodeCommand.nodeInformation || 'Node Information')
                .setDescription(`Node: ${node.options.host}`)
                .addFields(
                    { name: t.commands.nodeCommand.status || 'Status', value: node.connected ? (t.commands.nodeCommand.connected || 'Connected') : (t.commands.nodeCommand.disconnected || 'Disconnected') },
                    { name: t.commands.nodeCommand.players || 'Players', value: `${node.stats.players}` },
                    { name: t.commands.nodeCommand.playingPlayers || 'Playing Players', value: `${node.stats.playingPlayers}` },
                    { name: t.commands.nodeCommand.uptime || 'Uptime', value: `${Math.floor(node.stats.uptime / 60000)} minutes` },
                    { name: t.commands.nodeCommand.cpuLoad || 'CPU Load', value: `${node.stats.cpu.systemLoad.toFixed(2)}%` },
                    { name: t.commands.nodeCommand.memoryUsage || 'Memory Usage', value: `${(node.stats.memory.used / 1024 / 1024).toFixed(2)} MB` },
                    { name: t.commands.nodeCommand.frameStats || 'Frame Stats', value: `Sent: ${node.stats.frameStats.sent}, Deficit: ${node.stats.frameStats.deficit}, Nulled: ${node.stats.frameStats.nulled}` }
                );
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(`Error in node command: ${error}`);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.commands.nodeCommand.error || 'Error')
                .setDescription(t.commands.nodeCommand.genericError || 'An error occurred');
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
