const express = require('express')
const router = express.Router()
const Razorpay = require('razorpay')
const crypto = require('crypto')

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Create order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, name, email, dob, tob, pob } = req.body
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      notes: { name, email, dob, tob, pob },
    })
    res.json({ orderId: order.id, amount: order.amount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Verify payment + trigger report
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userData } = req.body
    const sign = razorpay_order_id + '|' + razorpay_payment_id
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign).digest('hex')

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    // Trigger report generation async
    const reportRoute = require('./report')
    reportRoute.generateAndSend(userData)

    res.json({ success: true, message: 'Payment verified. Report will be emailed shortly.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
