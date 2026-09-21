use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
use solana_instructions_sysvar as ix_sysvar;
use spl_token_2022_interface::extension::{
    scaled_ui_amount::ScaledUiAmountConfig, BaseStateWithExtensions, StateWithExtensions,
};
use spl_token_2022_interface::state::Mint as MintState;

declare_id!("4RuFJCqBiGmWee9WTtD91dbGQQiCUjoSkkkqXBvi3Yda");

// Users approve this program address as the spender on their token account.
pub const AUTHORITY_SEED: &[u8] = b"authority";

// Only this wallet may execute rules. Stop-loss relies on the keeper's
// reported price, so execution cannot be open to anyone.
// CHANGE THIS before mainnet — the devnet key has been exposed.
pub const KEEPER: Pubkey = pubkey!("8CuBSCDhqT1xovkZY3jpa2ft5gpLYEZbiG3BikoogvnT");

#[program]
pub mod wexel_program {
    use super::*;

    pub fn create_rule(
        ctx: Context<CreateRule>,
        asset: String,
        direction: Direction,
        threshold_pct: f64,
        entry_price: f64,
        action: Action,
        amount: u64,
        max_execution: u64,
        max_slippage_bps: u16,
        expiry_unix: i64,
        input_mint: Pubkey,
        output_mint: Pubkey,
    ) -> Result<()> {
        require!(threshold_pct > 0.0 && threshold_pct < 100.0, WexelError::BadThreshold);
        require!(entry_price > 0.0, WexelError::BadPrice);
        require!(amount > 0 && max_execution > 0, WexelError::BadAmount);
        require!(max_slippage_bps <= 1000, WexelError::BadSlippage);
        require!(input_mint != output_mint, WexelError::BadMints);

        let r = &mut ctx.accounts.rule;
        r.owner = ctx.accounts.owner.key();
        r.asset = asset;
        r.direction = direction;
        r.threshold_pct = threshold_pct;
        r.entry_price = entry_price;
        r.action = action;
        r.amount = amount;
        r.max_execution = max_execution;
        r.max_slippage_bps = max_slippage_bps;
        r.expiry_unix = expiry_unix;
        r.status = RuleStatus::Watching;
        r.last_price = 0.0;
        r.executed_amount = 0;
        r.triggered_at = 0;
        r.input_mint = input_mint;
        r.output_mint = output_mint;
        r.pre_balance = 0;
        r.min_out = 0;
        r.settle_account = Pubkey::default();
        Ok(())
    }

