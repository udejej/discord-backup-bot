const Discord = require('discord.js');
const client = new Discord.Client();
const { token, sourceServerId, targetServerId } = require('./config.json');

client.login(token);

client.on('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    const sourceServer = client.guilds.cache.get(sourceServerId);
    const targetServer = client.guilds.cache.get(targetServerId);

    if (!sourceServer || !targetServer) {
        console.error('Serveur source ou cible introuvable.');
        return;
    }

    // Backup des canaux
    sourceServer.channels.cache.forEach(async (channel) => {
        if (channel.type === 'text') {
            await targetServer.channels.create(channel.name, { type: 'text' });
        } else if (channel.type === 'voice') {
            await targetServer.channels.create(channel.name, { type: 'voice' });
        }
    });

    // Backup des rôles
    sourceServer.roles.cache.forEach(async (role) => {
        if (role.name !== '@everyone') {
            await targetServer.roles.create({ data: { name: role.name, color: role.color } });
        }
    });

    console.log('Backup terminé.');
    client.destroy();
});
