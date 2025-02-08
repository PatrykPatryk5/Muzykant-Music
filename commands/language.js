const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Set the preferred language')
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Select language')
                .setRequired(true)
                .addChoices(
                    { name: 'Polski', value: 'pl' },
                    { name: 'English', value: 'en' }
                )
        ),
    async execute(interaction) {
        const selectedLanguage = interaction.options.getString('language');
        db.prepare('INSERT OR REPLACE INTO user_preferences (user_id, language) VALUES (?, ?)').run(interaction.user.id, selectedLanguage);

        const t = translations[selectedLanguage];
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(t.languageCommand.languageSet)
            .setDescription(`${t.languageCommand.languageSet}: ${selectedLanguage}`);
        return interaction.reply({ embeds: [embed] });
    },
};