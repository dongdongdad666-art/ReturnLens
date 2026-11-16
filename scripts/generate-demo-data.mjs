import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../public/demo/', import.meta.url)
mkdirSync(out, { recursive: true })
const csv = (rows) => rows.map((row) => row.map((cell) => JSON.stringify(String(cell))).join(',')).join('\n')
const orders = [['order_id', 'sku', 'product_name', 'size', 'color', 'channel', 'sale_price', 'unit_cost', 'ordered_at']]
const returns = [['return_id', 'order_id', 'return_reason', 'returned_at', 'return_shipping_cost', 'inspection_cost', 'restock_cost', 'residual_loss']]
const reviews = [['review_id', 'order_id', 'sku', 'rating', 'review_text', 'created_at']]
const chats = [['chat_id', 'order_id', 'message_text', 'created_at']]

for (let i = 1; i <= 600; i += 1) {
  const orderId = `O${String(i).padStart(4, '0')}`
  const sku = i <= 180 ? 'SKU-123' : i <= 330 ? 'SKU-447' : i <= 450 ? 'SKU-809' : 'SKU-522'
  const size = ['S', 'M', 'L', 'XL'][i % 4]
  orders.push([orderId, sku, sku === 'SKU-123' ? '收腰连衣裙' : '针织上衣', size, i % 3 ? '黑色' : '米白', i % 2 ? '天猫' : '抖音', 199, 90, `2026-0${7 + (i % 3)}-${String((i % 28) + 1).padStart(2, '0')}`])
  if ((sku === 'SKU-123' && ['M', 'L'].includes(size) && i % 3 === 0) || i % 11 === 0) {
    const reason = sku === 'SKU-123' ? '穿着很紧，申请换大一码' : sku === 'SKU-447' ? '面料比图片看起来薄' : '不太合适'
    returns.push([`R${orderId}`, orderId, reason, '2026-09-01', 8, 3, 2, 10])
    reviews.push([`V${orderId}`, orderId, sku, 2, reason, '2026-09-02'])
    chats.push([`C${orderId}`, orderId, reason, '2026-09-01'])
  }
}

writeFileSync(new URL('orders.csv', out), csv(orders))
writeFileSync(new URL('returns.csv', out), csv(returns))
writeFileSync(new URL('reviews.csv', out), csv(reviews))
writeFileSync(new URL('chats.csv', out), csv(chats))
