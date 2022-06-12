const fs = require("fs");
const {resolve} = require("path");
const {Client, Intents, Permissions} = require('discord.js');
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS], partials: ['MESSAGE', 'REACTION']});

const version = require('./package.json').version;

const bot_token = process.env['bot_token'];
const bot_uid = process.env['bot_uid'];

const prefixList = ['!menf ']
const channel_file = 'watched_channels.json';
let watched_channels = [];

loadChannels();

client.login(bot_token)
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

client.on('messageCreate', message => {
    handleMessage(message);
});
client.on('messageReactionAdd', reaction => {
    handleReaction(reaction)
        .catch(error => console.error("Error handling reaction:", error));
});
client.on('ready', () => {
   console.log('Connected!');
   updateActivity();
   // Set activity status once, then every hour
   setInterval(function() {
       updateActivity();
   }, 3600000)
});

function handleMessage(message) {
    if(message.author.id !== bot_uid) {
        if(watched_channels.includes(message.channel.id)) {
            //delete if more than one attachment
            if(countAllAttachments(message) > 1 && !isMod(message)) {
                message.delete().catch(console.error);
                message.channel.send(`<@${message.author.id}> You can only send one meme at a time`).catch(console.error);
            }else if(countAllAttachments(message) === 1) {
                handleMedia(message)
            }
        }
        if(hasPrefix(message.content)) {
            handleCommand(message);
        }
    }
}

function handleMedia(message) {
    if(message.attachments.size === 1) {
        let attachment = message.attachments.values().next().value;
        if(attachment.contentType.includes('video/')) {
            // Video checks
            if(attachment.height !== null && attachment.width !== null) {
                // Resolution check
                if(attachment.height * attachment.width < 100000) {
                    message.reply(`Bruv what a blurry meme`).catch(console.error);
                }
            }
        }else if(attachment.contentType.includes('image/')) {
            // Image checks
            if(attachment.height !== null && attachment.width !== null) {
                //console.log(attachment.height * attachment.width);
            }
        }
    }else if(message.embeds.length === 1) {

    }
}

async function handleReaction(reaction) {
    // Only handle reactions in watched channels
    if(watched_channels.includes(reaction.message.channelId)) {
        // Retrieve old messages if they aren't loaded
        if(reaction.partial) {
            try {
                await reaction.fetch();
            }catch (error) {
                console.error("Error fetching message: ", error);
                return;
            }
        }
        // Only remove reactions on messages sent from the bot
        if(reaction.message.author.id === String(bot_uid)) {
            console.log(reaction);
            reaction.message.reactions.removeAll()
                .catch(error => console.error("Failed to remove reactions: ", error));
        }
    }
}

function countAllAttachments(message) {
    let attachments = message.attachments.size;
    let links       = countLinks(message);
    return attachments + links;
}

function countLinks(message) {
    const re = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g
    return ((message.content || '').match(re) || []).length;
}

function isMod(message) {
    if(message.inGuild()) {
        let mod = false;
        try {
            mod = message.member.permissions.has([Permissions.FLAGS.MANAGE_MESSAGES, true]);
        } catch {}
        return mod;
    }else {
        return false;
    }
}

function handleCommand(message) {
    // Check if user is mod
    if(isMod(message)) {
        const args = message.content.split(' ');
        if(args.length === 2 || args.length === 3) {
            switch(args[1]) {
                case 'watch':
                    if(args.length === 2) {
                        watch(message.channel.id, message);
                    }else {
                        watch(parseChannelId(args[2], message), message);
                    }
                    break;
                case 'unwatch':
                    // unwatch channel
                    if(args.length === 2) {
                        unwatch(message.channel.id, message);
                    }else {
                        unwatch(parseChannelId(args[2], message), message);
                    }
                    break;
                default:
                    message.reply('Unknown command').catch(console.error);
                    break;
            }
        }else {
            message.reply('Invalid number of arguments').catch(console.error);
        }
    }else {
        message.delete().catch(console.error);
    }
}

function parseChannelId(string, message) {
    if(!string || !message) {
        return;
    }
    if(string.startsWith('<#') && string.endsWith('>')) {
        string = string.slice(2, -1);
    }
    let channelId, guildId;
    try {
        channelId = client.channels.cache.get(string).id;
        guildId = client.channels.cache.get(string).guildId;
    }catch (error) {
        console.error("Unknown channel / guild: ", error);
        return;
    }
    if(typeof channelId !== 'undefined' && message.guildId === guildId) {
        return channelId;
    }
}

function watch(channel, message) {
    if(channel !== undefined) {
        if(!watched_channels.includes(channel)) {
            watched_channels.push(channel);
            saveChannels();
            message.reply("Channel added to watchlist").catch(console.error);
        }else {
            message.reply("Channel is already on the watchlist").catch(console.error);
        }
    }else {
        message.reply("Undefined channel").catch(console.error);
    }
}

function unwatch(channel, message) {
    if(channel !== undefined) {
        const index = watched_channels.indexOf(channel);
        if(index > -1) {
            watched_channels.splice(index, 1);
            saveChannels();
            message.reply("Channel removed from watchlist").catch(console.error);
        }else {
            message.reply("Channel not found in watchlist").catch(console.error);
        }
    }else {
        message.reply("Undefined channel").catch(console.error);
    }
}

function loadChannels() {
    let jsonString = "";
    try {
        jsonString = fs.readFileSync(resolve(__dirname, channel_file), "utf8");
        try {
            watched_channels = JSON.parse(jsonString);
        } catch {
            console.error("Error parsing channels");
        }
    }catch (error) {
        // Create file if not found
        if(error.code === 'ENOENT') {
            console.log("File not found, creating...");
            fs.writeFileSync(resolve(__dirname, channel_file), JSON.stringify( [] ), "utf8");
        }else {
            console.error("Error reading channels");
        }
    }
}

function saveChannels() {
    fs.writeFileSync(resolve(__dirname, channel_file), JSON.stringify( watched_channels ), "utf8");
    updateActivity();
}

function updateActivity() {
    client.user.setActivity(`${watched_channels.length} channel${watched_channels.length === 1 ? "":"s"} || VER${version}`, {
        type: "WATCHING"
    });
}

// https://stackoverflow.com/questions/63264290/discord-js-how-to-use-bot-mention-and-a-set-prefix-as-prefixes
function hasPrefix(str) {
    for(let pre of prefixList)
        if(str.startsWith(pre))
            return true;
    return false;
}