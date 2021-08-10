const config = require('./config.json');
const TikTokScraper = require('tiktok-scraper');
const { Intents, Client } = require('discord.js');
const client = new Client({intents:[Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
const urlRegex = require('url-regex');
const axios = require('axios');
const fs = require('fs');
const nodeCleanup = require('node-cleanup');
const cron = require('node-cron');
const { execFile } = require('child_process');
const filesizeLimit = {
    default: 8 * 1024 * 1024 - 1000, // reserve 1KB for the message body
    tier2: 50 * 1024 * 1024 - 1000,
    tier3: 100 * 1024 * 1024 - 1000
};

let cooldown_users = new Set();
let database = fs.existsSync(config.DB_PATH) ? JSON.parse(fs.readFileSync(config.DB_PATH).toString()) : {};

client.on('messageCreate', async msg => {
    if (!msg.content || msg.author.bot || cooldown_users.has(msg.author.id))
        return;
    let found_match = false;

    //convert to set to remove duplicates and then back to array to be able to slice (slicing so max 5 tiktoks per message)
    Array.from(new Set(msg.content.match(urlRegex()))).slice(0, config.MAX_TIKTOKS_PER_MESSAGE).forEach((url) => {
        if (/(www\.tiktok\.com)|(vm\.tiktok\.com)/.test(url)) {
            cooldown_users.add(msg.author.id);
            found_match = true;
            try {
                msg.channel.sendTyping();
            }
            catch (e) {
               console.log(e);
            }
            TikTokScraper.getVideoMeta(url).then(tt_response =>
                axios.get(tt_response.collector[0].videoUrl, {responseType: 'arraybuffer', headers: tt_response.headers}).then(axios_response => {
                    if (is_too_large_attachment(msg, axios_response)) {
                        msg.reply({content: 'This TikTok exceeds the file size limit Discord allows :*(', allowedMentions: {repliedUser: false}}).catch(console.error);
                        return;
                    }
                    msg.reply({files: [{attachment: axios_response.data, name: `${tt_response.collector[0].id}.mp4`}], allowedMentions: {repliedUser: false}}).then(update_database(msg, tt_response))
                        .catch(console.error) // if sending of the Discord message itself failed, just log error to console
                    })
                        .catch(err => report_error(msg, err)))  // if TikTokScraper.getVideoMeta() failed
                        .catch(err => report_error(msg, err));  // if axios.get() failed
        }
        else if (config.EMBED_TWITTER_VIDEO && /\Wtwitter\.com/.test(url)) {
            execFile('gallery-dl', ['-g', url], (error, stdout, stderr) => {
                if (error) {
                    return;
                }
                if (/.mp4/.test(stdout))
                    msg.reply({content: stdout, allowedMentions: {repliedUser: false}}).catch(console.error);
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

function is_too_large_attachment(msg, stream) {
    let limit = 0;
    if (!msg.guild)
        limit = filesizeLimit.default;
    else {
        switch (msg.guild.premiumTier) {
            case 'NONE':
            case 'TIER_1':
                limit = filesizeLimit.default;
                break;
            case 'TIER_2':
                limit = filesizeLimit.tier2;
                break;
            case 'TIER_3':
                limit = filesizeLimit.tier3;
                break;
        }
    }
    return stream.data.length >= limit;
}

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
    msg.reply({ content: `Error on trying to download this TikTok:\n\`${error}\``, allowedMentions: { repliedUser: false } }).catch(console.error);
}


client.login(config.TOKEN).then(() => console.log('Connected as ' + client.user.tag)).catch(console.error);
