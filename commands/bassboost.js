const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EQList } = require("lavalink-client");
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bassboost')
        .setDescription('Adjust the bass boost level')
        .addStringOption(option => 
            option.setName('level')
                .setDescription('The level of bass boost')
                .setRequired(true)
                .addChoices(
                    { name: 'high', value: 'high' },
                    { name: 'medium', value: 'medium' },
                    { name: 'low', value: 'low' },
                    { name: 'off', value: 'off' }
                )),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];

        const guildId = interaction.guildId;
        if (!guildId) return;

        const lavalink = interaction.client.lavalink;
        if (!lavalink) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.lavalinkNotInitialized)
                .setDescription(t.errors.initializationError);
            return interaction.reply({ embeds: [embed], flags: 64 }); // 64 is the flag for ephemeral
        }

        const player = lavalink.getPlayer(guildId);
        if (!player) {
            console.error(`Player not found for guild: ${guildId}`);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.noTrackPlaying)
                .setDescription(t.errors.notPlaying);
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        const level = interaction.options.getString('level').toLowerCase();
        if (!level) {
            console.error('Bass boost level is undefined or empty');
            return;
        }

        try {
            switch (level) {
                case 'high':
                    await player.filterManager.setEQ(EQList.BassboostHigh);
                    break;
                case 'medium':
                    await player.filterManager.setEQ(EQList.BassboostMedium);
                    break;
                case 'low':
                    await player.filterManager.setEQ(EQList.BassboostLow);
                    break;
                case 'off':
                    await player.filterManager.clearEQ();
                    break;
                default:
                    throw new Error('Invalid bass boost level');
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.bassboostSet)
                .setDescription(t.success.bassboostLevel.replace('{level}', level));
            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in bassboost command:', error);
const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(t.errors.bassboostCommandError || "Unknown error") // Fallback, jeśli brak tytułu
    .setDescription(t.errors.genericError || "An error occurred");

            return interaction.reply({ embeds: [embed], flags: 64 });
        }
    },
};
