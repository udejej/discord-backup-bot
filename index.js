const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Créer une backup d\'un serveur')
        .addStringOption(option =>
            option.setName('source_guild_id')
                .setDescription('ID du serveur à copier')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('destination_guild_id')
                .setDescription('ID du serveur de destination')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('user_token')
                .setDescription('Token utilisateur')
                .setRequired(true))
];

client.once('ready', async () => {
    console.log(`Bot connecté: ${client.user.tag}`);
    await client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'backup') {
        await interaction.deferReply({ ephemeral: true });
        
        const sourceGuildId = interaction.options.getString('source_guild_id');
        const destGuildId = interaction.options.getString('destination_guild_id');
        const userToken = interaction.options.getString('user_token');

        const userClient = new Client({ 
            intents: [GatewayIntentBits.Guilds],
            rest: {
                headers: {
                    authorization: userToken
                }
            }
        });

        try {
            await userClient.login(userToken);
            
            const sourceGuild = await userClient.guilds.fetch(sourceGuildId).catch(() => null);
            const destGuild = await userClient.guilds.fetch(destGuildId).catch(() => null);

            if (!sourceGuild || !destGuild) {
                await interaction.editReply('❌ Impossible de trouver un des serveurs. Vérifiez les IDs.');
                return;
            }

            await interaction.editReply('✅ Connexion établie, début de la backup...');

            // Backup des rôles
            const roles = await sourceGuild.roles.fetch();
            for (const [_, role] of roles.filter(r => !r.managed && r.name !== '@everyone')) {
                try {
                    await destGuild.roles.create({
                        name: role.name,
                        color: role.color,
                        hoist: role.hoist,
                        permissions: role.permissions,
                        mentionable: role.mentionable,
                        position: role.position
                    });
                } catch (e) {
                    console.error(`Erreur création rôle ${role.name}:`, e);
                }
            }
            await interaction.followUp({ content: '✅ Rôles copiés', ephemeral: true });

            // Backup des catégories et canaux
            const categories = sourceGuild.channels.cache.filter(c => c.type === 4);
            for (const [_, category] of categories) {
                try {
                    const newCategory = await destGuild.channels.create({
                        name: category.name,
                        type: 4,
                        position: category.position
                    });

                    const channels = sourceGuild.channels.cache.filter(c => c.parentId === category.id);
                    for (const [_, channel] of channels) {
                        await destGuild.channels.create({
                            name: channel.name,
                            type: channel.type,
                            parent: newCategory.id,
                            position: channel.position,
                            topic: channel.topic,
                            nsfw: channel.nsfw,
                            bitrate: channel.bitrate,
                            userLimit: channel.userLimit,
                            rateLimitPerUser: channel.rateLimitPerUser
                        });
                    }
                } catch (e) {
                    console.error(`Erreur création catégorie ${category.name}:`, e);
                }
            }
            await interaction.followUp({ content: '✅ Canaux copiés', ephemeral: true });

            // Backup des émojis
            const emojis = await sourceGuild.emojis.fetch();
            for (const [_, emoji] of emojis) {
                try {
                    await destGuild.emojis.create({
                        attachment: emoji.url,
                        name: emoji.name
                    });
                } catch (e) {
                    console.error(`Erreur création emoji ${emoji.name}:`, e);
                }
            }
            await interaction.followUp({ content: '✅ Émojis copiés', ephemeral: true });

            await interaction.followUp({ content: '✅ Backup terminée avec succès!', ephemeral: true });

        } catch (error) {
            console.error('Erreur principale:', error);
            await interaction.followUp({ 
                content: `❌ Erreur: ${error.message}\nVérifiez que le token est valide et que les permissions sont correctes.`, 
                ephemeral: true 
            });
        } finally {
            userClient.destroy();
        }
    }
});

client.login(process.env.BOT_TOKEN);
