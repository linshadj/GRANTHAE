import mongoose from "mongoose";
import { mailSender } from "../utils/mailSender.js";

const otpSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },

  otp: {
    type: Number,
    required: true,
    match: [/^\d{6}]$/, "OTP must be exactly 6 digits"],
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 5,
  },
});

otpSchema.index({ email: 1, createdAt: -1 });

const sendVerificationMail = async (firstName, email, otp) => {
  try {
    await mailSender(
      email,
      "GRANTHAE Otp verfication",
      `<!DOCTYPE html>
            <html>

            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verify Your Email</title>
                <!-- Import Fonts (Support varies by client, fallback to serif/sans-serif) -->
                <link
                    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Outfit:wght@400;500&display=swap"
                    rel="stylesheet">
                <style>
                    /* Reset & Basics */
                    body {
                        margin: 0;
                        padding: 0;
                        min-width: 100%;
                        width: 100% !important;
                        height: 100% !important;
                    }

                    a {
                        text-decoration: none;
                        color: #fbbf24;
                    }

                    img {
                        display: block;
                        height: auto;
                        border: 0;
                    }

                    .wrapper {
                        width: 100%;
                        table-layout: fixed;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                        border: 1px solid #2c3b32;
                        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
                        border-radius: 16px;
                    }

                    .webkit {
                        max-width: 600px;
                        margin: 0 auto;
                    }

                    /* Mobile Responsiveness */
                    @media screen and (max-width: 600px) {
                        .content-table {
                            width: 100% !important;
                        }

                        .padding-mobile {
                            padding-left: 20px !important;
                            padding-right: 20px !important;
                        }
                    }
                </style>
            </head>

            <body style="margin: 0; padding: 0; font-family: 'Outfit', Helvetica, Arial, sans-serif;">
                <center class="wrapper" style="width: 100%; table-layout: fixed; padding-bottom: 40px;">
                    <div class="webkit" style="max-width: 600px; margin: 0 auto;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" class="content-table"
                            style="max-width: 600px; margin: 0 auto; color: #e6cfa7;">

                            <!-- Spacer -->
                            <tr>
                                <td height="40" style="font-size: 40px; line-height: 40px;">&nbsp;</td>
                            </tr>

                            <!-- Logo Section -->
                            <tr>
                                <td align="center" style="padding-bottom: 30px;">
                                    <!-- Fallback Text Logo using Brand Font -->
                                    <h1
                                        style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600; letter-spacing: 2px; color: #e6cfa7;">
                                        GRANTHAE.
                                    </h1>
                                </td>
                            </tr>

                            <!-- Main Card -->
                            <tr>
                                <td align="center" class="padding-mobile" style="padding: 0 10px;">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%"
                                        style="background-color: #2c3b32; border-radius: 16px; border: 1px solid rgba(230, 207, 167, 0.1); box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
                                        <tr>
                                            <td align="center" style="padding: 40px;">

                                                <!-- Icon -->
                                                <div style="margin-bottom: 24px;">
                                                    <img src="https://cdn-icons-png.flaticon.com/512/1161/1161388.png" alt="Security Shield" width="56" height="56" style="display: block; opacity: 0.9;">
                                                    <!-- Note: In production, substitute with a hosted brand asset -->
                                                </div>

                                                <!-- Headline -->
                                                <h2
                                                    style="margin: 0 0 16px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 500; color: #e6cfa7;">
                                                    Authentication Required
                                                </h2>

                                                <!-- Body Text -->
                                                <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 24px; color: #d1d5db;">
                                                    Hello ${firstName},
                                                    <br><br>
                                                    We received a request to access your Granthae account. Use the verification code
                                                    below to complete your sign-up or login.
                                                </p>

                                                <!-- OTP Code -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                    <tr>
                                                        <td align="center">
                                                            <div
                                                                style="display: inline-block; background-color: rgba(230, 207, 167, 0.05); border: 1px solid rgba(230, 207, 167, 0.2); border-radius: 8px; padding: 16px 32px;">
                                                                <span
                                                                    style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #fbbf24;">
                                                                    ${otp}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Sub-text -->
                                                <p style="margin: 32px 0 0 0; font-size: 14px; color: #9ca3af;">
                                                    This code will expire in <strong style="color: #e6cfa7;">5 minutes</strong>.
                                                    <br>
                                                    If you didn't request this, you can safely ignore this email.
                                                </p>

                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td align="center" style="padding: 30px 20px;">
                                    <p style="margin: 0; font-size: 12px; line-height: 20px; color: #6b7280;">
                                        &copy; 2026 GRANTHAE. All rights reserved.
                                        <br>
                                        The Community Library for Classical & Modern Literature.
                                    </p>
                                    <div style="margin-top: 12px;">
                                        <a href="#"
                                            style="font-size: 12px; color: #9ca3af; text-decoration: underline; margin: 0 8px;">Privacy
                                            Policy</a>
                                        <a href="#"
                                            style="font-size: 12px; color: #9ca3af; text-decoration: underline; margin: 0 8px;">Terms
                                            of Service</a>
                                    </div>
                                </td>
                            </tr>

                        </table>
                    </div>
                </center>
            </body>

            </html>`,
    );

    console.log("otp stored and verfication email is sent");
  } catch (err) {
    console.log("error in sendVerificationMail on otpDb");
  }
};

otpSchema.pre("save", async function () {
  console.log(`new document otp stored`);
  if (this.isNew) {
    console.log(this.firstName, "otpDb");
    await sendVerificationMail(this.firstName, this.email, this.otp);
  }
});

export default mongoose.model("OTP", otpSchema);
