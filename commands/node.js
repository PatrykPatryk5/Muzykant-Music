const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('node')
        .setDescription('Get information about the node'),
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        if (!guildId) return;

        await interaction.deferReply();
        const lavalink = client.lavalink;
        const node = lavalink.nodes.first();
        if (!node) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Node Error')
                .setDescription('No node found.');
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Node Information')
                .setDescription(`Node: ${node.options.host}`)
                .addFields(
                    { name: 'Status', value: node.connected ? 'Connected' : 'Disconnected' },
                    { name: 'Players', value: `${node.stats.players}` },
                    { name: 'Uptime', value: `${Math.floor(node.stats.uptime / 60000)} minutes` }
                );
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in node command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Error')
                .setDescription('An error occurred while processing the request.');
            return interaction.editReply({ embeds: [embed] });
        }
    },
};