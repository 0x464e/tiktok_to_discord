# Tiktok To Discord
A Discord bot to automatically download and post the raw video file behind a TikTok link.  
Discord doesn't embed TikTok video links at all, this removes the huge annoyance of having to open the link in your web browser to view the video.  
![Demonstration](https://i.imgur.com/k4DlynO.gif)  
This is my first *larger* js/nodejs project, so please excuse possible bad code/implementations.

---

Now ~~temporarily~~ also embeds Twitter videos ~~since Discord managed to break that.  
I'm sure it'll be fixed, so this will get removed then.~~  
This is now fixed, but the default Twitter video player is such trash that I'm keeping this feature in here. With this feature you can straight away get max quality playback instead of being stuck with the very low quality version that the Twitter player will give you.  
Set `config.EMBED_TWITTER_VIDEO` to enabled this.

## Getting  Started

### Dependencies

* [NodeJS](https://nodejs.org/en/)
* [discord.js](https://github.com/discordjs/discord.js)
* [tiktok-scraper](https://github.com/drawrowfly/tiktok-scraper)  
(TikTok doesn't offer an API or any official way to get videos, so this project relies on this awesome scraper being maintained)
* [gallery-dl](https://github.com/mikf/gallery-dl)  
(if you enable embedding Twitter videos, disabled by default)

### Installing

* Install [NodeJS](https://nodejs.org/en/) via whatever method is appropriate for your platform.
  * Follow discord.js' requirements for the required NodeJS version.
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
Information about the usage is stored to `config.DB_PATH` json file, if not disabled via `config.USE_DATABASE`.  
Each user receives a `config.COOLDOWN_PER_USER` ms cooldown after attempting to download a TikTok.  
If a TikTok is too large to be uploaded in your channel, the TikTok can be mirrored from a higher file size limit guild by specifying a channel id to a boosted guild's channel in `config.BOOSTED_CHANNEL_ID`. Granted, of course, that the bot has permissions to send files in that channel.

### Maintenance
As mentioned above, there is no official way to download TikToks, so the method used to download may break at any time. In such event, keep your eyes peeled at [tiktok-scraper](https://github.com/drawrowfly/tiktok-scraper) and update the node package after the scraper receives an update.
If the scraper's update requires something to be rewritten in `index.js`, pull the changes from here after I make them (assuming I haven't abandoned this project by then) or fix it yourself and submit a pull request. I'll be happy to accept any reasonable PRs.
