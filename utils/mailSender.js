import nodemailer from 'nodemailer'

export const mailSender = async (email, title, body) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: '"GRANTHAE OTP Verification" <granthae@gmail.com>',
            to: email,
            subject: title,
            html: body,
        });
    } catch (err) {
        console.error("Error sending email:", err.message);
    }
}
