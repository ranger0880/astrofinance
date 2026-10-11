const express = require('express')
const router = express.Router()
const OpenAI = require('openai')
const puppeteer = require('puppeteer')
const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PLANET_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

function getSunSign(dob) {
  const d = new Date(dob)
  const m = d.getMonth() + 1, day = d.getDate()
  if ((m===3&&day>=21)||(m===4&&day<=19)) return 'Aries'
  if ((m===4&&day>=20)||(m===5&&day<=20)) return 'Taurus'
  if ((m===5&&day>=21)||(m===6&&day<=20)) return 'Gemini'
  if ((m===6&&day>=21)||(m===7&&day<=22)) return 'Cancer'
  if ((m===7&&day>=23)||(m===8&&day<=22)) return 'Leo'
  if ((m===8&&day>=23)||(m===9&&day<=22)) return 'Virgo'
  if ((m===9&&day>=23)||(m===10&&day<=22)) return 'Libra'
  if ((m===10&&day>=23)||(m===11&&day<=21)) return 'Scorpio'
  if ((m===11&&day>=22)||(m===12&&day<=21)) return 'Sagittarius'
  if ((m===12&&day>=22)||(m===1&&day<=19)) return 'Capricorn'
  if ((m===1&&day>=20)||(m===2&&day<=18)) return 'Aquarius'
  return 'Pisces'
}

async function generateAndSend(userData) {
  const { name, email, dob, tob, pob } = userData
  const sunSign = getSunSign(dob)

  const prompt = `You are a financial astrology expert. Generate an educational financial horoscope report for a person with the following details:
Name: ${name}
Date of Birth: ${dob}
Time of Birth: ${tob}
Place of Birth: ${pob}
Sun Sign: ${sunSign}

Write a detailed, engaging, 600-word report covering:
1. Financial personality based on sun sign (2 paragraphs)
2. Current planetary transits affecting wealth (Jupiter, Saturn, current retrogrades) — educational only, not specific investment advice (2 paragraphs)
3. Favorable periods for financial decisions in the next 3 months (1 paragraph)
4. Key financial strengths and blind spots of this sun sign (1 paragraph)
5. A closing affirmation

Important: Frame everything as educational astrology content, NOT financial advice. Include a disclaimer at the end.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  })

  const reportText = completion.choices[0].message.content
  const pdfPath = path.join(__dirname, '..', 'reports', `${Date.now()}_${name.replace(/\s/g,'_')}.pdf`)

  if (!fs.existsSync(path.join(__dirname, '..', 'reports'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'reports'))
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1a1a2e;line-height:1.8}
    h1{color:#c9a227;font-size:28px;text-align:center;border-bottom:2px solid #c9a227;padding-bottom:12px}
    h2{color:#4a3f35;font-size:16px;margin-top:28px}
    .meta{text-align:center;color:#666;font-size:13px;margin-bottom:30px}
    .disclaimer{font-size:11px;color:#999;margin-top:40px;padding:12px;border:1px solid #ddd;border-radius:6px}
    .footer{text-align:center;color:#c9a227;font-size:13px;margin-top:30px}
  </style></head><body>
  <h1>NiveshSetu — Financial Astrology Report</h1>
  <div class="meta">Prepared for ${name} · Sun Sign: ${sunSign} · ${new Date().toLocaleDateString('en-IN')}</div>
  <div>${reportText.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</div>
  <div class="footer">niveshsetu.xyz · For educational purposes only</div>
  </body></html>`

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({ path: pdfPath, format: 'A4', margin: { top:'20mm',bottom:'20mm',left:'15mm',right:'15mm' } })
  await browser.close()

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })

  await transporter.sendMail({
    from: `NiveshSetu <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Financial Astrology Report — ${name}`,
    text: `Hi ${name},\n\nYour personalized financial astrology report is attached.\n\nNiveshSetu.xyz`,
    attachments: [{ filename: 'NiveshSetu_Report.pdf', path: pdfPath }],
  })

  fs.unlinkSync(pdfPath)
}

// Free preview endpoint
router.post('/preview', async (req, res) => {
  try {
    const { dob } = req.body
    const sunSign = getSunSign(dob)
    const signs = {
      Aries:'Bold and impulsive with money — high risk, high reward energy.',
      Taurus:'Natural wealth builder — patient, steady, loves security.',
      Gemini:'Multiple income streams suit you — variety in investments works.',
      Cancer:'Emotionally tied to money — home and family drive financial goals.',
      Leo:'Generous with spending, needs to balance luxury with savings.',
      Virgo:'Detail-oriented and analytical — excellent at budgeting.',
      Libra:'Seeks financial balance — good at partnerships and negotiations.',
      Scorpio:'Intensely strategic — excellent for long-term wealth building.',
      Sagittarius:'Optimistic but can overspend — international opportunities favored.',
      Capricorn:'Disciplined wealth builder — most naturally business-minded sign.',
      Aquarius:'Innovative approach to money — drawn to new-age assets.',
      Pisces:'Intuitive but needs structure — creative income sources suit well.'
    }
    res.json({ sunSign, preview: signs[sunSign] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
module.exports.generateAndSend = generateAndSend
