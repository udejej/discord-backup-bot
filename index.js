const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.MessageContent
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
    try {
        await client.application.commands.set(commands);
        console.log('Commandes slash enregistrées avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'backup') {
        await interaction.deferReply({ ephemeral: true });
        
        const sourceGuildId = interaction.options.getString('source_guild_id');
        const destGuildId = interaction.options.getString('destination_guild_id');
        const userToken = interaction.options.getString('user_token');

        const userClient = new Client({
            checkUpdate: false,
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildEmojisAndStickers
            ],
            rest: {
                api: "https://discord.com/api/v10",
                version: "10",
                headers: {
                    "Authorization": userToken,
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            }
        });

        try {
            await userClient.login(userToken, { type: "user" });
            
            const sourceGuild = await userClient.guilds.fetch(sourceGuildId);
            const destGuild = await userClient.guilds.fetch(destGuildId);

            if (!sourceGuild || !destGuild) {
                throw new Error('Un des serveurs n\'a pas été trouvé');
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
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    console.log(`Rôle ${role.name} ignoré:`, e.message);
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
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const channels = sourceGuild.channels.cache.filter(c => c.parentId === category.id);
                    for (const [_, channel] of channels) {
                        await destGuild.channels.create({
                            name: channel.name,
                            type: channel.type,
                            parent: newCategory.id,
                            topic: channel.topic,
                            nsfw: channel.nsfw,
                            bitrate: channel.bitrate,
                            userLimit: channel.userLimit,
                            position: channel.position,
                            rateLimitPerUser: channel.rateLimitPerUser
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (e) {
                    console.log(`Catégorie ${category.name} ignorée:`, e.message);
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
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    console.log(`Emoji ${emoji.name} ignoré:`, e.message);
                }
            }
            await interaction.followUp({ content: '✅ Émojis copiés', ephemeral: true });
            await interaction.followUp({ content: '✅ Backup terminée avec succès!', ephemeral: true });

        } catch (error) {
            console.error('Erreur détaillée:', error);
            await interaction.followUp({ 
                content: `❌ Erreur lors de la backup: ${error.message}`, 
                ephemeral: true 
            });
        } finally {
            userClient.destroy();
        }
    }
});

client.login(process.env.BOT_TOKEN);
