/**
 * Totals for a set of orders. Cash and online are what was actually collected (after discount).
 * Orders on hold (not paid yet) are left out of every figure; their tiramisu are counted
 * apart, in `heldByProduct`, as set aside for the customer.
 */
export function summarise(orders: { items: { product: unknown; qty: number }[]; subtotal: number; discount: number; total: number; payment?: string | null }[]) {
  const unitsByProduct = new Map<string, number>();
  const heldByProduct = new Map<string, number>();
  let heldCount = 0;
  let heldTotal = 0;
  let units = 0;
  let gross = 0;
  let discount = 0;
  let net = 0;
  let cash = 0;
  let online = 0;
  for (const o of orders) {
    if (o.payment !== 'cash' && o.payment !== 'online') {
      heldCount += 1;
      heldTotal += o.total;
      for (const item of o.items) heldByProduct.set(String(item.product), (heldByProduct.get(String(item.product)) ?? 0) + item.qty);
      continue;
    }
    for (const item of o.items) {
      const id = String(item.product);
      unitsByProduct.set(id, (unitsByProduct.get(id) ?? 0) + item.qty);
      units += item.qty;
    }
    gross += o.subtotal;
    discount += o.discount;
    net += o.total;
    if (o.payment === 'cash') cash += o.total;
    else online += o.total;
  }
  return { orderCount: orders.length - heldCount, units, unitsByProduct, gross, discount, net, cash, online, heldCount, heldTotal, heldByProduct };
}
