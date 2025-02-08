const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filters')
        .setDescription('Toggle Filters')
        .addStringOption(o => o.setName('filter').setDescription('What Filter to toggle enabled/disabled').addChoices(
            { name: 'Clear Filters', value: 'clear' },
            { name: 'Nightcore', value: 'nightcore' },
            { name: 'Vaporwave', value: 'vaporwave' },
            { name: 'LowPass', value: 'lowpass' },
            { name: 'Karaoke', value: 'karaoke' },
            { name: 'Rotation', value: 'rotation' },
            { name: 'Tremolo', value: 'tremolo' },
            { name: 'Vibrato', value: 'vibrato' },
            { name: 'Echo (N/A)', value: 'echo' },
            { name: 'Reverb (N/A)', value: 'reverb' }
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
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const vcId = interaction.member?.voice?.channelId;
        if (!vcId) return interaction.reply({ ephemeral: true, content: t.errors.joinVoiceChannel });

        const player = lavalink.getPlayer(guildId);
        if (!player) return interaction.reply({ ephemeral: true, content: t.errors.noTrackPlaying });
        if (player.voiceChannelId !== vcId) return interaction.reply({ ephemeral: true, content: t.errors.joinVoiceChannel });

        let string = '';
        try {
            switch (interaction.options.getString('filter')) {
                case 'clear':
                    await player.filterManager.resetFilters();
                    string = t.success.filtersCleared;
                    break;
                case 'lowpass':
                    await player.filterManager.toggleLowPass();
                    string = player.filterManager.filters.lowpass ? t.success.lowpassEnabled : t.success.lowpassDisabled;
                    break;
                case 'nightcore':
                    await player.filterManager.toggleNightcore();
                    string = player.filterManager.filters.nightcore ? t.success.nightcoreEnabled : t.success.nightcoreDisabled;
                    break;
                case 'vaporwave':
                    await player.filterManager.toggleVaporwave();
                    string = player.filterManager.filters.vaporwave ? t.success.vaporwaveEnabled : t.success.vaporwaveDisabled;
                    break;
                case 'karaoke':
                    await player.filterManager.toggleKaraoke();
                    string = player.filterManager.filters.karaoke ? t.success.karaokeEnabled : t.success.karaokeDisabled;
                    break;
                case 'rotation':
                    await player.filterManager.toggleRotation();
                    string = player.filterManager.filters.rotation ? t.success.rotationEnabled : t.success.rotationDisabled;
                    break;
                case 'tremolo':
                    await player.filterManager.toggleTremolo();
                    string = player.filterManager.filters.tremolo ? t.success.tremoloEnabled : t.success.tremoloDisabled;
                    break;
                case 'vibrato':
                    await player.filterManager.toggleVibrato();
                    string = player.filterManager.filters.vibrato ? t.success.vibratoEnabled : t.success.vibratoDisabled;
                    break;
                case 'echo':
                    await player.filterManager.lavalinkLavaDspxPlugin.toggleEcho();
                    string = player.filterManager.filters.lavalinkLavaDspxPlugin.echo ? t.success.echoEnabled : t.success.echoDisabled;
                    break;
                case 'reverb':
                    await player.filterManager.lavalinkLavaDspxPlugin.toggleReverb();
                    string = player.filterManager.filters.lavalinkLavaDspxPlugin.reverb ? t.success.reverbEnabled : t.success.reverbDisabled;
                    break;
                case 'highPass':
                    await player.filterManager.lavalinkLavaDspxPlugin.toggleHighPass();
                    string = player.filterManager.filters.lavalinkLavaDspxPlugin.highPass ? t.success.highPassEnabled : t.success.highPassDisabled;
                    break;
                case 'normalization':
                    await player.filterManager.lavalinkLavaDspxPlugin.toggleNormalization();
                    string = player.filterManager.filters.lavalinkLavaDspxPlugin.normalization ? t.success.normalizationEnabled : t.success.normalizationDisabled;
                    break;
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(t.success.filterToggle)
                .setDescription(string);
            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in filters command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.filtersCommandError)
                .setDescription(t.errors.genericError);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};