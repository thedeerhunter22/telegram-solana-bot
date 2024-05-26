require('dotenv').config();  // Load environment variables from .env file

const { Telegraf } = require('telegraf');
const { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const express = require('express');
const { Wallet } = require('./database');

console.log(`Bot token: ${process.env.TELEGRAM_BOT_API_TOKEN}`);  // Log the token to verify

// Telegram Bot Token
const bot = new Telegraf(process.env.TELEGRAM_BOT_API_TOKEN);

// Solana Setup
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Express server for webhook (if needed)
const app = express();
app.use(express.json());

const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;  // Your group chat ID

bot.start(async (ctx) => {
    try {
        // Generate a new Solana wallet
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        const privateKey = keypair.secretKey.toString();

        // Save the wallet information to the database
        await Wallet.create({
            address: address,
            privateKey: privateKey,
        });

        // Send the payment instruction message directly
        ctx.reply(`Send 0.1 SOL to the address below in order to gain access to the paid group\n\`${address}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Check Payment ✅", callback_data: `check_payment_${address}` }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in /start handler:', error);
        ctx.reply('An error occurred while generating the wallet. Please try again later.');
    }
});

bot.command('invite', async (ctx) => {
    try {
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        const privateKey = keypair.secretKey.toString();

        // Save the wallet information to the database
        await Wallet.create({
            address: address,
            privateKey: privateKey,
        });

        ctx.reply(`Send 0.1 SOL to the address below in order to gain access to the paid group\n\`${address}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Check Payment ✅", callback_data: `check_payment_${address}` }]
                ]
            }
        });
    } catch (error) {
        console.error('Error in /invite handler:', error);
        ctx.reply('An error occurred while generating the wallet. Please try again later.');
    }
});

bot.action(/check_payment_(.+)/, async (ctx) => {
    const address = ctx.match[1];

    try {
        // Fetch the wallet information from the database
        const wallet = await Wallet.findOne({ where: { address: address } });

        if (!wallet) {
            ctx.reply('Wallet not found. Please start the process again.');
            return;
        }

        // Check if the payment has already been verified
        if (wallet.verified) {
            ctx.reply('Payment already verified. An invite link has already been generated for this address.');
            return;
        }

        // Check the wallet balance
        const balance = await connection.getBalance(new PublicKey(address));
        if (balance >= 0.1 * LAMPORTS_PER_SOL) {
            // Fetch the recent transactions for the wallet
            const confirmedSignatures = await connection.getConfirmedSignaturesForAddress2(new PublicKey(address), { limit: 1 });
            const signature = confirmedSignatures[0]?.signature;
            const solscanLink = `https://solscan.io/tx/${signature}`;

            // Generate a unique invite link
            const inviteLink = await bot.telegram.createChatInviteLink(GROUP_CHAT_ID, {
                expire_date: Math.floor(Date.now() / 1000) + 3600,  // Link expires in 1 hour
                member_limit: 1  // The link can be used by only one person
            });

            // Mark the payment as verified
            wallet.verified = true;
            await wallet.save();

            // Send the SolScan link and invite link
            ctx.reply(`Payment received! Here is the transaction link: ${solscanLink}`);
            ctx.reply(`Here is your invite link: ${inviteLink.invite_link}`);
        } else {
            ctx.reply('Payment not received yet. Please try again later.');
        }
    } catch (error) {
        console.error('Error in check_payment handler:', error);
        ctx.reply('An error occurred while checking the payment. Please try again later.');
    }
});

bot.launch();

// Optional: Set up a webhook if you're not using long polling
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3002;  // Change to a different port if needed
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
