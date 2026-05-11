"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDC_DECIMALS = exports.USDC_DEVNET = exports.DEFAULT_PROGRAM_ID = void 0;
exports.findTeamPda = findTeamPda;
exports.findVaultPda = findVaultPda;
exports.findMemberPda = findMemberPda;
exports.findMilestonePda = findMilestonePda;
exports.findReceiptPda = findReceiptPda;
exports.formatUsdc = formatUsdc;
const web3_js_1 = require("@solana/web3.js");
exports.DEFAULT_PROGRAM_ID = new web3_js_1.PublicKey("8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo");
exports.USDC_DEVNET = new web3_js_1.PublicKey("2PoHEJR4wmF9zbeiUDobjo786F7ny3Vv6ivBX7FPJHZj");
exports.USDC_DECIMALS = 6;
function findTeamPda(creator, programId = exports.DEFAULT_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("team"), creator.toBuffer()], programId);
}
function findVaultPda(team, programId = exports.DEFAULT_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("vault"), team.toBuffer()], programId);
}
function findMemberPda(team, wallet, programId = exports.DEFAULT_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("member"), team.toBuffer(), wallet.toBuffer()], programId);
}
function findMilestonePda(team, member, paymentCount, programId = exports.DEFAULT_PROGRAM_ID) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(paymentCount));
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("milestone"), team.toBuffer(), member.toBuffer(), buf], programId);
}
function findReceiptPda(team, paymentCount, programId = exports.DEFAULT_PROGRAM_ID) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(paymentCount));
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("receipt"), team.toBuffer(), buf], programId);
}
function formatUsdc(rawAmount) {
    return `$${(rawAmount / 10 ** exports.USDC_DECIMALS).toFixed(2)}`;
}
//# sourceMappingURL=pda.js.map