async function sendEmailAlert(toEmail, subject, messageHtml) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.EMAIL_PASS,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER, name: 'UpEnergy CRM' },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: messageHtml
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('❌ Brevo API Error:', errData);
    } else {
      console.log(`✅ Email alert sent to ${toEmail}`);
    }
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
  }
}

module.exports = { sendEmailAlert };