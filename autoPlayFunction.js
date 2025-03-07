const translations = {
    pl: require('./translations/polish.json'),
    en: require('./translations/english.json')
};

module.exports = {
    autoPlayFunction: async (player, lastPlayedTrack) => {
        const userLang = player.get('language') || 'pl';
        const t = translations[userLang];

        const isAutoPlayDisabled = player.get("autoplay_disabled") === true;
        console.log(t.logs.autoplayTriggered, isAutoPlayDisabled ? t.logs.autoplayNotDisabled : t.logs.autoplayDisabled);
        if (isAutoPlayDisabled) return;
        if (!lastPlayedTrack) return console.log(t.logs.noLastTrack);

        if (lastPlayedTrack.info.sourceName === "spotify") {
            const filtered = player.queue.previous.filter(v => v.info.sourceName === "spotify").slice(0, 5);
            const ids = filtered.map(v => v.info.identifier || v.info.uri.split("/").reverse()[0] || v.info.uri.split("/").reverse()[1]);
            if (ids.length >= 2) {
                const res = await player.search({
                    query: `seed_tracks=${ids.join(",")}`,
                    source: "sprec"
                }, lastPlayedTrack.requester).then(response => {
                    response.tracks = response.tracks.filter(v => v.info.identifier !== lastPlayedTrack.info.identifier);
                    return response;
                }).catch(console.warn);
                if (res && res.tracks.length) await player.queue.add(res.tracks.slice(0, 5).map(track => {
                    track.pluginInfo.clientData = { ...(track.pluginInfo.clientData || {}), fromAutoplay: true };
                    return track;
                }));
            }
            return;
        }

        if (lastPlayedTrack.info.sourceName === "youtube" || lastPlayedTrack.info.sourceName === "youtubemusic") {
            const res = await player.search({
                query: `https://www.youtube.com/watch?v=${lastPlayedTrack.info.identifier}&list=RD${lastPlayedTrack.info.identifier}`,
                source: "youtube"
            }, lastPlayedTrack.requester).then(response => {
                response.tracks = response.tracks.filter(v => v.info.identifier !== lastPlayedTrack.info.identifier);
                return response;
            }).catch(console.warn);
            if (res && res.tracks.length) await player.queue.add(res.tracks.slice(0, 5).map(track => {
                track.pluginInfo.clientData = { ...(track.pluginInfo.clientData || {}), fromAutoplay: true };
                return track;
            }));
            return;
        }
        return;
    }
};