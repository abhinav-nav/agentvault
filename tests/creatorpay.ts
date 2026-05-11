import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Creatorpay } from "../target/types/creatorpay";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("creatorpay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.creatorpay as Program<Creatorpay>;

  const creator = provider.wallet;

  // Contributors (simulating non-crypto-native team members with embedded wallets)
  const editor = anchor.web3.Keypair.generate(); // "Video editor in Manila"
  const designer = anchor.web3.Keypair.generate(); // "Thumbnail designer in Lagos"

  let mint: anchor.web3.PublicKey;
  let creatorTokenAccount: anchor.web3.PublicKey;
  let editorTokenAccount: anchor.web3.PublicKey;
  let designerTokenAccount: anchor.web3.PublicKey;
  let teamPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let editorMemberPda: anchor.web3.PublicKey;
  let designerMemberPda: anchor.web3.PublicKey;

  const USDC_DECIMALS = 6;
  const INITIAL_FUNDING = 10_000 * 10 ** USDC_DECIMALS; // 10,000 USDC
  const EDITOR_RATE = 150 * 10 ** USDC_DECIMALS; // $150 per video edit
  const DESIGNER_RATE = 50 * 10 ** USDC_DECIMALS; // $50 per thumbnail batch

  before(async () => {
    // Airdrop SOL to contributors for rent
    const airdropEditor = await provider.connection.requestAirdrop(
      editor.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropEditor);

    const airdropDesigner = await provider.connection.requestAirdrop(
      designer.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropDesigner);

    // Create mock USDC mint
    mint = await createMint(
      provider.connection,
      (creator as any).payer,
      creator.publicKey,
      null,
      USDC_DECIMALS
    );

    // Create token accounts
    creatorTokenAccount = await createAccount(
      provider.connection,
      (creator as any).payer,
      mint,
      creator.publicKey
    );

    editorTokenAccount = await createAccount(
      provider.connection,
      (creator as any).payer,
      mint,
      editor.publicKey
    );

    designerTokenAccount = await createAccount(
      provider.connection,
      (creator as any).payer,
      mint,
      designer.publicKey
    );

    // Mint mock USDC to creator (simulating a funded creator treasury)
    await mintTo(
      provider.connection,
      (creator as any).payer,
      mint,
      creatorTokenAccount,
      creator.publicKey,
      INITIAL_FUNDING
    );

    // Derive PDAs
    [teamPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("team"), creator.publicKey.toBuffer()],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), teamPda.toBuffer()],
      program.programId
    );

    [editorMemberPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("member"),
        teamPda.toBuffer(),
        editor.publicKey.toBuffer(),
      ],
      program.programId
    );

    [designerMemberPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("member"),
        teamPda.toBuffer(),
        designer.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  it("Creates a creator team with USDC treasury vault", async () => {
    await program.methods
      .createTeam("Ali Abdaal's Production Team")
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        mint: mint,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const team = await program.account.team.fetch(teamPda);
    assert.equal(team.name, "Ali Abdaal's Production Team");
    assert.equal(team.memberCount, 0);
    assert.equal(team.totalDisbursed.toNumber(), 0);
    console.log("  ✅ Team created:", team.name);
  });

  it("Adds video editor (Manila) to the team", async () => {
    await program.methods
      .addMember(editor.publicKey, "Video Editor", new anchor.BN(EDITOR_RATE))
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: editorMemberPda,
        authority: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const member = await program.account.member.fetch(editorMemberPda);
    assert.equal(member.role, "Video Editor");
    assert.equal(member.ratePerDelivery.toNumber(), EDITOR_RATE);
    assert.equal(member.isActive, true);

    const team = await program.account.team.fetch(teamPda);
    assert.equal(team.memberCount, 1);
    console.log("  ✅ Video Editor added — rate: $150/video");
  });

  it("Adds thumbnail designer (Lagos) to the team", async () => {
    await program.methods
      .addMember(
        designer.publicKey,
        "Thumbnail Designer",
        new anchor.BN(DESIGNER_RATE)
      )
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: designerMemberPda,
        authority: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const member = await program.account.member.fetch(designerMemberPda);
    assert.equal(member.role, "Thumbnail Designer");
    assert.equal(member.isActive, true);

    const team = await program.account.team.fetch(teamPda);
    assert.equal(team.memberCount, 2);
    console.log("  ✅ Thumbnail Designer added — rate: $50/batch");
  });

  it("Funds the team treasury with 10,000 USDC", async () => {
    await program.methods
      .fundVault(new anchor.BN(INITIAL_FUNDING))
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        vault: vaultPda,
        creatorTokenAccount: creatorTokenAccount,
        authority: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultAccount = await getAccount(provider.connection, vaultPda);
    assert.equal(Number(vaultAccount.amount), INITIAL_FUNDING);
    console.log("  ✅ Treasury funded: $10,000 USDC");
  });

  it("Creates a milestone: 'Edit YouTube ep. 47'", async () => {
    const team = await program.account.team.fetch(teamPda);
    const paymentCount = team.paymentCount;

    const [milestonePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("milestone"),
        teamPda.toBuffer(),
        editorMemberPda.toBuffer(),
        paymentCount.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 1 week

    await program.methods
      .createMilestone(
        "Edit YouTube ep. 47 — final cut with color grade",
        new anchor.BN(EDITOR_RATE),
        new anchor.BN(deadline)
      )
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: editorMemberPda,
        milestone: milestonePda,
        authority: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const milestone = await program.account.milestone.fetch(milestonePda);
    assert.equal(
      milestone.description,
      "Edit YouTube ep. 47 — final cut with color grade"
    );
    assert.equal(milestone.amount.toNumber(), EDITOR_RATE);
    assert.deepEqual(milestone.status, { pending: {} });
    console.log(
      '  ✅ Milestone created: "Edit YouTube ep. 47" — $150 USDC'
    );

    // Store for later tests
    (global as any).milestonePda = milestonePda;
  });

  it("Editor submits deliverable proof", async () => {
    const milestonePda = (global as any).milestonePda;

    await program.methods
      .submitDeliverable(
        "https://drive.google.com/file/d/abc123/final-cut-ep47.mp4"
      )
      .accounts({
        contributor: editor.publicKey,
        member: editorMemberPda,
        milestone: milestonePda,
      })
      .signers([editor])
      .rpc();

    const milestone = await program.account.milestone.fetch(milestonePda);
    assert.deepEqual(milestone.status, { submitted: {} });
    assert.equal(
      milestone.proofUri,
      "https://drive.google.com/file/d/abc123/final-cut-ep47.mp4"
    );
    console.log("  ✅ Editor submitted deliverable proof (Google Drive link)");
  });

  it("Creator approves → auto-pays $150 USDC to editor", async () => {
    const milestonePda = (global as any).milestonePda;
    const team = await program.account.team.fetch(teamPda);
    const paymentCount = team.paymentCount;

    const [receiptPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("receipt"),
        teamPda.toBuffer(),
        paymentCount.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const editorBalanceBefore = await getAccount(
      provider.connection,
      editorTokenAccount
    );

    await program.methods
      .approveAndPay()
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: editorMemberPda,
        milestone: milestonePda,
        vault: vaultPda,
        contributorTokenAccount: editorTokenAccount,
        paymentRecord: receiptPda,
        authority: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Verify payment received
    const editorBalanceAfter = await getAccount(
      provider.connection,
      editorTokenAccount
    );
    const received =
      Number(editorBalanceAfter.amount) - Number(editorBalanceBefore.amount);
    assert.equal(received, EDITOR_RATE);

    // Verify milestone approved
    const milestone = await program.account.milestone.fetch(milestonePda);
    assert.deepEqual(milestone.status, { approved: {} });

    // Verify on-chain receipt
    const receipt = await program.account.paymentRecord.fetch(receiptPda);
    assert.equal(receipt.amount.toNumber(), EDITOR_RATE);
    assert.equal(receipt.recipient.toBase58(), editor.publicKey.toBase58());

    // Verify team stats updated
    const updatedTeam = await program.account.team.fetch(teamPda);
    assert.equal(updatedTeam.totalDisbursed.toNumber(), EDITOR_RATE);
    assert.equal(updatedTeam.paymentCount.toNumber(), 1);

    console.log("  ✅ $150 USDC sent to editor — on-chain receipt created");
  });

  it("Direct payment: $50 USDC to designer for thumbnail batch", async () => {
    const team = await program.account.team.fetch(teamPda);
    const paymentCount = team.paymentCount;

    const [receiptPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("receipt"),
        teamPda.toBuffer(),
        paymentCount.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const designerBalanceBefore = await getAccount(
      provider.connection,
      designerTokenAccount
    );

    await program.methods
      .directPay(
        new anchor.BN(DESIGNER_RATE),
        "Thumbnail batch #12 — 5 thumbnails delivered"
      )
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: designerMemberPda,
        vault: vaultPda,
        contributorTokenAccount: designerTokenAccount,
        paymentRecord: receiptPda,
        authority: creator.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const designerBalanceAfter = await getAccount(
      provider.connection,
      designerTokenAccount
    );
    const received =
      Number(designerBalanceAfter.amount) -
      Number(designerBalanceBefore.amount);
    assert.equal(received, DESIGNER_RATE);

    const receipt = await program.account.paymentRecord.fetch(receiptPda);
    assert.equal(receipt.memo, "Thumbnail batch #12 — 5 thumbnails delivered");

    const updatedTeam = await program.account.team.fetch(teamPda);
    assert.equal(
      updatedTeam.totalDisbursed.toNumber(),
      EDITOR_RATE + DESIGNER_RATE
    );
    assert.equal(updatedTeam.paymentCount.toNumber(), 2);

    console.log(
      "  ✅ $50 USDC direct payment to designer — on-chain receipt created"
    );
  });

  it("Verifies treasury balance after payments", async () => {
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    const remaining =
      INITIAL_FUNDING - EDITOR_RATE - DESIGNER_RATE;
    assert.equal(Number(vaultAccount.amount), remaining);
    console.log(
      `  ✅ Treasury balance: $${remaining / 10 ** USDC_DECIMALS} USDC remaining`
    );
  });

  it("Deactivates a team member", async () => {
    await program.methods
      .deactivateMember()
      .accounts({
        creator: creator.publicKey,
        team: teamPda,
        member: designerMemberPda,
        authority: creator.publicKey,
      })
      .rpc();

    const member = await program.account.member.fetch(designerMemberPda);
    assert.equal(member.isActive, false);
    // Total earned is preserved
    assert.equal(member.totalEarned.toNumber(), DESIGNER_RATE);
    console.log(
      "  ✅ Designer deactivated — payment history preserved on-chain"
    );
  });
});
