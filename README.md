# Tiktok To Discord
A Discord bot to automatically download and post the raw video file behind a TikTok link.  

Discord doesn't embed TikTok video links at all, this removes the huge annoyance of having to open the link in your web browser to view the video.  
![Demonstration](https://i.imgur.com/k4DlynO.gif)  

---

Now ~~temporarily~~ also embeds Twitter videos ~~since Discord managed to break that.  
I'm sure it'll be fixed, so this will get removed then.~~  
This is now fixed, but the default Twitter video player is such trash that I'm keeping this feature in here. With this feature you can straight away get max quality playback instead of being stuck with the very low quality version that the Twitter player will give you.  
Set `config.EMBED_TWITTER_VIDEO` to enabled this.

## Getting  Started

### Dependencies

* [NodeJS](https://nodejs.org/en/)
* [discord.js](https://github.com/discordjs/discord.js)
* [yt-dlp](https://github.com/yt-dlp/yt-dlp)
* [gallery-dl](https://github.com/mikf/gallery-dl)  
(if you enable embedding Twitter videos, disabled by default)

### Installing

* Install [NodeJS](https://nodejs.org/en/) via whatever method is appropriate for your platform.
  * Follow discord.js' requirements for the required NodeJS version.
* Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) preferably by having it in PATH
  * Alternatively, you can set `config.YT_DLP_PATH` to the path of the yt-dlp executable
  * E.g. download the latest yt-dlp release from [here](https://github.com/yt-dlp/yt-dlp#release-files) and say you
    were to place the executable in same path as this README, you would set `config.YT_DLP_PATH` to `./yt-dlp`
  * On Linux you might also need to `chmod +x yt-dlp` to make it executable
* Clone this repository
`git clone https://github.com/0x464e/tiktok_to_discord`
* Insert your Discord bot's token into `config.json` 
* Install the required Node packages from `package.json` by running `npm install`
---
For embedding Twitter video:
* Install [gallery-dl](https://github.com/mikf/gallery-dl) via whatever you prefer, read their instructions  
* Ensure `gallery-dl` is found in PATH

### Executing the application

* Run `node index.js` and enjoy.

### Usage
The bot parses links from any message it can see, if TikTok link(s) are found, up to `config.MAX_TIKTOKS_PER_MESSAGE` TikToks are attempted to be downloaded.  
Each user receives a `config.COOLDOWN_PER_USER` ms cooldown after attempting to download a TikTok.  
If a TikTok is too large to be uploaded in your channel, the TikTok can be mirrored from a higher file size limit guild by specifying a channel id to a boosted guild's channel in `config.BOOSTED_CHANNEL_ID`. Granted, of course, that the bot has permissions to send files in that channel.