    // One step: confirm the trigger, move the capped amount to the keeper,
    // and record what the user must receive. Must be followed by `settle`
    // in the same transaction, or nothing happens at all.
    pub fn execute(ctx: Context<Execute>, reported_price: f64) -> Result<()> {
        require_settle_follows(
            &ctx.accounts.instructions.to_account_info(),
            ctx.accounts.rule.key(),
        )?;

        let r = &mut ctx.accounts.rule;
        let now = Clock::get()?.unix_timestamp;

        require!(r.status == RuleStatus::Watching, WexelError::RuleNotActive);
        require!(now <= r.expiry_unix, WexelError::Expired);
        require!(reported_price > 0.0, WexelError::BadPrice);

        let ratio = reported_price / r.entry_price;
        require!(ratio > 0.1 && ratio < 10.0, WexelError::PriceOutOfRange);

        let trigger = match r.direction {
            Direction::Down => r.entry_price * (1.0 - r.threshold_pct / 100.0),
            Direction::Up => r.entry_price * (1.0 + r.threshold_pct / 100.0),
        };
        let hit = match r.direction {
            Direction::Down => reported_price <= trigger,
            Direction::Up => reported_price >= trigger,
        };
        require!(hit, WexelError::NotTriggered);

        let spend = r.amount.min(r.max_execution);          // USDC, 6 decimals
        let usd = spend as f64 / 1_000_000.0;
        let keep = 1.0 - (r.max_slippage_bps as f64) / 10_000.0;
        let in_dec = ctx.accounts.input_mint.decimals;
        let out_dec = ctx.accounts.output_mint.decimals;

        let m_in = ui_multiplier(&ctx.accounts.input_mint.to_account_info(), now);
        let m_out = ui_multiplier(&ctx.accounts.output_mint.to_account_info(), now);

        // Maths happens in displayed units (what prices are quoted in), then
        // converts to raw units by dividing by each mint's multiplier.
        let (amount_in, min_out) = match r.action {
            // Spend USDC; receive at least usd / price shares, minus slippage.
            Action::Buy => (
                spend,
                (usd / reported_price * keep / m_out * 10f64.powi(out_dec as i32)) as u64,
            ),
            // Sell usd-worth of shares sized at the TRIGGER price, so a keeper
            // can't inflate the count by reporting a low price.
            Action::SwapToUsdc => {
                let shares = usd / trigger;
                (
                    (shares / m_in * 10f64.powi(in_dec as i32)) as u64,
                    (shares * reported_price * keep / m_out * 10f64.powi(out_dec as i32)) as u64,
                )
            }
        };
        require!(amount_in > 0 && min_out > 0, WexelError::BadAmount);

        let bump = ctx.bumps.authority;
        let seeds: &[&[&[u8]]] = &[&[AUTHORITY_SEED, &[bump]]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.input_token_program.key(),
                TransferChecked {
                    from: ctx.accounts.user_input.to_account_info(),
                    mint: ctx.accounts.input_mint.to_account_info(),
                    to: ctx.accounts.keeper_input.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
                seeds,
            ),
            amount_in,
            in_dec,
        )?;

        r.last_price = reported_price;
        r.executed_amount = spend;
        r.triggered_at = now;
        r.pre_balance = ctx.accounts.user_output.amount;
        r.min_out = min_out;
        r.settle_account = ctx.accounts.user_output.key();
        r.status = RuleStatus::Settling;
        Ok(())
    }

    // After the swap: the user's balance must have grown by at least min_out.
    // If not, this fails and the whole transaction reverts.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let r = &mut ctx.accounts.rule;
        require!(r.status == RuleStatus::Settling, WexelError::RuleNotActive);
        require_keys_eq!(ctx.accounts.user_output.key(), r.settle_account, WexelError::WrongAccount);

        ctx.accounts.user_output.reload()?;
        let received = ctx.accounts.user_output.amount.saturating_sub(r.pre_balance);
        require!(received >= r.min_out, WexelError::InsufficientOutput);

        r.status = RuleStatus::Executed;
        msg!("executed: received {} (min {})", received, r.min_out);
        Ok(())
    }

    pub fn cancel_rule(ctx: Context<CancelRule>) -> Result<()> {
        let r = &mut ctx.accounts.rule;
        require!(r.status == RuleStatus::Watching, WexelError::RuleNotActive);
        r.status = RuleStatus::Cancelled;
        Ok(())
    }
}

// Displayed units per raw unit. xStocks use Token-2022's scaled-UI-amount
// extension (the issuer passes dividends through it), so 1 raw AAPLx can show
// as 1.0033 AAPLx. Read from the mint itself, so no one can supply a false
// value. Anything without the extension (USDC) is 1.0.
fn ui_multiplier(mint: &AccountInfo, now: i64) -> f64 {
    let Ok(data) = mint.try_borrow_data() else { return 1.0 };
    let Ok(state) = StateWithExtensions::<MintState>::unpack(&data) else { return 1.0 };
    let Ok(cfg) = state.get_extension::<ScaledUiAmountConfig>() else { return 1.0 };
    let switch_at: i64 = cfg.new_multiplier_effective_timestamp.into();
    let m: f64 = if now >= switch_at { cfg.new_multiplier.into() } else { cfg.multiplier.into() };
    if m.is_finite() && m > 0.0 { m } else { 1.0 }
}

fn require_settle_follows(ix_acc: &AccountInfo, rule: Pubkey) -> Result<()> {
    let current = ix_sysvar::load_current_index_checked(ix_acc)
        .map_err(|_| error!(WexelError::SettleMissing))? as usize;

    let mut i = current + 1;
    while let Ok(ix) = ix_sysvar::load_instruction_at_checked(i, ix_acc) {
        if ix.program_id == crate::ID
            && ix.data.len() >= 8
            && &ix.data[..8] == crate::instruction::Settle::DISCRIMINATOR
            && ix.accounts.first().map(|a| a.pubkey) == Some(rule)
        {
            return Ok(());
        }
        i += 1;
    }
    err!(WexelError::SettleMissing)
}

