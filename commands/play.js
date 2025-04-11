const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../database');
const translations = {
  pl: require('../translations/polish.json'),
  en: require('../translations/english.json'),
};

// Funkcja pomocnicza: zamiana milisekund na format mm:ss
function parseDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Funkcja pomocnicza: tworzenie paska postępu
function progressBar(current, total, size = 20) {
  const percent = Math.round((current / total) * 100);
  const filledSize = Math.round((size * current) / total);
  const filledBar = '▓'.repeat(filledSize);
  const emptyBar = '░'.repeat(size - filledSize);
  return `${filledBar}${emptyBar} ${percent}%`;
}

// Funkcja pomocnicza: tworzenie wiersza przycisków sterujących
async function createControlRow(player) {
  return new ActionRowBuilder().addComponents(
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

// Funkcja pomocnicza: wysłanie panelu sterowania na kanał tekstowy
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

  try {
    const controlMessage = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });
    interaction.controlPanelMessage = controlMessage;

    const collector = controlMessage.createMessageComponentCollector({
      // Opcjonalnie: ustaw limit czasowy (np. 10 minut)
      // time: 600000,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Nie możesz tego użyć!', ephemeral: true });
        }
        switch (i.customId) {
          case 'previous':
            try {
              await playPreviousTrack(player);
            } catch (error) {
              console.error('Błąd przy odtwarzaniu poprzedniego utworu:', error);
            }
            break;
          case 'pause_resume':
            try {
              if (player.playing && !player.paused) {
                await player.pause();
              } else if (player.paused) {
                await player.resume();
              }
            } catch (error) {
              console.error('Błąd przy przełączaniu pauzy:', error);
            }
            break;
          case 'stop':
            try {
              await player.stopPlaying(true, false);
            } catch (error) {
              console.error('Błąd przy zatrzymywaniu odtwarzania:', error);
            }
            try {
              await controlMessage.delete();
            } catch (error) {
              console.error('Błąd przy usuwaniu panelu sterowania:', error);
            }
            collector.stop();
            return;
          case 'next':
            try {
              player.skip();
            } catch (error) {
              console.error('Błąd przy pomijaniu utworu:', error);
            }
            break;
        }
        await i.deferUpdate();
        updateControlPanel(interaction, player);
      } catch (error) {
        console.error('Błąd obsługi interakcji przycisku:', error);
        await i.deferUpdate();
      }
    });

    // Automatyczna aktualizacja panelu co 10 sekund, jeśli utwór nadal gra
    if (player.playing) {
      setTimeout(() => updateControlPanel(interaction, player), 10000);
    }
  } catch (error) {
    console.error('Błąd przy wysyłaniu panelu sterowania:', error);
  }
}

