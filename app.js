import express from 'express'
import path from 'path'
import {fileURLToPath} from 'url'
import session from 'express-session'
import expressLayouts from 'express-ejs-layouts'
import userRoutes from './routes/userRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import { notFound, errorHandler } from './middlewares/errorMiddleware.js'
import { adminNotificationMiddleware } from './middlewares/adminNotificationMiddleware.js'

import dotenv from 'dotenv'
import { connectDb } from './config/dbConnect.js'
import passport from 'passport'
import './config/passport.js'
import userDb from './models/userDb.js'

dotenv.config()
const PORT = process.env.PORT || 3000


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true 
}))

// Middleware to make current path and user available to all views
app.use(async (req, res, next) => {
    res.locals.path = req.path;
    try {
        if (req.session.user) {
            const user = await userDb.findById(req.session.user);
            res.locals.user = user;
        } else {
            res.locals.user = null;
        }
    } catch (error) {
        console.error("Error in global user middleware:", error);
        res.locals.user = null;
    }
    next();
});

app.use(adminNotificationMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')))
app.use(expressLayouts);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('layout', './layouts/main');
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))


app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use('/', userRoutes)
app.use('/admin', adminRoutes)

app.use(notFound)
app.use(errorHandler)

await connectDb()
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});