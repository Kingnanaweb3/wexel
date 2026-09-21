use serde::{Deserialize, Serialize};

// Which way the price needs to move to fire the rule
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Direction {
    Up,
    Down,
}

// What happens when the rule fires
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Action {
    Buy,
    SwapToUsdc,
}

// One user-created automation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub asset: String,        // e.g. "NVDA"
    pub direction: Direction, // Up or Down
    pub threshold_pct: f64,   // e.g. 5.0 means 5%
    pub entry_price: f64,     // price when the rule was created
    pub action: Action,
    pub amount: f64,          // amount requested per trigger
    pub max_execution: f64,   // hard cap per trigger (guardrail)
    pub expiry_unix: u64,     // rule stops watching after this timestamp
}

// Outcome of checking a rule against a live price
#[derive(Debug, PartialEq)]
pub enum EvalResult {
    Triggered,
    Watching,
    Expired,
}

// Core logic: does this rule fire right now?
pub fn evaluate(rule: &Rule, current_price: f64, now_unix: u64) -> EvalResult {
    if now_unix > rule.expiry_unix {
        return EvalResult::Expired;
    }

    let pct_change = ((current_price - rule.entry_price) / rule.entry_price) * 100.0;

    let condition_met = match rule.direction {
        Direction::Down => pct_change <= -rule.threshold_pct,
        Direction::Up => pct_change >= rule.threshold_pct,
    };

    if condition_met {
        EvalResult::Triggered
    } else {
        EvalResult::Watching
    }
}

// Guardrail: never execute more than max_execution, even if amount is higher
pub fn capped_amount(rule: &Rule) -> f64 {
    rule.amount.min(rule.max_execution)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_rule() -> Rule {
        Rule {
            asset: "NVDA".to_string(),
            direction: Direction::Down,
            threshold_pct: 5.0,
            entry_price: 150.0,
            action: Action::Buy,
            amount: 100.0,
            max_execution: 100.0,
            expiry_unix: 9_999_999_999,
        }
    }

    #[test]
    fn triggers_on_drop() {
        let rule = sample_rule();
        let result = evaluate(&rule, 142.0, 1_000); // ~5.3% drop
        assert_eq!(result, EvalResult::Triggered);
    }

    #[test]
    fn does_not_trigger_early() {
        let rule = sample_rule();
        let result = evaluate(&rule, 148.0, 1_000); // ~1.3% drop
        assert_eq!(result, EvalResult::Watching);
    }

    #[test]
    fn expiry_blocks_trigger() {
        let mut rule = sample_rule();
        rule.expiry_unix = 500;
        let result = evaluate(&rule, 100.0, 1_000); // big drop, but expired
        assert_eq!(result, EvalResult::Expired);
    }

    #[test]
    fn max_execution_caps_amount() {
        let mut rule = sample_rule();
        rule.amount = 500.0;
        rule.max_execution = 100.0;
        assert_eq!(capped_amount(&rule), 100.0);
    }

    #[test]
    fn triggers_on_rise() {
        let mut rule = sample_rule();
        rule.direction = Direction::Up;
        rule.threshold_pct = 20.0;
        rule.entry_price = 100.0;
        let result = evaluate(&rule, 121.0, 1_000); // 21% rise
        assert_eq!(result, EvalResult::Triggered);
    }
}