// Funkcja pomocnicza: aktualizacja panelu sterowania (edycja istniejącej wiadomości)
async function updateControlPanel(interaction, player) {
  if (!player.queue.current || !interaction.controlPanelMessage) return;

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
    await interaction.controlPanelMessage.edit({
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error('Błąd przy aktualizacji panelu sterowania:', error);
  }
}

// Funkcja pomocnicza: odtwarzanie poprzedniego utworu (przycisk "previous")
async function playPreviousTrack(player) {
  if (!player.history || player.history.length === 0) {
    console.error('Brak poprzedniego utworu w historii');
    return;
  }
  const previousTrack = player.history.pop();
  player.queue.unshift(previousTrack);
  await player.play();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Odtwórz utwór lub playlistę na podstawie zapytania lub linku')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Nazwa utworu, URL lub URL playlisty')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const userLang =
      db.prepare('SELECT language FROM user_preferences WHERE user_id = ?')
        .get(interaction.user.id)?.language || 'pl';
    const t = translations[userLang];
    const query = interaction.options.getString('query');

    await interaction.deferReply();

    // Sprawdzenie, czy użytkownik jest na kanale głosowym
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(t.errors.voiceChannelRequired || 'Błąd')
        .setDescription(t.errors.joinVoiceChannel || 'Dołącz do kanału głosowego!');
      return interaction.editReply({ embeds: [embed] });
    }

    // Pobieramy obiekt lavalink z klienta
    const lavalink = interaction.client.lavalink;
    if (!lavalink) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(t.errors.lavalinkNotInitialized || 'Błąd')
        .setDescription(t.errors.initializationError || 'Lavalink nie został poprawnie zainicjowany.');
      return interaction.editReply({ embeds: [embed] });
    }

    // Pobieramy (lub tworzymy) gracza korzystając z lavalink
    let player = lavalink.getPlayer(interaction.guild.id);
    if (!player) {
      player = lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        selfMute: false,
        selfDeaf: true,
        vcRegion: voiceChannel.rtcRegion || undefined,
      });
    }
    if (!player.connected) await player.connect();

    // Wyszukiwanie utworu/playlisty
    let res;
    try {
      res = await player.search({ query: query }, interaction.user);
    } catch (error) {
      console.error('Błąd podczas wyszukiwania:', error);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(t.errors.genericError || 'Błąd')
        .setDescription(t.errors.playCommandError || 'Wystąpił błąd podczas wykonywania polecenia.');
      return interaction.editReply({ embeds: [embed] });
    }

    if (!res || !res.tracks || res.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(t.errors.search_error || 'Brak wyników')
        .setDescription(t.errors.noResultsFound || 'Nie znaleziono wyników dla zapytania.');
      return interaction.editReply({ embeds: [embed] });
    }

    // Obsługa playlisty: jeśli wynik zawiera playlistę lub zapytanie wskazuje na playlistę (np. "list=")
    if (res.loadType === 'playlist' || (query.includes('list=') && res.tracks.length > 1)) {
      try {
        for (const track of res.tracks) {
          await player.queue.add(track);
        }
      } catch (error) {
        console.error('Błąd przy dodawaniu utworów z playlisty:', error);
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(t.errors.playlistAdditionError || 'Błąd dodawania playlisty')
          .setDescription('Wystąpił błąd podczas dodawania utworów z playlisty.');
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      if (!player.playing) await player.play({ paused: false });
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(t.success.playlistAdded || 'Playlista dodana')
        .setDescription(
          `${t.success.addedPlaylistToQueue.replace('{count}', res.tracks.length)}: **${res.playlistInfo?.name || 'Nieznana Playlista'}**`
        );
      const message = await interaction.editReply({ embeds: [embed] });
      setTimeout(async () => {
        try {
          await message.delete();
          await sendControlPanel(interaction, player);
        } catch (error) {
          console.error('Błąd przy obsłudze panelu sterowania playlisty:', error);
        }
      }, 5000);
    } else {
      // Obsługa pojedynczego utworu
      const track = res.tracks[0];
      try {
        await player.queue.add(track);
      } catch (error) {
        console.error('Błąd przy dodawaniu utworu:', error);
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(t.errors.trackAdditionError || 'Błąd dodawania utworu')
          .setDescription('Wystąpił błąd podczas dodawania utworu.');
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      if (!player.playing) await player.play({ paused: false });
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(t.success.trackAdded || 'Utwór dodany')
        .setDescription(`${t.success.addedToQueue}: **${track.info?.title || 'Nieznany tytuł'}**`);
      const message = await interaction.editReply({ embeds: [embed] });
      setTimeout(async () => {
        try {
          await message.delete();
          await sendControlPanel(interaction, player);
        } catch (error) {
          console.error('Błąd przy obsłudze panelu sterowania utworu:', error);
        }
      }, 5000);
    }

// Dodanie bieżącego utworu do historii przy rozpoczęciu kolejnego utworu
player.history = player.history || [];
player.on('trackStart', (playingTrack) => {
  if (player.queue.current) {
    player.history.push(player.queue.current);
  }
});

  },

  // Obsługa autouzupełniania dla opcji "query"
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    if (!focusedOption?.value.trim()) {
      return interaction.respond([]);
    }

    let res;
    try {
      res = await interaction.client.lavalink.search({ query: focusedOption.value.trim() }, interaction.user);
    } catch (error) {
      console.error('Błąd podczas wyszukiwania dla autouzupełniania:', error);
      return interaction.respond([]);
    }

    const songs = [];
    if (res.loadType === 'search' || res.loadType === 'playlist') {
      res.tracks.slice(0, 10).forEach((track) => {
        let name = `${track.info.title} by ${track.info.author}`;
        if (name.length > 100) name = `${name.substring(0, 97)}...`;
        songs.push({
          name: name,
          value: track.info.uri,
        });
      });
    }
    return interaction.respond(songs);
  },
};
