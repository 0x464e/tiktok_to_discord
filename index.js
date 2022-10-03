const config = require('./config.json');
const { Client } = require('discord.js');
const client = new Client({intents:['Guilds', 'DirectMessages', 'GuildMessages', 'MessageContent']});
const urlRegex = require('url-regex-safe');
const axios = require('axios');
const { execFile } = require('child_process');
const puppeteer = require('puppeteer');
const filesizeLimit = {
    default: 8 * 1024 * 1024 - 1000, // reserve 1KB for the message body
    tier2: 50 * 1024 * 1024 - 1000,
    tier3: 100 * 1024 * 1024 - 1000
};

let cooldown_users = new Set();
let supress_embeds = new Set();

client.on('messageCreate', async msg => {
    if (!msg.content || msg.author.bot || cooldown_users.has(msg.author.id))
        return;
    let found_match = false;

    //convert to set to remove duplicates and then back to array to be able to slice (slicing so max 5 tiktoks per message)
    Array.from(new Set(msg.content.match(urlRegex()))).slice(0, config.MAX_TIKTOKS_PER_MESSAGE).forEach((url) => {
        if (/(www\.tiktok\.com)|(vm\.tiktok\.com)/.test(url)) {
            cooldown_users.add(msg.author.id);
            found_match = true;
            msg.channel.sendTyping().catch(console.error);

            get_tiktok_url(url).then(direct_url =>
                axios.get(direct_url, { responseType: 'arraybuffer' }).then(axios_response => {
                    let too_large = is_too_large_attachment(msg.guild, axios_response);
                    if (too_large && !config.BOOSTED_CHANNEL_ID)  // no channel set from which to borrow file size limits
                        report_filesize_error(msg);
                    else if (too_large)
                        client.channels.fetch(config.BOOSTED_CHANNEL_ID).then(channel => {
                            if (is_too_large_attachment(channel.guild, axios_response))
                                report_filesize_error(msg);
                            else
                                channel.send({files: [{attachment: axios_response.data, name: `${Date.now()}.mp4`}]}).then(boosted_msg =>
                                    msg.reply({content: boosted_msg.attachments.first().attachment, allowedMentions: {repliedUser: false}})
                                        .catch(console.error)) // if the final reply failed
                                    .catch(console.error); // if sending to the boosted channel failed
                            }).catch(() => report_filesize_error(msg))
                    else
                        msg.reply({files: [{attachment: axios_response.data, name: `${Date.now()}.mp4`}], allowedMentions: {repliedUser: false}})
                            .catch(console.error) // if sending of the Discord message itself failed, just log error to console
                    })
                            .catch(err => report_error(msg, err)));  // if axios.get() failed
        }
        else if (config.EMBED_TWITTER_VIDEO && /\Wtwitter\.com\/.+?\/status\//.test(url)) {
            execFile('gallery-dl', ['-g', url], (error, stdout, stderr) => {
                if (error)
                    return;
                if (/\.mp4/.test(stdout))
                    msg.reply({content: stdout, allowedMentions: {repliedUser: false}}).catch(console.error);
            });
        }
    });

    if(found_match)
    {
        //if the embed has already been generated, it'll immediately appear with the message
        //otherwise we need to wait for the embed to appear in 'messageUpdate' event
        if (msg.embeds.length)
        {
            if (msg.guild.me.permissionsIn(msg.channel).has('ManageMessages'))
                msg.suppressEmbeds().catch(console.error);
        }
        else
            supress_embeds.add(msg.id);

        //if the embed hasn't appeared in 10 seconds, lets assume it'll never appear
        //and clear the message id from `supress_embeds`
        (async (id = msg.id) => {
            await new Promise(x => setTimeout(x, 10000));
            supress_embeds.delete(id);
        })();

        // very basic cooldown implementation to combat spam.
        // removes user id from set after cooldown_per_user ms.
        (async (id = msg.author.id) => {
            await new Promise(x => setTimeout(x, config.COOLDOWN_PER_USER));
            cooldown_users.delete(id);
        })();
    }
})

client.on('messageUpdate', (old_msg, new_msg) => {
    if (!supress_embeds.has(new_msg.id))
        return;

    //if one or more embeds appeared in this message update
    if (!old_msg.embeds.length && new_msg.embeds.length)
    {
        if (new_msg.guild.me.permissionsIn(new_msg.channel).has('ManageMessages'))
            new_msg.suppressEmbeds().catch(console.error);
        supress_embeds.delete(new_msg.id);
    }
});

async function get_tiktok_url(url)
{
    let browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://musicaldown.com/en/', { waitUntil: "domcontentloaded" });
    await page.evaluate((url) => {
        document.getElementsByClassName('input-field col s12')[0].children[0].value = url;
        document.getElementsByClassName('input-field col s12')[1].children[0].click();
    }, url);
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    let direct_url = await page.evaluate(() => {
        for (let elem of document.getElementsByClassName('btn'))
            if (elem.innerText.includes('[HD]') || elem.innerText.includes('DIRECT LINK'))
                return elem.href;
    });
    await browser.close();
    return direct_url;
}

function is_too_large_attachment(guild, stream) {
    let limit = 0;
    if (!guild)
        limit = filesizeLimit.default;
    else {
        switch (guild.premiumTier) {
            default:
            case 1:
                limit = filesizeLimit.default;
                break;
            case 2:
                limit = filesizeLimit.tier2;
                break;
            case 3:
                limit = filesizeLimit.tier3;
                break;
        }
    }
    return stream.data.length >= limit;
}

function report_error(msg, error) {
    msg.reply({ content: `Error on trying to download this TikTok:\n\`${error}\``, allowedMentions: { repliedUser: false } }).catch(console.error);
}

function report_filesize_error(msg) {
    msg.reply({content: 'This TikTok exceeds the file size limit Discord allows :*(', allowedMentions: {repliedUser: false}}).catch(console.error);
}

client.login(config.TOKEN).then(() => console.log('Connected as ' + client.user.tag)).catch(console.error);
