import { EmbedBuilder, GuildPremiumTier, MessageFlags } from 'discord.js';
import { db } from '../../../db/postgres.ts';
import type { ChatInputCommandCallback } from '../../chatInputCommandHandler.ts';
import { EmbedColor, EmbedIcon, replyError } from '../../lib/embeds.ts';

export const command: ChatInputCommandCallback = {
    callback: async (interaction) => {
        const { guild } = interaction;
        if (guild.premiumTier === GuildPremiumTier.None || guild.premiumTier === GuildPremiumTier.Tier1) {
            replyError(interaction, { description: 'The banner feature requires a boost level of 2.' });
            return;
        }

        const currentBannerProject = await db.query.project.findFirst({
            columns: {
                channelId: true,
            },
            where: { bannerLastTimestamp: { isNotNull: true } },
            orderBy: { bannerLastTimestamp: 'desc' },
        });

        const banner = guild.bannerURL({ size: 1024 });
        if (!currentBannerProject || !banner) {
            replyError(interaction, { description: 'There is no banner at the moment.' });
            return;
        }

        interaction.reply({
            embeds: [
                new EmbedBuilder({
                    color: EmbedColor.Blue,
                    author: {
                        iconURL: EmbedIcon.Info,
                        name: 'Current Banner',
                    },
                    description: `The current banner was submitted by <#${currentBannerProject.channelId}>.`,
                    image: {
                        url: banner,
                    },
                }),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
