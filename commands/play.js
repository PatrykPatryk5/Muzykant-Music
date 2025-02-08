const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Odtwórz utwór lub playlistę na podstawie zapytania lub linku')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Nazwa utworu, URL lub URL playlisty')
                .setRequired(true)
        ),
    async execute(interaction) {
        const userLang = db.prepare('SELECT language FROM user_preferences WHERE user_id = ?').get(interaction.user.id)?.language || 'pl';
        const t = translations[userLang];
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.voiceChannelRequired)
                .setDescription(t.errors.joinVoiceChannel);
            return interaction.editReply({ embeds: [embed] });
        }

        const lavalink = interaction.client.lavalink;
        if (!lavalink) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.lavalinkNotInitialized)
                .setDescription(t.errors.initializationError);
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            const player = lavalink.createPlayer({
                guildId: interaction.guild.id,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channel.id
            });
            
            if (!player.connected) {
                await player.connect();
            }

            const res = await player.search(query, interaction.user);
            
            if (res.loadType === 'NO_MATCHES' || !res.tracks || res.tracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(t.errors.noMatches)
                    .setDescription(t.errors.noResultsFound);
                return interaction.editReply({ embeds: [embed] });
            }

            let embed;
            if (res.loadType === 'PLAYLIST_LOADED') {
                res.tracks.forEach(track => player.queue.add(track));
                embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.success.playlistAdded)
                    .setDescription(`${t.success.addedPlaylist}: **${res.playlistInfo?.name || 'Unknown Playlist'}** (${res.tracks.length} ${t.success.tracks})`);
            } else {
                const track = res.tracks[0];
                if (!track) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(t.errors.playCommandError)
                        .setDescription(t.errors.genericError);
                    return interaction.editReply({ embeds: [errorEmbed] });
                }
                player.queue.add(track);
                embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.success.trackAdded)
                    .setDescription(`${t.success.addedToQueue}: **${track.info?.title || 'Unknown Title'}**`);
            }
            
            if (!player.playing) {
                await player.play();
            }
            
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in play command:', error);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(t.errors.playCommandError)
                .setDescription(t.errors.genericError);
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
