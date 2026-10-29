/** Totals for a set of orders. Cash and online are what was actually collected (after discount). */
export function summarise(orders: { items: { product: unknown; qty: number }[]; subtotal: number; discount: number; total: number; payment: string }[]) {
  const unitsByProduct = new Map<string, number>();
  let units = 0;
  let gross = 0;
  let discount = 0;
  let net = 0;
  let cash = 0;
  let online = 0;
  for (const o of orders) {
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
  return { orderCount: orders.length, units, unitsByProduct, gross, discount, net, cash, online };
}
