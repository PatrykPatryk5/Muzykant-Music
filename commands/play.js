const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const translations = {
    pl: require('../translations/polish.json'),
    en: require('../translations/english.json')
};

function parseDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function progressBar(current, total, size = 20) {
    const percent = Math.round((current / total) * 100);
    const filledSize = Math.round((size * current) / total);
    const filledBar = '▓'.repeat(filledSize);
    const emptyBar = '░'.repeat(size - filledSize);
    return `${filledBar}${emptyBar} ${percent}%`;
}

async function createControlRow(player) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('previous')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('pause_resume')
                .setEmoji(player.paused ? '▶️' : '⏸️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('next')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Primary)
        );
}

async function sendControlPanel(interaction, player) {
    if (!player.queue.current) return;

    const track = player.queue.current;
    const position = player.position;
    const duration = track.info.length || track.info.duration || 0;

    const progressBarText = progressBar(position, duration);
    const currentTime = parseDuration(position);
    const totalTime = parseDuration(duration);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Odtwarzanie')
        .setDescription(`**${track.info.title}**\n\n${progressBarText}\n\n${currentTime} - ${totalTime}`);

    const row = await createControlRow(player);
    const message = await interaction.channel.send({ embeds: [embed], components: [row] });
    interaction.message = message;

    if (player.playing) {
        setTimeout(() => updateControlPanel(interaction, player), 5000);
    }
}

async function updateControlPanel(interaction, player) {
    if (!player.queue.current || !interaction.message) return;

    const track = player.queue.current;
    const position = player.position;
    const duration = track.info.length || track.info.duration || 0;

    const progressBarText = progressBar(position, duration);
    const currentTime = parseDuration(position);
    const totalTime = parseDuration(duration);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Odtwarzanie')
        .setDescription(`**${track.info.title}**\n\n${progressBarText}\n\n${currentTime} - ${totalTime}`);

    const row = await createControlRow(player);

    try {
        await interaction.message.edit({ embeds: [embed], components: [row] });
        
        if (player.playing) {
            setTimeout(() => updateControlPanel(interaction, player), 5000);
        }
    } catch (error) {
        console.error('Error updating control panel:', error);
    }
}

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
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            let controlPanelMessage = null;

            if (res.loadType === 'PLAYLIST_LOADED') {
                for (const track of res.tracks) {
                    player.queue.add(track);
                }

                if (!player.playing) {
                    await player.play();
                }

                await interaction.editReply({ 
                    content: `Dodano playlistę: **${res.playlistInfo?.name || 'Unknown Playlist'}** (${res.tracks.length} utworów)`,
                    ephemeral: true 
                });
                
                if (!controlPanelMessage) {
                    controlPanelMessage = await sendControlPanel(interaction, player);
                }
            } else {
                const track = res.tracks[0];
                player.queue.add(track);

                if (!player.playing) {
                    await player.play();
                }

                await interaction.editReply({ 
                    content: `Dodano do kolejki: **${track.info?.title || 'Unknown Title'}**`,
                    ephemeral: true 
                });

                if (!controlPanelMessage) {
                    controlPanelMessage = await sendControlPanel(interaction, player);
                }
            }

            // Create a new collector for each control panel
            const collector = controlPanelMessage.createMessageComponentCollector({
                time: 3600000 // 1 hour
            });

            collector.on('collect', async (i) => {
                // Acknowledge the interaction immediately
                await i.deferUpdate().catch(() => {});

                try {
                    switch (i.customId) {
                        case 'previous':
                            const previous = await player.queue.shiftPrevious().catch(() => null);
                            if (previous) {
                                await player.play({ clientTrack: previous });
                            }
                            break;
                        case 'pause_resume':
                            if (player.playing && !player.paused) {
                                await player.pause();
                            } else if (player.paused) {
                                await player.resume();
                            }
                            break;
                        case 'stop':
                            player.destroy();
                            await controlPanelMessage.delete().catch(() => {});
                            clearInterval(updateInterval);
                            break;
                        case 'next':
                            await player.skip();
                            break;
                    }

                    if (player.playing && i.customId !== 'stop') {
                        await updateControlPanel(controlPanelMessage, player);
                    }
                } catch (error) {
                    console.error('Error handling button:', error);
                }
            });

            // Clean up when the collector ends
            collector.on('end', () => {
                if (controlPanelMessage) {
                    controlPanelMessage.delete().catch(() => {});
                }
                clearInterval(updateInterval);
            });

        } catch (error) {
            console.error('Error in play command:', error);
            return interaction.editReply({ 
                content: 'Wystąpił błąd podczas odtwarzania.',
                ephemeral: true 
            });
        }
    },
};
