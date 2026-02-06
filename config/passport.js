import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userDb from "../models/userDb.js";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await userDb.findOne({ email: profile.emails[0].value });
        if (user) {
          if (user.isBlocked) {
            return done(null, false, { message: "User is blocked by admin" });
          }
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        }

        const avatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        let lastName = "\u200B";
        if (profile.name.familyName) {
          lastName = profile.name.familyName;
        }
        user = await userDb.create({
            firstName: profile.name.givenName,
            lastName: lastName,
            email: profile.emails[0].value,
            avatar: avatar,
            googleId: profile.id,
        });
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    const user = await userDb.findById(id);
    done(null, user);
});
