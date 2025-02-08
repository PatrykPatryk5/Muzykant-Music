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

            // Sprawdzanie czy to link do Spotify
            if (query.includes('open.spotify.com')) {
                const spotifyUrl = new URL(query);
                const pathParts = spotifyUrl.pathname.split('/');
                const type = pathParts[1]; // playlist, track, album
                const id = pathParts[2].split('?')[0];

                let loadingEmbed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setTitle('Ładowanie...')
                    .setDescription('Wczytywanie utworów ze Spotify...');
                await interaction.editReply({ embeds: [loadingEmbed] });

                let searchQuery = `sp:${type}:${id}`;
                console.log('Spotify search query:', searchQuery);

                let searchResult = await player.search(searchQuery, interaction.user);
                
                if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
                    searchQuery = `spsearch:${query}`;
                    console.log('Trying alternative search:', searchQuery);
                    searchResult = await player.search(searchQuery, interaction.user);
                    
                    if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(t.errors.noMatches)
                            .setDescription(t.errors.noResultsFound);
                        return interaction.editReply({ embeds: [errorEmbed] });
                    }
                }

                console.log('Found tracks:', searchResult.tracks.length);
                console.log('Player state before adding tracks:', {
                    playing: player.playing,
                    paused: player.paused,
                    queueSize: player.queue.size
                });

                // Dodaj wszystkie utwory do kolejki
                for (const track of searchResult.tracks) {
                    await player.queue.add(track);
                }

                console.log('Player state after adding tracks:', {
                    playing: player.playing,
                    paused: player.paused,
                    queueSize: player.queue.size
                });

                // Upewnij się, że odtwarzanie rozpocznie się
                if (!player.playing) {
                    try {
                        await player.play();
                        console.log('Started playback');
                    } catch (playError) {
                        console.error('Error starting playback:', playError);
                        // Spróbuj ponownie rozpocząć odtwarzanie po krótkim opóźnieniu
                        setTimeout(async () => {
                            try {
                                if (!player.playing && player.queue.size > 0) {
                                    await player.play();
                                    console.log('Started playback after delay');
                                }
                            } catch (retryError) {
                                console.error('Error on retry:', retryError);
                            }
                        }, 1000);
                    }
                }

                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(t.success.playlistAdded)
                    .setDescription(`${t.success.addedPlaylistToQueue.replace('{count}', searchResult.tracks.length)}: **${searchResult.playlistInfo?.name || 'Spotify Track'}**`);

                return interaction.editReply({ embeds: [successEmbed] });
            } else {
                // Standardowe wyszukiwanie dla nie-Spotify linków
                let searchQuery = query;
                if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    searchQuery = `ytsearch:${query}`;
                }

                const res = await player.search(searchQuery, interaction.user);

                if (res.loadType === 'NO_MATCHES' || !res.tracks || res.tracks.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle(t.errors.noMatches)
                        .setDescription(t.errors.noResultsFound);
                    return interaction.editReply({ embeds: [embed] });
                }

                if (res.loadType === 'PLAYLIST_LOADED') {
                    for (const track of res.tracks) {
                        await player.queue.add(track);
                    }
                    
                    console.log('Player state before playing playlist:', {
                        playing: player.playing,
                        paused: player.paused,
                        queueSize: player.queue.size
                    });

                    if (!player.playing) {
                        try {
                            await player.play();
                            console.log('Started playlist playback');
                        } catch (playError) {
                            console.error('Error starting playlist playback:', playError);
                            setTimeout(async () => {
                                if (!player.playing && player.queue.size > 0) {
                                    await player.play();
                                }
                            }, 1000);
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(t.success.playlistAdded)
                        .setDescription(`${t.success.addedPlaylistToQueue.replace('{count}', res.tracks.length)}: **${res.playlistInfo?.name || 'Unknown Playlist'}**`);
                    
                    return interaction.editReply({ embeds: [embed] });
                } else {
                    const track = res.tracks[0];
                    if (!track) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle(t.errors.playCommandError)
                            .setDescription(t.errors.genericError);
                        return interaction.editReply({ embeds: [errorEmbed] });
                    }
                    
                    await player.queue.add(track);
                    
                    console.log('Player state before playing single track:', {
                        playing: player.playing,
                        paused: player.paused,
                        queueSize: player.queue.size
                    });

                    if (!player.playing) {
                        try {
                            await player.play();
                            console.log('Started single track playback');
                        } catch (playError) {
                            console.error('Error starting single track playback:', playError);
                            setTimeout(async () => {
                                if (!player.playing && player.queue.size > 0) {
                                    await player.play();
                                }
                            }, 1000);
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(t.success.trackAdded)
                        .setDescription(`${t.success.addedToQueue}: **${track.info?.title || 'Unknown Title'}**`);
                    
                    return interaction.editReply({ embeds: [embed] });
                }
            }
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
