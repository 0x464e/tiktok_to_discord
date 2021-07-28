const config = require('./config.json');
const TikTokScraper = require('tiktok-scraper');
const Discord = require('discord.js');
require('discord-reply');
const client = new Discord.Client();
const urlRegex = require('url-regex');
const axios = require('axios');
const fs = require('fs');
const nodeCleanup = require('node-cleanup');
const cron = require('node-cron');
const { execFile } = require('child_process');

let cooldown_users = new Set();
let database = fs.existsSync(config.DB_PATH) ? JSON.parse(fs.readFileSync(config.DB_PATH).toString()) : {};

client.on('message', async msg => {
    if (!msg.content || msg.author.bot || cooldown_users.has(msg.author.id))
        return;

    let found_match = false;
    //convert to set to remove duplicates and then back to array to be able to slice (slicing so max 5 tiktoks per message)
    Array.from(new Set(msg.content.match(urlRegex()))).slice(0, config.MAX_TIKTOKS_PER_MESSAGE).forEach((url) => {
        if (/(www\.tiktok\.com)|(vm\.tiktok\.com)/.test(url)) {
            cooldown_users.add(msg.author.id);
            found_match = true;
            try {
                msg.channel.startTyping().then(msg.channel.stopTyping());
            }
            catch (e) {
               console.log(e);
            }
            TikTokScraper.getVideoMeta(url).then(tt_response =>
                axios.get(tt_response.collector[0].videoUrl, {responseType: 'arraybuffer', headers: tt_response.headers}).then(axios_response =>
                    msg.lineReplyNoMention('', {files: [{attachment: axios_response.data, name: `${tt_response.collector[0].id}.mp4`}]}).then(update_database(msg, tt_response))
                        .catch(console.error))                  // if sending of the Discord message itself failed, just log error to console
                        .catch(err => report_error(msg, err)))  // if TikTokScraper.getVideoMeta() failed
                        .catch(err => report_error(msg, err));  // if axios.get() failed
        }
        else if (config.EMBED_TWITTER_VIDEO && /\Wtwitter\.com/.test(url)) {
            execFile('gallery-dl', ['-g', url], (error, stdout, stderr) => {
                if (error) {
                    return;
                }
                if (/.mp4/.test(stdout))
                    msg.lineReplyNoMention(stdout).catch(console.error);
            });
        }
    });

    // very basic cooldown implementation to combat spam.
    // removes user id from set after cooldown_per_user ms.
    if(found_match)
         (async (id = msg.author.id) => {
            await new Promise(x => setTimeout(x, config.COOLDOWN_PER_USER));
            cooldown_users.delete(id);
        })();
})

async function update_database(msg, tt_response) {
    if (!config.USE_DATABASE)
        return
    if (database.hasOwnProperty(msg.author.id)) {
        const userId = msg.author.id;
        const tt = tt_response.collector[0];
        if (database[userId]['downloads'].hasOwnProperty(tt.id))
            database[userId]['downloads'][tt.id]['count']++;
        else {
            let thumbnail = config.STORE_THUMBNAILS ? 'data:image/png;base64,' + Buffer.from((await axios.get(tt.imageUrl, {responseType: 'arraybuffer', headers: tt_response.headers}))
                .data, 'binary').toString('base64') : "";
            database[userId]['downloads'][tt.id] = {
                'count': 1,
                'description': tt.text,
                'userName': '@' + tt.authorMeta.name,
                'nickname': tt.authorMeta.nickName,
                'thumbnail': thumbnail
            };
        }
    }
    else {
        const userId = msg.author.id;
        const tt = tt_response.collector[0];
        let thumbnail = config.STORE_THUMBNAILS ? 'data:image/png;base64,' + Buffer.from((await axios.get(tt.imageUrl, {responseType: 'arraybuffer', headers: tt_response.headers}))
            .data, 'binary').toString('base64') : "";
        database[userId] = {
            'username': msg.author.tag,
            'firstDownload': Date.now(),
            'downloads': {
                [tt.id]: {
                    'count': 1,
                    'description': tt.text,
                    'userName': '@' + tt.authorMeta.name,
                    'nickname': tt.authorMeta.nickName,
                    'thumbnail': thumbnail
                }
            }
        };
    }
}

//write database to file every hour
cron.schedule('0 * * * *', () =>
    fs.writeFileSync(config.DB_PATH, JSON.stringify(database)));

//write database to file on any exit reason
nodeCleanup((exitCode, signal) =>
    fs.writeFileSync(config.DB_PATH, JSON.stringify(database)));

function report_error(msg, error) {
    msg.lineReplyNoMention(`Error on trying to download this TikTok:\n\`${error}\``).catch(console.error);
}


client.login(config.TOKEN).then(() => console.log('Connected as ' + client.user.tag)).catch(console.error);
