# Muzykant Music Bot

Muzykant Music Bot is a Discord bot designed to provide a rich music playing experience. It supports various music-related commands, playlist management, and more. This bot uses Lavalink for music streaming, making it highly efficient and reliable.

## Features

- Play music from YouTube, SoundCloud, and other sources
- Playlist management
- Music filters (e.g., nightcore, vaporwave, lowpass, etc.)
- Sharding support for large servers
- Customizable via environment variables

## Prerequisites

- Node.js (version 18.x, 20.x, or 22.x)
- npm
- Lavalink server
- A Discord bot token

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/PatrykPatryk5/Muzykant-Music.git
    cd Muzykant-Music
    ```

2. Install the dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add your Discord bot token:
    ```env
    BOT_TOKEN=
    CLIENT_ID=
    LAVALINK_HOST=
    LAVALINK_PORT=
    LAVALINK_PASSWORD=

    ```

4. Ensure you have a running Lavalink server and configure its connection in your bot configuration.

## Usage

1. Start the bot:
    ```bash
    npm run start
    ```

2. The bot should now be online and ready to use in your Discord server.


## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any changes or improvements.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. See the LICENSE file for details.

## Support

If you need help or have any questions, feel free to open an issue on GitHub or contact the repository owner.