#[derive(Accounts)]
pub struct CreateRule<'info> {
    #[account(init, payer = owner, space = 8 + Rule::MAX_SIZE)]
    pub rule: Account<'info, Rule>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut, has_one = input_mint, has_one = output_mint)]
    pub rule: Account<'info, Rule>,

    /// CHECK: PDA signer only; the user approved it as delegate.
    #[account(seeds = [AUTHORITY_SEED], bump)]
    pub authority: UncheckedAccount<'info>,

    pub input_mint: InterfaceAccount<'info, Mint>,
    pub output_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = input_mint, token::authority = rule.owner,
              token::token_program = input_token_program)]
    pub user_input: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = input_mint, token::authority = keeper,
              token::token_program = input_token_program)]
    pub keeper_input: InterfaceAccount<'info, TokenAccount>,

    #[account(token::mint = output_mint, token::authority = rule.owner,
              token::token_program = output_token_program)]
    pub user_output: InterfaceAccount<'info, TokenAccount>,

    #[account(address = KEEPER @ WexelError::NotKeeper)]
    pub keeper: Signer<'info>,

    pub input_token_program: Interface<'info, TokenInterface>,
    pub output_token_program: Interface<'info, TokenInterface>,

    /// CHECK: the instructions sysvar, pinned by address.
    #[account(address = ix_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    // Must stay FIRST: execute looks for the rule in this position.
    #[account(mut, has_one = output_mint)]
    pub rule: Account<'info, Rule>,
    pub output_mint: InterfaceAccount<'info, Mint>,
    #[account(token::mint = output_mint, token::authority = rule.owner,
              token::token_program = output_token_program)]
    pub user_output: InterfaceAccount<'info, TokenAccount>,
    pub output_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CancelRule<'info> {
    #[account(mut, has_one = owner)]
    pub rule: Account<'info, Rule>,
    pub owner: Signer<'info>,
}

#[account]
pub struct Rule {
    pub owner: Pubkey,
    pub asset: String,
    pub direction: Direction,
    pub threshold_pct: f64,
    pub entry_price: f64,
    pub action: Action,
    pub amount: u64,
    pub max_execution: u64,
    pub max_slippage_bps: u16,
    pub expiry_unix: i64,
    pub status: RuleStatus,
    pub last_price: f64,
    pub executed_amount: u64,
    pub triggered_at: i64,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub pre_balance: u64,
    pub min_out: u64,
    pub settle_account: Pubkey,
}

impl Rule {
    pub const MAX_SIZE: usize = 32 + (4 + 20) + 1 + 8 + 8 + 1 + 8 + 8 + 2 + 8 + 1
        + 8 + 8 + 8 + 32 + 32 + 8 + 8 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum Direction { Up, Down }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum Action { Buy, SwapToUsdc }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum RuleStatus { Watching, Triggered, Executed, Expired, Cancelled, Settling }

#[error_code]
pub enum WexelError {
    #[msg("Rule is not in a state where this can happen")]
    RuleNotActive,
    #[msg("Rule has expired")]
    Expired,
    #[msg("Price has not reached the trigger")]
    NotTriggered,
    #[msg("Price is outside the plausible range for this rule")]
    PriceOutOfRange,
    #[msg("Price must be positive")]
    BadPrice,
    #[msg("Threshold must be between 0 and 100 percent")]
    BadThreshold,
    #[msg("Amount must be greater than zero")]
    BadAmount,
    #[msg("Slippage cannot exceed 10%")]
    BadSlippage,
    #[msg("Input and output tokens must differ")]
    BadMints,
    #[msg("Only the Wexel keeper can execute rules")]
    NotKeeper,
    #[msg("execute must be followed by settle in the same transaction")]
    SettleMissing,
    #[msg("Settle must check the account recorded at execution")]
    WrongAccount,
    #[msg("The swap delivered less than the minimum")]
    InsufficientOutput,
}
