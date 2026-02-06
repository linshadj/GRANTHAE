import nodemailer from 'nodemailer'

export const mailSender = async (email, title, body) => {
    try{
        const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true: 465, false: 587
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
        });

        // Send an email using async/await
        (async () => {
        const info = await transporter.sendMail({
            from: '"GRANTHAE Otp Verification" <granthae@gmail.com>',
            to: email,
            subject: title,
            html: body, 
        });

        console.log("Email sent:", info.messageId);
        })();
    }catch (err) {
        console.log('Error in mailSender: ', err)
    }
}