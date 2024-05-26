const { Wallet } = require('./database');  // Import the Wallet model
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

// Initialize Solana connection
const connection = new Connection('https://api.mainnet-beta.solana.com');

async function listPrivateKeys() {
    try {
        // Create "exports" folder if it doesn't exist
        const exportsDir = path.join(__dirname, 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir);
        }

        // Generate file name based on current date and time
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(exportsDir, `private-keys-${timestamp}.txt`);

        // Fetch all wallet records from the database
        const wallets = await Wallet.findAll();

        // Write to file
        const writeStream = fs.createWriteStream(filePath);
        writeStream.write('Private Keys and Balances:\n');
        writeStream.write('---------------------------\n');

        // Iterate over each wallet
        for (const wallet of wallets) {
            // Decode the private key bytes
            const privateKeyBytes = new Uint8Array(JSON.parse(`[${wallet.privateKey}]`));
            // Encode the private key in Base58
            const privateKeyBase58 = bs58.encode(privateKeyBytes);

            // Fetch the wallet balance
            const publicKey = new PublicKey(wallet.address);
            const balance = await connection.getBalance(publicKey);
            const balanceInSol = balance / LAMPORTS_PER_SOL;

            // Write the private key and balance to the file
            writeStream.write(`Private Key: ${privateKeyBase58}, BAL: ${balanceInSol.toFixed(2)} SOL\n`);
            writeStream.write('---------------------------\n');
        }

        writeStream.end();
        console.log(`Private keys and balances exported to ${filePath}`);
    } catch (error) {
        console.error('Error fetching wallets:', error);
    }
}

listPrivateKeys();
