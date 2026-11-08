"""FOMO fee model on Solana, used for PAPER PnL. Gas = 0 (FOMO pays it)."""
from . import config


def side_fee(ticket_usd: float, discount: float | None = None) -> float:
    """Fee for one side (buy or sell) of a ticket, after the referral discount."""
    t = abs(float(ticket_usd))
    if t <= 0:
        return 0.0
    if t < 47.50:
        fee = 0.02 * t          # $5 to $47.50: 2% of the ticket
    elif t <= 190:
        fee = 0.95              # $47.50 to $190: flat $0.95
    else:
        fee = 0.005 * t         # above $190: 0.50%
    d = config.get("desk.fees_ref_discount") if discount is None else discount
    return round(fee * (1 - d), 6)


def round_trip(entry_usd: float, exit_usd: float, discount: float | None = None) -> float:
    return round(side_fee(entry_usd, discount) + side_fee(exit_usd, discount), 6)
