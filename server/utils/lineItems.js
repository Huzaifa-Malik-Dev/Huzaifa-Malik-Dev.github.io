// Server always recomputes every row's mrc (price*qty), every block's blockMrc (sum of its rows),
// and the grand-total mrc (sum of all blocks) - never trusts client-submitted totals, same rule
// the old flat Pipeline/Order.mrc = price*qty always followed, one level deeper now that a deal
// can carry several blocks/rows. Also strips any client-sent _id so Mongoose assigns fresh
// subdocument ids when this is used to copy Pipeline.lineItems onto a new/existing Order.
function recomputeLineItems(lineItems) {
  const blocks = (Array.isArray(lineItems) ? lineItems : []).map((block) => {
    const rawRows = block.rows && block.rows.length ? block.rows : [{ price: 0, qty: 1 }];
    const rows = rawRows.map((row) => {
      const price = Number(row.price) || 0;
      const qty = Number(row.qty) || 1;
      return { price, qty, mrc: price * qty };
    });
    const blockMrc = rows.reduce((sum, r) => sum + r.mrc, 0);
    return { cat: block.cat || '', product: block.product || '', sr: block.sr || '', rows, blockMrc };
  });
  const mrc = blocks.reduce((sum, b) => sum + b.blockMrc, 0);
  return { lineItems: blocks, mrc };
}

module.exports = { recomputeLineItems };
