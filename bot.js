const fs = require("fs");
const {resolve} = require("path");
const {Client, Intents, Permissions} = require('discord.js');
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES], partials: ['MESSAGE']});

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

function handleMessage(message) {
    if(message.author.id !== bot_uid) {
        if(watched_channels.includes(message.channel.id)) {
            //delete if more than one attachment
            if(message.attachments.size > 1 && !isMod(message)) {
                message.delete().catch(console.error);
                message.channel.send(`<@${message.author.id}> You can only send one attachment at a time`);
            }
        }
        if(hasPrefix(message.content)) {
            handleCommand(message);
        }
    }
}

function isMod(message) {
    if(!message.guild) {
        return false;
    }
    let mod = false;
    try {
        mod = message.member.permissions.has([Permissions.FLAGS.MANAGE_MESSAGES, true]);
    } catch {}
    return mod;
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
                        watch(parseChannelId(args[2]), message);
                    }
                    break;
                case 'unwatch':
                    // unwatch channel
                    if(args.length === 2) {
                        unwatch(message.channel.id, message);
                    }else {
                        unwatch(parseChannelId(args[2]), message);
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

function parseChannelId(string) {
    if(!string) {
        return;
    }
    if(string.startsWith('<#') && string.endsWith('>')) {
        string = string.slice(2, -1);
        return client.channels.cache.get(string).id;
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
}

// https://stackoverflow.com/questions/63264290/discord-js-how-to-use-bot-mention-and-a-set-prefix-as-prefixes
function hasPrefix(str) {
    for(let pre of prefixList)
        if(str.startsWith(pre))
            return true;
    return false;
}