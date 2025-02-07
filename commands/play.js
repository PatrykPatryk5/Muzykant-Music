const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Odtwórz utwór na podstawie zapytania lub linku')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Nazwa utworu lub URL')
                .setRequired(true)
        ),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        // Sprawdzamy, czy użytkownik jest na kanale głosowym
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply('Musisz być na kanale głosowym, aby odtwarzać muzykę.');
        }

        const lavalink = interaction.client.lavalink;
        if (!lavalink) {
            return interaction.editReply('Lavalink nie został zainicjalizowany.');
        }

        try {
            // Pobieramy lub tworzymy playera dla serwera
            const player = lavalink.createPlayer({
                guildId: interaction.guild.id,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channel.id
            });

            if (!player.connected) {
                await player.connect();
            }

            // Wyszukujemy utwór
            const res = await player.search(query, interaction.user);
            if (res.loadType === 'NO_MATCHES') {
                return interaction.editReply('Nie znaleziono wyników.');
            }

            // Dodajemy pierwszy wynik do kolejki
            player.queue.add(res.tracks[0]);

            // Jeśli utwór nie gra – rozpoczynamy odtwarzanie
            if (!player.playing) {
                await player.play();
            }

            return interaction.editReply(`Dodano do kolejki: **${res.tracks[0].info.title}**`);
        } catch (error) {
            console.error('Błąd w komendzie play:', error);
            return interaction.editReply('Wystąpił błąd podczas odtwarzania utworu.');
        }
    },
};
