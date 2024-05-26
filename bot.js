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
    ctx.replyWithMarkdown(`Send 0.1 SOL to the address below in order to gain access to the paid group\n[${address}](tg://msg?text=${address})`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Check Payment ✅", callback_data: `check_payment_${address}` }]
            ]
        }
    });
});

bot.command('invite', async (ctx) => {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const privateKey = keypair.secretKey.toString();

    // Save the wallet information to the database
    await Wallet.create({
        address: address,
        privateKey: privateKey,
    });

    ctx.replyWithMarkdown(`Send 0.1 SOL to the address below in order to gain access to the paid group\n[${address}](tg://msg?text=${address})`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Check Payment ✅", callback_data: `check_payment_${address}` }]
            ]
        }
    });
});

bot.action(/check_payment_(.+)/, async (ctx) => {
    const address = ctx.match[1];

    // Fetch the wallet information from the database
    const wallet = await Wallet.findOne({ where: { address: address } });

    // Check if the payment has already been verified
    if (wallet.verified) {
        ctx.reply(`Payment already verified. An invite link has already been generated for this address.`);
        return;
    }

    // Check the wallet balance
    const balance = await connection.getBalance(new PublicKey(address));
    if (balance >= 0.1 * LAMPORTS_PER_SOL) {
        try {
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
        } catch (error) {
            console.error('Failed to generate invite link:', error);
            ctx.reply(`Payment received, but failed to generate invite link. Please contact support.`);
        }
    } else {
        ctx.reply(`Payment not received yet. Please try again later.`);
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