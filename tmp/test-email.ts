import "dotenv/config";
import nodemailer from "nodemailer";

async function testEmailSending() {
  const mailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "2525", 10),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    console.log("🔧 Email Configuration:");
    console.log("  HOST:", process.env.EMAIL_HOST);
    console.log("  PORT:", process.env.EMAIL_PORT);
    console.log("  USER:", process.env.EMAIL_USER);
    console.log("  PASS: (hidden)");
    console.log("  FROM:", process.env.EMAIL_FROM);
    console.log("");

    console.log("📧 Testing email sending...");
    const info = await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@codeethnics.com",
      to: "sarveshcjsanjay@gmail.com",
      subject: "CodeEthnics Test Email",
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from CodeEthnics.</p>
        <p><strong style="font-size:28px;letter-spacing:6px;">123456</strong></p>
        <p>If you received this, email configuration is working!</p>
      `,
    });

    console.log("✅ Email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("");
    console.log("ℹ️  With Mailtrap, check: https://mailtrap.io/inboxes");
  } catch (error: any) {
    console.error("❌ Email sending failed!");
    console.error("Error:", error.message);
    console.error("");
    console.error("Full error:", error);
  } finally {
    await mailTransporter.close();
  }
}

testEmailSending();
