const Discord = require('discord.js-selfbot-v13');
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

// Bot client pour les slash commands
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Client selfbot pour utiliser ton compte
const userClient = new Discord.Client();

bot.on('ready', () => {
    console.log(`Bot connecté: ${bot.user.tag}`);
});

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'copyserver') {
        const sourceId = interaction.options.getString('source');
        const targetId = interaction.options.getString('destination');
        const userToken = interaction.options.getString('token');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Connexion avec le token utilisateur
            await userClient.login(userToken);

            const sourceGuild = await userClient.guilds.fetch(sourceId);
            const targetGuild = await userClient.guilds.fetch(targetId);

            // Création de la backup
            const backup = {
                name: sourceGuild.name,
                icon: sourceGuild.iconURL(),
                roles: [],
                channels: [],
                emojis: []
            };

            // Backup des rôles
            sourceGuild.roles.cache.forEach(role => {
                if (role.id === sourceGuild.id) return;
                backup.roles.push({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    permissions: role.permissions.bitfield,
                    mentionable: role.mentionable,
                    position: role.position
                });
            });

            // Backup des salons
            sourceGuild.channels.cache.forEach(channel => {
                backup.channels.push({
                    name: channel.name,
                    type: channel.type,
                    position: channel.position,
                    parent: channel.parent ? channel.parent.name : null,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(perm => ({
                        id: perm.id,
                        type: perm.type,
                        deny: perm.deny.bitfield,
                        allow: perm.allow.bitfield
                    }))
                });
            });

            // Nettoyage du serveur cible
            await Promise.all(targetGuild.roles.cache.map(role => 
                role.deletable ? role.delete() : null
            ));
            await Promise.all(targetGuild.channels.cache.map(channel => 
                channel.deletable ? channel.delete() : null
            ));

            // Restauration des rôles
            for (const role of backup.roles.reverse()) {
                await targetGuild.roles.create({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    permissions: BigInt(role.permissions),
                    mentionable: role.mentionable
                }).catch(() => {});
            }

            // Restauration des catégories
            for (const channel of backup.channels.filter(ch => ch.type === 'GUILD_CATEGORY')) {
                await targetGuild.channels.create(channel.name, {
                    type: 'GUILD_CATEGORY',
                    position: channel.position
                }).catch(() => {});
            }

            // Restauration des autres salons
            for (const channel of backup.channels.filter(ch => ch.type !== 'GUILD_CATEGORY')) {
                const parent = targetGuild.channels.cache.find(ch => ch.name === channel.parent);
                await targetGuild.channels.create(channel.name, {
                    type: channel.type,
                    parent: parent ? parent.id : null
                }).catch(() => {});
            }

            await interaction.editReply({ content: 'Copie du serveur terminée avec succès!', ephemeral: true });
            
            // Déconnexion du compte utilisateur
            userClient.destroy();

        } catch (error) {
            await interaction.editReply({ content: 'Une erreur est survenue pendant la copie.', ephemeral: true });
            console.error(error);
        }
    }
});

// Commande slash
const commands = [{
    name: 'copyserver',
    description: 'Copie un serveur vers un autre',
    options: [
        {
            name: 'source',
            description: 'ID du serveur source',
            type: 3,
            required: true
        },
        {
            name: 'destination',
            description: 'ID du serveur destination',
            type: 3,
            required: true
        },
        {
            name: 'token',
            description: 'Token utilisateur',
            type: 3,
            required: true
        }
    ]
}];

bot.once('ready', async () => {
    await bot.application.commands.set(commands);
});

bot.login(process.env.BOT_TOKEN);
