"""Order processing service — validates, prices, and persists customer orders."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


class LineItem(BaseModel):
    """A single product line on an order."""

    sku: str = Field(..., min_length=3, max_length=32)
    quantity: int = Field(..., ge=1, le=999)
    unit_price: Decimal = Field(..., ge=0)

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.strip().upper()


class OrderPayload(BaseModel):
    """Incoming order creation request."""

    customer_id: str
    items: list[LineItem]
    coupon_code: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


@dataclass
class PricedOrder:
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    currency: str = "USD"


def calculate_totals(payload: OrderPayload, tax_rate: Decimal = Decimal("0.0825")) -> PricedOrder:
    """Compute subtotal, discount, tax, and grand total for an order."""
    subtotal = sum((item.unit_price * item.quantity for item in payload.items), Decimal("0"))
    discount = Decimal("0")

    if payload.coupon_code:
        # Placeholder — real impl looks up coupon in DB
        discount = min(subtotal * Decimal("0.10"), Decimal("50.00"))

    taxable = subtotal - discount
    tax = (taxable * tax_rate).quantize(Decimal("0.01"))
    total = taxable + tax

    return PricedOrder(subtotal=subtotal, discount=discount, tax=tax, total=total)


def persist_order(payload: OrderPayload, priced: PricedOrder) -> str:
    """Write order to storage and return the new order ID."""
    order_id = f"ord_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    record = {
        "id": order_id,
        "customer_id": payload.customer_id,
        "items": [item.model_dump() for item in payload.items],
        "totals": priced.__dict__,
        "metadata": payload.metadata,
    }
    logger.info("Persisting order %s — total %s", order_id, priced.total)
    return order_id
